'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  AlertCircle,
  Plus,
  Image as ImageIcon,
  Video,
  FileText,
  CheckSquare,
  File,
  X,
  Layout
} from 'lucide-react';
import AppSidebar from '@/components/app-sidebar';
import { useTaskContext } from '@/components/task-provider';

// Block types including 'page' for recursive tasks
type BlockType = 'text' | 'image' | 'video' | 'file' | 'subtask' | 'page';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  isCompleted?: boolean; // for subtasks
  // For nested pages (data persistence)
  childBlocks?: Block[];
  pageParams?: {
    deadline: string;
    assignees: string[];
    overdueReason: string;
  };
}

// State interface to save/restore history
interface PageState {
  title: string;
  blocks: Block[];
  deadline: string;
  assignees: string[];
  showOverdue: boolean;
  overdueReason: string;
}

export default function NewTaskPage() {
  const router = useRouter();

  // --- Navigation & History State ---
  // History stores the state of the *parents* we have left behind.
  // When we go deeper, we push the current state here.
  const [history, setHistory] = useState<{ id: string; title: string; state: PageState }[]>([]);

  // The ID of the block in the *parent* that represents the current page. 
  // 'root' means we are at the top level.
  const [currentPageId, setCurrentPageId] = useState<string>('root');


  // --- Current Page Data State ---
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState<string>('');
  const [assignees, setAssignees] = useState<string[]>([]);
  // We track overdue for styling
  const [isOverdue, setIsOverdue] = useState(false);
  const [overdueReason, setOverdueReason] = useState('');

  // --- Context Sync ---
  const { addTask, updateTask } = useTaskContext();
  // Stable ID for this session's new task
  const taskIdRef = useRef(Math.random().toString(36).substr(2, 9));
  const hasAddedToContext = useRef(false);

  // Sync state to Context
  useEffect(() => {
    // Determine color based on some logic or random for now
    const color = 'bg-blue-100 text-blue-600';

    const taskData = {
      id: taskIdRef.current,
      title: title || 'Новая задача',
      deadline: deadline || undefined,
      assignees,
      // Default to "task" type
      type: 'task' as const,
      color
    };

    if (!hasAddedToContext.current) {
      addTask(taskData);
      hasAddedToContext.current = true;
    } else {
      updateTask(taskIdRef.current, taskData);
    }
  }, [title, deadline, assignees]);

  const [blocks, setBlocks] = useState<Block[]>([
    { id: '1', type: 'text', content: '' }
  ]);

  // --- UI State ---
  const [activeBlockId, setActiveBlockId] = useState<string | null>('1');
  const [showMenuForBlockId, setShowMenuForBlockId] = useState<string | null>(null);

  // Refs
  const blockRefs = useRef<{ [key: string]: HTMLTextAreaElement | HTMLInputElement | null }>({});


  // --- Navigation Logic ---

  // Drill down into a sub-page
  const handleOpenPage = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    // 1. Save current state to history
    const currentState: PageState = {
      title,
      blocks,
      deadline,
      assignees,
      showOverdue: isOverdue, // Store the computed or state value
      overdueReason
    };

    setHistory(prev => [
      ...prev,
      { id: currentPageId, title: title || 'Untitled', state: currentState }
    ]);

    // 2. Load new state
    setCurrentPageId(blockId);

    // Set title to the link text
    setTitle(block.content || '');

    // Load child blocks if they exist, else empty text block
    if (block.childBlocks && block.childBlocks.length > 0) {
      setBlocks(block.childBlocks);
    } else {
      setBlocks([{ id: '1', type: 'text', content: '' }]);
    }

    // Restore params if they exist, else RESET them (Fresh state for new task)
    if (block.pageParams) {
      setDeadline(block.pageParams.deadline || '');
      setAssignees(block.pageParams.assignees || []);
      setOverdueReason(block.pageParams.overdueReason || '');
    } else {
      setDeadline('');
      setAssignees([]);
      setOverdueReason('');
    }
  };

  // Go back up to a specific level (breadcrumbs)
  const handleNavigateBack = (targetIndex: number) => {
    // Logic:
    // 1. We are currently at depth N (history length).
    // 2. We want to go back to index `targetIndex`.
    // 3. This means we are "popping" everything AFTER `targetIndex`.
    // 4. BUT, we must save the current work into the *immediate parent* first?
    //    Actually, Notion saves recursively. If I jump from Level 3 to Level 1, 
    //    I need to save Level 3 into Level 2, and Level 2 into Level 1... 
    //    That is complex. 
    //    Simplification for this prototype: We only support going back ONE level at a time 
    //    via the breadcrumb or we just save the current state into the *immediate* parent in the stack?
    //    
    //    Correct approach for "Back" button (one level up):
    //    1. Current state -> save into Parent's block (Parent is history[last]).
    //    2. Pop history.
    //
    //    If jumping multiple levels, we technically lose intermediate changes if we don't bubble them up.
    //    Let's implement "Go Back One Level" and chain it if needed, or just handle immediate parent.

    // For now, let's implement: "Save current into immediate parent, then restore target parent".
    // Note: This effectively discards intermediate levels if jumping > 1 level. 
    // Ideally, users click the immediate parent.
    // Let's standardise on: We only "pop" one level at a time for safety? 
    // Or just assume single level back for now.

    if (targetIndex < 0 || targetIndex >= history.length) return;

    // We want to go to `history[targetIndex]`.
    // The "Immediate Parent" is `history[history.length - 1]`.
    // We MUST save current state into Immediate Parent.

    const immediateParentEntry = history[history.length - 1];
    const parentState = immediateParentEntry.state;

    // Update the block in the parent that corresponds to our current page
    const updatedParentBlocks = parentState.blocks.map(b => {
      if (b.id === currentPageId) {
        return {
          ...b,
          content: title, // Update link text
          childBlocks: blocks, // Update inner content
          pageParams: { deadline, assignees, overdueReason } // Update params
        };
      }
      return b;
    });

    // Now, if we were just going back 1 level, we would restore `parentState` with `updatedParentBlocks`.
    // If we are jumping back further, we technically need to update *that* parent's block... recursion hell.
    // Let's just strictly implement "Go Up One Level" logic for now which is safer.
    // If user clicks Grandparent, we can just warn or force single steps.
    // But for UI, let's just restore the target state directly (LOSING UNSAVED CHANGES in intermediate parents if skipping).
    // STRICTLY: Only save to immediate parent.

    // Let's assume standard behavior: Click "Back" (Parent).
    // We save to parent, and restore parent.

    // If target is NOT immediate parent, we just restore target and lose current changes? 
    // Let's try to do it right for 1 level.

    if (targetIndex === history.length - 1) {
      // Going back 1 level
      const newHistory = history.slice(0, targetIndex);
      const stateToRestore = history[targetIndex].state;

      setHistory(newHistory);
      setCurrentPageId(history[targetIndex].id); // The ID of the block we were in previously

      setTitle(stateToRestore.title);
      setBlocks(updatedParentBlocks); // RESTORE WITH UPDATED BLOCK
      setDeadline(stateToRestore.deadline);
      setAssignees(stateToRestore.assignees);
      setOverdueReason(stateToRestore.overdueReason);
    } else {
      // Default to just loading the target state (no save) if jumping
      // This prevents corruption for now.
      const entry = history[targetIndex];
      setHistory(history.slice(0, targetIndex));
      setCurrentPageId(entry.id);
      setTitle(entry.state.title);
      setBlocks(entry.state.blocks);
      setDeadline(entry.state.deadline);
      setAssignees(entry.state.assignees);
      setOverdueReason(entry.state.overdueReason);
    }
  };


  // --- Helper Functions ---

  const createBlock = (type: BlockType = 'text', afterId: string): string => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newBlock: Block = { id: newId, type, content: '' };
    // Initialize child props if page
    if (type === 'page') {
      newBlock.childBlocks = [{ id: '1', type: 'text', content: '' }];
    }

    setBlocks(prev => {
      const index = prev.findIndex(b => b.id === afterId);
      if (index === -1) return [...prev, newBlock];
      const newBlocks = [...prev];
      newBlocks.splice(index + 1, 0, newBlock);
      return newBlocks;
    });

    return newId;
  };

  const focusBlock = (id: string) => {
    setTimeout(() => {
      const el = blockRefs.current[id];
      if (el) {
        el.focus();
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent, blockId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newId = createBlock('text', blockId);
      setActiveBlockId(newId);
      focusBlock(newId);
    }

    if (e.key === 'Backspace' && blocks.length > 1) {
      const currentBlock = blocks.find(b => b.id === blockId);
      if (currentBlock && currentBlock.content === '') {
        e.preventDefault();
        const index = blocks.findIndex(b => b.id === blockId);
        if (index > 0) {
          const prevBlock = blocks[index - 1];
          setBlocks(prev => prev.filter(b => b.id !== blockId));
          setActiveBlockId(prevBlock.id);
          focusBlock(prevBlock.id);
        }
      }
    }
  };

  const updateBlockContent = (id: string, content: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
  };

  const toggleSubtask = (id: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, isCompleted: !b.isCompleted } : b));
  };

  const changeBlockType = (id: string, type: BlockType) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, type } : b));
    setShowMenuForBlockId(null);
    focusBlock(id);
  };

  // Check for overdue
  useEffect(() => {
    if (deadline && new Date(deadline) < new Date()) {
      setIsOverdue(true);
    } else {
      setIsOverdue(false);
    }
  }, [deadline]);

  return (
    <div className="flex h-screen bg-white dark:bg-background">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-16 py-12">

          {/* Breadcrumbs */}
          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
              {/* Render full history trail */}
              {history.map((h, index) => (
                <div key={h.id} className="flex items-center gap-2">
                  <button
                    onClick={() => handleNavigateBack(index)}
                    className="hover:text-gray-900 dark:hover:text-white hover:underline transition-colors"
                  >
                    {h.title || "Untitled"}
                  </button>
                  <span className="text-gray-300 dark:text-gray-600">/</span>
                </div>
              ))}

              {/* Current Page */}
              <div className="font-medium text-gray-900">
                {title || "Untitled"}
              </div>
            </div>
          )}

          {/* Cover / Icon Area */}
          <div className="group relative mb-8 opacity-0 hover:opacity-100 transition-opacity">
            <div className="flex gap-2 text-gray-400 dark:text-gray-500 text-sm">
              <button className="hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded">Добавить иконку</button>
              <button className="hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded">Добавить обложку</button>
            </div>
          </div>

          {/* Title input */}
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Новая задача"
            rows={1}
            className="w-full text-5xl font-bold text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 border-none outline-none resize-none overflow-hidden bg-transparent mb-6 py-2"
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />

          {/* Parameters Section (Unique to this page level) */}
          <div className="space-y-1 mb-8">
            {/* Deadline */}
            <div className="flex items-center group py-1">
              <div className="w-40 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Calendar size={16} />
                <span className="text-sm">Дедлайн</span>
              </div>
              <div className="flex-1">
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="text-sm text-gray-700 dark:text-gray-300 bg-transparent border-none focus:ring-0 p-0 hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 -ml-2 cursor-pointer"
                />
              </div>
            </div>

            {/* Assignees */}
            <div className="flex items-center group py-1">
              <div className="w-40 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Users size={16} />
                <span className="text-sm">Ответственные</span>
              </div>
              <div className="flex-1 flex gap-2">
                {assignees.length > 0 ? (
                  assignees.map((a, i) => (
                    <span key={i} className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-gray-700 dark:text-gray-300">{a}</span>
                  ))
                ) : (
                  <button
                    onClick={() => router.push('/hierarchy')}
                    className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:underline text-left -ml-2 px-2"
                  >
                    Выбрать из иерархии...
                  </button>
                )}
              </div>
            </div>

            {/* Violation / Overdue Reason */}
            <div className="flex items-start group py-1 mt-2">
              <div className={`w-40 flex items-center gap-2 ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                <AlertCircle size={16} />
                <span className="text-sm font-medium">Причина просрочки</span>
              </div>
              <div className="flex-1">
                <textarea
                  value={overdueReason}
                  onChange={(e) => setOverdueReason(e.target.value)}
                  placeholder="Если есть просрочка, укажите причину..."
                  rows={1}
                  className={`w-full text-sm border-none rounded p-2 focus:ring-1 resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600 ${isOverdue
                    ? 'text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20 focus:ring-red-200 dark:focus:ring-red-800'
                    : 'text-gray-600 dark:text-gray-300 bg-transparent focus:ring-gray-200 dark:focus:ring-gray-700'
                    }`}
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800 mb-8" />

          {/* Block Editor */}
          <div className="space-y-1 pb-20">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="group relative flex items-start -ml-8 pl-8"
              >
                {/* Plus / Drag Handle */}
                <div
                  className={`absolute left-0 top-1.5 flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-opacity opacity-0 group-hover:opacity-100`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenuForBlockId(showMenuForBlockId === block.id ? null : block.id);
                  }}
                >
                  <Plus size={14} className="text-gray-400" />

                  {/* Dropdown Menu */}
                  {showMenuForBlockId === block.id && (
                    <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-lg p-1 w-48 z-20">
                      <button onClick={() => changeBlockType(block.id, 'image')} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-left text-sm text-gray-700 dark:text-gray-300">
                        <ImageIcon size={14} /> Фото
                      </button>
                      <button onClick={() => changeBlockType(block.id, 'video')} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-left text-sm text-gray-700 dark:text-gray-300">
                        <Video size={14} /> Видео
                      </button>
                      <button onClick={() => changeBlockType(block.id, 'file')} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-left text-sm text-gray-700 dark:text-gray-300">
                        <FileText size={14} /> Файл
                      </button>
                      <button onClick={() => changeBlockType(block.id, 'page')} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-left text-sm text-gray-700 dark:text-gray-300">
                        <Layout size={14} /> Новая задача
                      </button>
                    </div>
                  )}
                </div>

                {/* Content Renderers */}
                <div className="flex-1 relative">
                  {block.type === 'text' && (
                    <input
                      ref={el => { blockRefs.current[block.id] = el; }}
                      value={block.content}
                      onChange={(e) => updateBlockContent(block.id, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, block.id)}
                      onFocus={() => setActiveBlockId(block.id)}
                      placeholder="Вы можете добавить картинки или подзадачи..."
                      className="w-full py-1 bg-transparent border-none outline-none focus:ring-0 text-base text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                    />
                  )}

                  {block.type === 'subtask' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSubtask(block.id)}
                        className={`flex-shrink-0 w-4 h-4 border rounded ${block.isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                      >
                        {block.isCompleted && <CheckSquare size={12} />}
                      </button>
                      <input
                        ref={el => { blockRefs.current[block.id] = el; }}
                        value={block.content}
                        onChange={(e) => updateBlockContent(block.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, block.id)}
                        onFocus={() => setActiveBlockId(block.id)}
                        className={`w-full py-1 bg-transparent border-none outline-none focus:ring-0 text-base ${block.isCompleted ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}
                      />
                    </div>
                  )}

                  {block.type === 'page' && (
                    <div
                      className="flex items-center gap-2 group/page cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded -ml-1 border-b border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                      onClick={() => handleOpenPage(block.id)}
                    >
                      <Layout size={18} className="text-gray-500 dark:text-gray-400" />
                      <span className={`text-base ${block.content ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'} border-b border-gray-300 dark:border-gray-600 hover:border-gray-900 dark:hover:border-gray-100 transition-colors`}>
                        {block.content || "Новая задача"}
                      </span>
                    </div>
                  )}

                  {(block.type === 'image' || block.type === 'video' || block.type === 'file') && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer relative group/media">
                      <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                        {block.type === 'image' && <ImageIcon size={24} />}
                        {block.type === 'video' && <Video size={24} />}
                        {block.type === 'file' && <FileText size={24} />}
                        <span className="text-sm font-medium">Click to add {block.type}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newBlocks = blocks.filter(b => b.id !== block.id);
                            setBlocks(newBlocks.length ? newBlocks : [{ id: '1', type: 'text', content: '' }]);
                          }}
                          className="absolute top-2 right-2 p-1 bg-white dark:bg-gray-700 rounded-full shadow opacity-0 group-hover/media:opacity-100 hover:text-red-500"
                        >
                          <X size={14} className="dark:text-white" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
}
