'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Calendar,
  CheckSquare,
  Layout,
  DollarSign,
  Trash2
} from 'lucide-react';
import AppSidebar from '@/components/app-sidebar';
import PageEditor from '@/components/page-editor';
import { useAutosave } from '@/hooks/useAutosave';
import { useProject } from '@/hooks/useProject';
import EditorMediaDropzone from '@/components/editor-media-dropzone';
import EditorModeBadge from '@/components/editor-mode-badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { getFileUrl } from '@/lib/utils';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '');

interface UploadResponse {
  url?: string;
  fileName?: string;
  error?: string;
}

// Block types including 'page' for recursive tasks
type BlockType = 'text' | 'image' | 'video' | 'file' | 'subtask' | 'page';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  pageId?: string;
  isCompleted?: boolean; // for subtasks
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  // For nested pages (data persistence)
  childBlocks?: Block[];
  pageParams?: {
    deadline: string;
    budget: string;
    startDate: string;
    coverImage: string;
  };
}

// State interface to save/restore history
interface PageState {
  title: string;
  blocks: Block[];
  deadline: string;
  budget: string;
  startDate: string;
  coverImage: string;
}

interface SortableBlockProps {
  block: Block;
  children: React.ReactNode;
}

function SortableBlock({ block, children }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className={`relative ${isDragging ? 'z-10' : ''}`}>
      <div
        {...listeners}
        className="absolute -left-12 top-1.5 cursor-grab active:cursor-grabbing opacity-40 hover:opacity-100 text-gray-400 transition-opacity select-none px-1"
        onClick={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </div>
      {children}
    </div>
  );
}

type SlashCommandType = 'image' | 'video' | 'file' | 'page' | 'subtask';

const slashCommands: { label: string; type: SlashCommandType }[] = [
  { label: 'Image', type: 'image' },
  { label: 'Video', type: 'video' },
  { label: 'File', type: 'file' },
  { label: 'Page', type: 'page' },
  { label: 'Subtask', type: 'subtask' }
];

interface SlashMenuProps {
  open: boolean;
  selectedIndex: number;
  position: { x: number; y: number };
  menuRef: React.RefObject<HTMLDivElement | null>;
  onHoverIndex: (index: number) => void;
  onSelect: (type: SlashCommandType) => void;
}

function SlashMenu({
  open,
  selectedIndex,
  position,
  menuRef,
  onHoverIndex,
  onSelect
}: SlashMenuProps) {
  if (!open) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        zIndex: 9999
      }}
      className="min-w-47.5 rounded-md bg-gray-900 text-white shadow-xl border border-gray-700 py-1"
    >
      {slashCommands.map((item, index) => (
        <button
          key={item.type}
          type="button"
          onMouseEnter={() => onHoverIndex(index)}
          onClick={() => onSelect(item.type)}
          className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
            selectedIndex === index ? 'bg-gray-800' : 'hover:bg-gray-800'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
}

type EditorMode = 'project' | 'page';
type PageSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type ProjectPageResponse = {
  id: string;
  project_id: string;
  title: string;
  blocks?: unknown;
  blocks_json?: unknown;
};

type ProjectPageListItem = {
  id: string;
  title: string;
};

type NewProjectPageContentProps = {
  existingProjectId?: string;
  existingPageId?: string;
  forcedMode?: EditorMode;
};

function NewProjectPageContent({ existingProjectId, existingPageId, forcedMode }: NewProjectPageContentProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryMode = (searchParams.get('mode') === 'page' ? 'page' : 'project') as EditorMode;
  const mode = forcedMode || (!existingProjectId ? 'project' : (existingPageId ? 'page' : queryMode));
  const entityType: EditorMode = mode;
  const isPageEntity = entityType === 'page';
  const pageIdFromQuery = String(existingPageId || searchParams.get('pageId') || '');
  const [projectId, setProjectId] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(true);
  const { project } = useProject(existingProjectId);
  const isRoleResolved = !existingProjectId || project !== null;
  const userRole = (project?.current_user_role || project?.currentUserRole || '') as 'owner' | 'manager' | 'member' | '';
  const editorRole: 'owner' | 'manager' | 'member' = userRole === 'manager' || userRole === 'member' || userRole === 'owner'
    ? userRole
    : 'owner';
  const isReadOnly = Boolean(existingProjectId) && (!isRoleResolved || userRole === 'member');

  // --- Navigation & History State ---
  // History stores the state of the *parents* we have left behind.
  // When we go deeper, we push the current state here.
  const [history, setHistory] = useState<{ id: string; title: string; state: PageState }[]>([]);

  // The ID of the block in the *parent* that represents the current page.
  // 'root' means we are at the top level.
  const [currentPageId, setCurrentPageId] = useState<string>('root');

  // --- Current Page Data State ---
  const [title, setTitle] = useState('Новый проект');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [deadline, setDeadline] = useState<string>('');
  const [projectUpdatedAt, setProjectUpdatedAt] = useState('');
  const [assignees] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [pageSaveStatus, setPageSaveStatus] = useState<PageSaveStatus>('idle');

  const [blocks, setBlocks] = useState<Block[]>([
    { id: '1', type: 'text', content: '' }
  ]);
  const pageLastSavedPayloadRef = useRef('');
  const pageLoadedRef = useRef(false);

  const applyPageTitlesToBlocks = useCallback((inputBlocks: Block[], pageTitles: Map<string, string>): Block[] => {
    return inputBlocks.map((block) => {
      const nextChildBlocks = Array.isArray(block.childBlocks)
        ? applyPageTitlesToBlocks(block.childBlocks, pageTitles)
        : block.childBlocks;

      if (!block.pageId || !pageTitles.has(block.pageId)) {
        if (nextChildBlocks !== block.childBlocks) {
          return {
            ...block,
            childBlocks: nextChildBlocks,
          };
        }
        return block;
      }

      const nextTitle = pageTitles.get(block.pageId) || block.content;
      if (block.content === nextTitle && nextChildBlocks === block.childBlocks) {
        return block;
      }

      return {
        ...block,
        content: nextTitle,
        childBlocks: nextChildBlocks,
      };
    });
  }, []);

  const buildProjectPayload = () => {
    const normalizedTitle = title.trim() || 'Новый проект';
    const parsedBudget = Number.parseInt(budget, 10);
    const normalizedBudget = Number.isFinite(parsedBudget) ? parsedBudget : 0;

    return {
      title: normalizedTitle,
      cover_url: coverImage.trim() || '',
      budget: normalizedBudget,
      startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : '',
      deadline: deadline ? new Date(`${deadline}T00:00:00.000Z`).toISOString() : '',
      blocks,
      expected_updated_at: projectUpdatedAt || undefined,
    };
  };

  useEffect(() => {
    let cancelled = false;

    const createDraft = async () => {
      setSaveError(null);
      setIsCreatingProject(true);

      try {
        if (mode === 'page') {
          setProjectId(existingProjectId || '');
          setIsCreatingProject(false);
          return;
        }

        if (existingProjectId) {
          setProjectId(existingProjectId);
          setIsCreatingProject(false);
          return;
        }

        const { data } = await api.post<{ id: string }>('/projects', {
          title: 'Новый проект',
          budget: 0,
        });

        if (!data?.id) {
          throw new Error('project id is missing');
        }

        if (cancelled) {
          return;
        }

        // Canonical editor URL
        router.replace(`/project/${data.id}/editor`);
      } catch (error) {
        if (!cancelled) {
          setSaveError(getApiErrorMessage(error, 'Не удалось открыть редактор проекта'));
        }
      } finally {
        if (!cancelled) {
          setIsCreatingProject(false);
        }
      }
    };

    void createDraft();

    return () => {
      cancelled = true;
    };
  }, [existingProjectId, mode, router]);

  useEffect(() => {
    if (mode !== 'project' || !existingProjectId || !project) {
      return;
    }

    setTitle(String(project.title || 'Новый проект'));
    const budgetValue = Number(project.budget ?? project.total_budget ?? 0);
    setBudget(Number.isFinite(budgetValue) ? String(budgetValue) : '0');
    setCoverImage(String(project.cover_url || project.coverUrl || ''));
    setStartDate(toDateInputValue(project.start_date || project.startDate));
    setDeadline(toDateInputValue(project.deadline));
    setProjectUpdatedAt(String(project.updated_at || project.updatedAt || ''));

    const parsedBlocks = Array.isArray(project.blocks) ? (project.blocks as Block[]) : [];
    if (parsedBlocks.length > 0) {
      setBlocks(parsedBlocks);
    } else {
      setBlocks([{ id: crypto.randomUUID(), type: 'text', content: '' }]);
    }
  }, [existingProjectId, mode, project]);

  useEffect(() => {
    if (mode !== 'project' || !projectId || (existingProjectId && !project)) {
      return;
    }

    let cancelled = false;

    const syncPageTitles = async () => {
      try {
        const { data } = await api.get<ProjectPageListItem[]>(`/projects/${projectId}/pages`);
        if (cancelled || !Array.isArray(data) || data.length === 0) {
          return;
        }

        const titlesMap = new Map<string, string>();
        data.forEach((page) => {
          if (!page?.id) {
            return;
          }
          const normalizedTitle = String(page.title || 'Новая страница').trim() || 'Новая страница';
          titlesMap.set(String(page.id), normalizedTitle);
        });

        setBlocks((prev) => applyPageTitlesToBlocks(prev, titlesMap));
      } catch {
        // no-op: keep editor usable even if title sync request fails
      }
    };

    void syncPageTitles();

    return () => {
      cancelled = true;
    };
  }, [applyPageTitlesToBlocks, existingProjectId, mode, project, projectId]);

  useEffect(() => {
    const targetProjectId = projectId || existingProjectId || '';
    if (mode !== 'page' || !targetProjectId || !pageIdFromQuery) {
      return;
    }

    let cancelled = false;
    pageLoadedRef.current = false;

    const loadPage = async () => {
      setSaveError(null);
      try {
        const { data } = await api.get<ProjectPageResponse>(`/projects/${targetProjectId}/pages/${pageIdFromQuery}`);
        if (!data || cancelled) {
          return;
        }

        const normalizedTitle = String(data.title || 'Новая страница');
        const rawBlocks = Array.isArray(data.blocks)
          ? data.blocks
          : Array.isArray(data.blocks_json)
            ? data.blocks_json
            : [];
        const parsedBlocks = Array.isArray(rawBlocks) ? (rawBlocks as Block[]) : [];
        const normalizedBlocks: Block[] = parsedBlocks.length > 0
          ? parsedBlocks
          : [{ id: crypto.randomUUID(), type: 'text', content: '' }];
        setTitle(normalizedTitle);
        setBlocks(normalizedBlocks);
        pageLastSavedPayloadRef.current = JSON.stringify({
          title: normalizedTitle.trim() || 'Новая страница',
          blocks: normalizedBlocks,
        });
        pageLoadedRef.current = true;
        setPageSaveStatus('idle');
      } catch (error) {
        if (!cancelled) {
          setSaveError(getApiErrorMessage(error, 'Не удалось загрузить страницу'));
          setPageSaveStatus('error');
        }
      }
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [existingProjectId, mode, pageIdFromQuery, projectId]);

  const handleProjectSaved = useCallback((responseData: unknown) => {
    if (!responseData || typeof responseData !== 'object') {
      return;
    }

    const typedResponse = responseData as { updated_at?: string; updatedAt?: string };
    const updatedAt = typedResponse.updated_at || typedResponse.updatedAt || '';
    if (updatedAt) {
      setProjectUpdatedAt(updatedAt);
    }
  }, []);

  const { saveStatus, saveError: autosaveError } = useAutosave({
    id: projectId,
    type: 'project',
    data: buildProjectPayload(),
    onSaved: handleProjectSaved,
    enabled: !isReadOnly && mode === 'project',
  });

  const savePage = useCallback(async () => {
    if (mode !== 'page' || isReadOnly || !projectId || !pageIdFromQuery) {
      return;
    }

    const payload = {
      title: title.trim() || 'Новая страница',
      blocks,
    };
    const payloadRaw = JSON.stringify(payload);
    if (payloadRaw === pageLastSavedPayloadRef.current) {
      return;
    }

    setPageSaveStatus('saving');
    try {
      await api.patch(`/projects/${projectId}/pages/${pageIdFromQuery}`, payload);
      pageLastSavedPayloadRef.current = payloadRaw;
      setSaveError(null);
      setPageSaveStatus('saved');
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Не удалось сохранить страницу'));
      setPageSaveStatus('error');
    }
  }, [blocks, isReadOnly, mode, pageIdFromQuery, projectId, title]);

  useEffect(() => {
    if (mode !== 'page' || isReadOnly || !projectId || !pageIdFromQuery || !pageLoadedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      void savePage();
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, [mode, isReadOnly, projectId, pageIdFromQuery, title, blocks, savePage]);

  useEffect(() => {
    return () => {
      if (mode === 'page' && !isReadOnly && projectId && pageIdFromQuery && pageLoadedRef.current) {
        void savePage();
      }
    };
  }, [isReadOnly, mode, pageIdFromQuery, projectId, savePage]);

  // --- UI State ---
  const [activeBlockId, setActiveBlockId] = useState<string | null>('1');
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const [slashPosition, setSlashPosition] = useState({ x: 0, y: 0 });

  // Refs
  const blockRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const slashMenuRef = useRef<HTMLDivElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);


  // --- Navigation Logic ---

  // Drill down into a sub-page
  const handleOpenPage = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    if (block.pageId && projectId) {
      router.push(`/project/${projectId}/editor/page/${block.pageId}`);
      return;
    }

    void createAndOpenProjectPage(blockId);
  };

  const createAndOpenProjectPage = async (blockId: string) => {
    if (isReadOnly) {
      return;
    }

    if (!projectId) {
      setSaveError('Проект ещё создаётся. Повторите через секунду.');
      return;
    }

    const block = blocks.find((item) => item.id === blockId);
    const rawTitle = block?.content || '';
    const pageTitle = rawTitle.replace(/\/$/, '').trim() || 'Новая страница';

    try {
      const { data } = await api.post<ProjectPageResponse>(`/projects/${projectId}/pages`, {
        title: pageTitle,
        blocks: [{ id: crypto.randomUUID(), type: 'text', content: '' }],
      });

      if (!data?.id) {
        throw new Error('page id is missing');
      }

      const updatedBlocks: Block[] = blocks.map((item) => {
        if (item.id !== blockId) {
          return item;
        }

        return {
          ...item,
          type: 'page',
          content: data.title || pageTitle,
          pageId: data.id,
          childBlocks: undefined,
          pageParams: undefined,
        };
      });

      setBlocks(updatedBlocks);

      if (mode === 'project') {
        const payload = {
          ...buildProjectPayload(),
          blocks: updatedBlocks,
        };

        const response = await api.patch(`/projects/${projectId}`, payload);
        handleProjectSaved(response?.data);
      } else if (mode === 'page' && pageIdFromQuery) {
        const pagePayload = {
          title: title.trim() || 'Новая страница',
          blocks: updatedBlocks,
        };

        await api.patch(`/projects/${projectId}/pages/${pageIdFromQuery}`, pagePayload);
        pageLastSavedPayloadRef.current = JSON.stringify(pagePayload);
        setPageSaveStatus('saved');
      }

      router.push(`/project/${projectId}/editor/page/${data.id}`);
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Не удалось создать страницу проекта'));
    }
  };

  // Go back up to a specific level (breadcrumbs)
  const handleNavigateBack = (targetIndex: number) => {
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
          pageParams: { deadline, budget, startDate, coverImage } // Update params
        };
      }
      return b;
    });

    if (targetIndex === history.length - 1) {
      // Going back 1 level
      const newHistory = history.slice(0, targetIndex);
      const stateToRestore = history[targetIndex].state;

      setHistory(newHistory);
      setCurrentPageId(history[targetIndex].id); // The ID of the block we were in previously

      setTitle(stateToRestore.title);
      setBlocks(updatedParentBlocks); // RESTORE WITH UPDATED BLOCK
      setDeadline(stateToRestore.deadline);
      setBudget(stateToRestore.budget);
      setStartDate(stateToRestore.startDate);
      setCoverImage(stateToRestore.coverImage);
    } else {
      // Default to just loading the target state (no save) if jumping
      // This prevents corruption for now.
      const entry = history[targetIndex];
      setHistory(history.slice(0, targetIndex));
      setCurrentPageId(entry.id);
      setTitle(entry.state.title);
      setBlocks(entry.state.blocks);
      setDeadline(entry.state.deadline);
      setBudget(entry.state.budget);
      setStartDate(entry.state.startDate);
      setCoverImage(entry.state.coverImage);
    }
  };


  // --- Helper Functions ---

  const createBlock = (type: BlockType = 'text', afterId: string): string => {
    if (isReadOnly) {
      return afterId;
    }

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
      return ensureTrailingTextBlock(newBlocks);
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
    if (isReadOnly) {
      return;
    }

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
    if (isReadOnly) {
      return;
    }
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
  };

  const toggleSubtask = (id: string) => {
    if (isReadOnly) {
      return;
    }
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, isCompleted: !b.isCompleted } : b));
  };

  const changeBlockType = (id: string, type: BlockType) => {
    if (isReadOnly) {
      return;
    }
    setBlocks(prev => ensureTrailingTextBlock(prev.map(b => b.id === id ? { ...b, type } : b)));
    focusBlock(id);
  };

  const closeSlashMenu = () => {
    setSlashOpen(false);
    setSlashIndex(0);
    setSlashBlockId(null);
  };

  useEffect(() => {
    if (!slashOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (slashMenuRef.current && !slashMenuRef.current.contains(target)) {
        closeSlashMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSlashMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [slashOpen]);

  const getSlashMenuPosition = (inputElement: HTMLInputElement) => {
    const rect = inputElement.getBoundingClientRect();
    const styles = window.getComputedStyle(inputElement);
    const caretIndex = inputElement.selectionStart ?? inputElement.value.length;
    const textBeforeCaret = inputElement.value.slice(0, caretIndex);

    const mirror = document.createElement('span');
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre';
    mirror.style.font = styles.font;
    mirror.style.letterSpacing = styles.letterSpacing;
    mirror.textContent = textBeforeCaret || '';
    document.body.appendChild(mirror);
    const textWidth = mirror.getBoundingClientRect().width;
    mirror.remove();

    const paddingLeft = parseFloat(styles.paddingLeft || '0');
    const rawX = rect.left + window.scrollX + paddingLeft + textWidth;
    const maxX = window.scrollX + window.innerWidth - 220;

    return {
      x: Math.max(window.scrollX + 12, Math.min(rawX, maxX)),
      y: rect.bottom + window.scrollY + 8
    };
  };

  const handleTextBlockChange = (
    blockId: string,
    value: string,
    inputElement: HTMLInputElement
  ) => {
    if (isReadOnly) {
      return;
    }

    updateBlockContent(blockId, value);

    if (value.endsWith('/')) {
      setSlashOpen(true);
      setSlashIndex(0);
      setSlashBlockId(blockId);
      setSlashPosition(getSlashMenuPosition(inputElement));
    } else if (slashOpen && slashBlockId === blockId && !value.includes('/')) {
      closeSlashMenu();
    }
  };

  const handleSlashSelect = async (type: SlashCommandType) => {
    if (isReadOnly) {
      return;
    }

    if (!slashBlockId) return;

    setBlocks(prev => prev.map(block => {
      if (block.id !== slashBlockId || block.type !== 'text') {
        return block;
      }
      return {
        ...block,
        content: block.content.endsWith('/') ? block.content.slice(0, -1) : block.content
      };
    }));

    if (type === 'page') {
      closeSlashMenu();
      await createAndOpenProjectPage(slashBlockId);
      return;
    }

    changeBlockType(slashBlockId, type);
    focusBlock(slashBlockId);
    closeSlashMenu();
  };

  const handleTextBlockKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, blockId: string) => {
    if (slashOpen && slashBlockId === blockId) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % slashCommands.length);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + slashCommands.length) % slashCommands.length);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        void handleSlashSelect(slashCommands[slashIndex].type);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        closeSlashMenu();
        return;
      }
    }

    handleKeyDown(e, blockId);
  };

  const ensureTrailingTextBlock = (currentBlocks: Block[]) => {
    const lastBlock = currentBlocks[currentBlocks.length - 1];
    if (!lastBlock || lastBlock.type === 'text') {
      return currentBlocks;
    }

    const newTextBlock: Block = { id: Math.random().toString(36).substr(2, 9), type: 'text', content: '' };
    return [...currentBlocks, newTextBlock];
  };

  const removeBlock = (id: string) => {
    if (isReadOnly) {
      return;
    }

    const currentIndex = blocks.findIndex((b) => b.id === id);

    setBlocks((prev) => {
      const filtered = prev.filter((b) => b.id !== id);
      if (filtered.length === 0) {
        return [{ id: crypto.randomUUID(), type: 'text', content: '' }];
      }
      return ensureTrailingTextBlock(filtered);
    });

    setTimeout(() => {
      const fallbackId = blocks[currentIndex - 1]?.id || blocks[currentIndex + 1]?.id;
      if (fallbackId) {
        setActiveBlockId(fallbackId);
        focusBlock(fallbackId);
      }
    }, 10);
  };

  const handleNonTextBlockKeyDown = (e: React.KeyboardEvent, blockId: string) => {
    if (isReadOnly) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newId = createBlock('text', blockId);
      setActiveBlockId(newId);
      focusBlock(newId);
      return;
    }

    if ((e.key === 'Backspace' || e.key === 'Delete') && blocks.length > 1) {
      e.preventDefault();
      removeBlock(blockId);
    }
  };

  const handleMediaUploaded = (
    blockId: string,
    media: { fileUrl: string; fileName: string; fileType: string; fileSize: number }
  ) => {
    if (isReadOnly) {
      return;
    }

    setBlocks(prev => prev.map(b => (
      b.id === blockId
        ? {
          ...b,
          content: media.fileUrl,
          fileUrl: media.fileUrl,
          fileName: media.fileName,
          fileType: media.fileType
        }
        : b
    )));

    if (projectId) {
      void api.post('/project-files', {
        project_id: projectId,
        url: media.fileUrl,
        type: media.fileType,
        name: media.fileName,
        size: media.fileSize,
      }).catch((error) => {
        setSaveError(getApiErrorMessage(error, 'Не удалось зарегистрировать файл проекта'));
      });
    } else {
      setSaveError('Проект ещё создаётся. Повторите загрузку файла через секунду.');
    }

    const nextBlockId = createBlock('text', blockId);
    setActiveBlockId(nextBlockId);
    focusBlock(nextBlockId);
  };

  const handleRemoveFile = (blockId: string) => {
    if (isReadOnly) {
      return;
    }

    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        content: '',
        fileUrl: undefined,
        fileName: undefined,
        fileType: undefined
      };
    }));
  };

  const handleOpenCoverPicker = () => {
    if (isUploadingCover || isReadOnly) {
      return;
    }
    coverInputRef.current?.click();
  };

  const handleCoverFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) {
      return;
    }

    const picked = event.target.files?.[0];
    if (!picked) {
      return;
    }

    setSaveError(null);
    setIsUploadingCover(true);

    try {
      const formData = new FormData();
      formData.append('file', picked);
      formData.append('type', 'image');

      const uploadResponse = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const uploadResult = (await uploadResponse.json()) as UploadResponse;
      if (!uploadResponse.ok || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Не удалось загрузить обложку');
      }

      setCoverImage(uploadResult.url);

      if (mode === 'project' && projectId) {
        await api.patch(`/projects/${projectId}`, { cover_url: uploadResult.url });
      }
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Не удалось обновить обложку проекта'));
    } finally {
      setIsUploadingCover(false);
      event.target.value = '';
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (isReadOnly) {
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setBlocks((items) => {
      const oldIndex = items.findIndex((item) => item.id === String(active.id));
      const newIndex = items.findIndex((item) => item.id === String(over.id));

      if (oldIndex < 0 || newIndex < 0) {
        return items;
      }

      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleSaveProject = async () => {
    if (isReadOnly) {
      return;
    }

    setSaveError(null);

    if (!projectId) {
      setSaveError('Проект ещё создаётся. Попробуйте через секунду.');
      return;
    }

    try {
      await api.patch(`/projects/${projectId}`, buildProjectPayload());
      router.push(`/project-overview/${projectId}`);
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Не удалось сохранить проект'));
    }
  };

  if (isPageEntity) {
    return (
      <div className="flex h-screen bg-white dark:bg-background">
        <AppSidebar />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-16 py-12">
            <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Новый проект</span>
              <span>/</span>
              <button
                type="button"
                onClick={() => {
                  if (projectId) {
                    router.push(`/project/${projectId}/editor`);
                  }
                }}
                className="font-medium text-gray-700 hover:text-gray-900 hover:underline dark:text-gray-300 dark:hover:text-white"
              >
                Главный проект
              </button>
              <span>/</span>
              <span className="font-medium text-gray-900 dark:text-white">Страница</span>
            </div>

            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (projectId) {
                    router.push(`/project/${projectId}/editor`);
                  }
                }}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                ← Назад в редактор
              </button>
              <EditorModeBadge role={editorRole} />
            </div>

            <PageEditor
              title={title}
              onTitleChange={(nextTitle) => {
                if (!isReadOnly) {
                  setTitle(nextTitle);
                }
              }}
              onTitleEnter={() => {
                const lastId = blocks[blocks.length - 1]?.id;
                if (!lastId) {
                  return;
                }
                const newId = createBlock('text', lastId);
                setActiveBlockId(newId);
                focusBlock(newId);
              }}
              readOnly={isReadOnly}
              saveError={saveError}
            >
              <div className="mb-4 text-xs text-gray-400 dark:text-gray-500">
                {pageSaveStatus === 'saving'
                  ? 'Saving...'
                  : pageSaveStatus === 'saved'
                    ? 'Saved'
                    : pageSaveStatus === 'error'
                      ? (saveError || 'Изменения не сохранены')
                      : ''}
              </div>
              <div className="space-y-1 pb-20">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={blocks.map((block) => block.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {blocks.map((block) => (
                      <SortableBlock key={block.id} block={block}>
                        <div className="group relative flex items-start">
                          {!isReadOnly && blocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBlock(block.id)}
                              className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                              aria-label="Удалить блок"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <div className="flex-1 relative">
                            {block.type === 'text' && (
                              <input
                                ref={el => { blockRefs.current[block.id] = el; }}
                                value={block.content}
                                onChange={(e) => handleTextBlockChange(block.id, e.target.value, e.currentTarget)}
                                onKeyDown={(e) => handleTextBlockKeyDown(e, block.id)}
                                onFocus={() => setActiveBlockId(block.id)}
                                placeholder="Вы можете добавить картинки или подзадачи..."
                                className="w-full py-1 bg-transparent border-none outline-none focus:ring-0 text-base text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                              />
                            )}

                            {block.type === 'subtask' && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleSubtask(block.id)}
                                  className={`shrink-0 w-4 h-4 border rounded ${block.isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
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
                                role="button"
                                tabIndex={0}
                                className="flex items-center gap-2 group/page cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded -ml-1 border-b border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                                onClick={() => handleOpenPage(block.id)}
                                onKeyDown={(e) => handleNonTextBlockKeyDown(e, block.id)}
                              >
                                <Layout size={18} className="text-gray-500 dark:text-gray-400" />
                                <span className={`text-base ${block.content ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'} border-b border-gray-300 dark:border-gray-600 hover:border-gray-900 dark:hover:border-gray-100 transition-colors`}>
                                  {block.content || "Новая страница"}
                                </span>
                              </div>
                            )}

                            {(block.type === 'image' || block.type === 'video' || block.type === 'file') && (
                              <div
                                tabIndex={0}
                                onKeyDown={(e) => handleNonTextBlockKeyDown(e, block.id)}
                              >
                                <EditorMediaDropzone
                                  blockId={block.id}
                                  blockType={block.type}
                                  fileUrl={block.fileUrl}
                                  fileName={block.fileName}
                                  onUploaded={handleMediaUploaded}
                                  onRemove={handleRemoveFile}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </SortableBlock>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>

              <SlashMenu
                open={slashOpen}
                selectedIndex={slashIndex}
                position={slashPosition}
                menuRef={slashMenuRef}
                onHoverIndex={setSlashIndex}
                onSelect={(type) => {
                  void handleSlashSelect(type);
                }}
              />
            </PageEditor>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-background">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-16 py-12">
          <div className="mb-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (projectId) {
                  router.push(`/project-overview/${projectId}`);
                  return;
                }
                router.push('/dashboard');
              }}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              ← Назад
            </button>
            <EditorModeBadge role={editorRole} />
          </div>

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
            <input
              ref={coverInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleCoverFileChange}
            />
            <div className="flex gap-2 text-gray-400 dark:text-gray-500 text-sm">
              <button className="hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded">Добавить иконку</button>
              <button
                type="button"
                onClick={handleOpenCoverPicker}
                disabled={isUploadingCover || isReadOnly}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isUploadingCover ? 'Загрузка обложки...' : 'Добавить обложку'}
              </button>
            </div>
          </div>

          {coverImage && (
            <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <img
                src={getFileUrl(coverImage) || coverImage}
                alt="Project cover"
                className="w-full h-60 object-cover rounded-xl"
              />
            </div>
          )}

          {/* Title input */}
          <textarea
            value={title}
            onChange={(e) => {
              if (!isReadOnly) {
                setTitle(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const lastId = blocks[blocks.length - 1]?.id;
                if (!lastId) {
                  return;
                }
                const newId = createBlock('text', lastId);
                setActiveBlockId(newId);
                focusBlock(newId);
              }
            }}
            readOnly={isReadOnly}
            placeholder="Новый проект"
            rows={1}
            className="w-full text-5xl font-bold text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 border-none outline-none resize-none overflow-hidden bg-transparent mb-6 py-2"
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />

          <div className="mb-6 text-xs text-gray-400 dark:text-gray-500">
            {isCreatingProject
              ? 'Creating draft...'
              : saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'saved'
                  ? 'Saved'
                  : saveStatus === 'error'
                    ? (autosaveError || 'Изменения не сохранены')
                    : ''}
          </div>

          {/* Parameters Section (Unique to this page level) */}
          <div className="space-y-1 mb-8">
            {/* Budget */}
            <div className="flex items-center group py-1">
              <div className="w-40 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <DollarSign size={16} />
                <span className="text-sm">Бюджет проекта</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={budget}
                      onChange={(e) => {
                        if (!isReadOnly) {
                          setBudget(e.target.value.replace(/[^\d]/g, ""));
                        }
                      }}
                      readOnly={isReadOnly}
                      className="w-64 text-sm text-white placeholder:text-gray-500 bg-transparent border border-white/20 focus:border-amber-400 caret-amber-400 focus:ring-0 rounded px-9 py-1"
                      placeholder="0"
                    />
                  </div>
                  <span className="text-sm text-gray-500">₸</span>
                </div>
              </div>
            </div>

            {/* Start Date */}
            <div className="flex items-center group py-1">
              <div className="w-40 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Calendar size={16} />
                <span className="text-sm">Дата начала</span>
              </div>
              <div className="flex-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    if (!isReadOnly) {
                      setStartDate(e.target.value);
                    }
                  }}
                  disabled={isReadOnly}
                  className="text-sm text-gray-700 dark:text-gray-300 bg-transparent border-none focus:ring-0 p-0 hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 -ml-2 cursor-pointer"
                />
              </div>
            </div>

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
                  onChange={(e) => {
                    if (!isReadOnly) {
                      setDeadline(e.target.value);
                    }
                  }}
                  disabled={isReadOnly}
                  className="text-sm text-gray-700 dark:text-gray-300 bg-transparent border-none focus:ring-0 p-0 hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 -ml-2 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800 mb-8" />

          {/* Block Editor */}
          <div className="space-y-1 pb-20">
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={blocks.map((block) => block.id)}
                strategy={verticalListSortingStrategy}
              >
                {blocks.map((block) => (
                  <SortableBlock key={block.id} block={block}>
                    <div className="group relative flex items-start">
                      {!isReadOnly && blocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                          aria-label="Удалить блок"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {/* Content Renderers */}
                      <div className="flex-1 relative">
                        {block.type === 'text' && (
                          <input
                            ref={el => { blockRefs.current[block.id] = el; }}
                            value={block.content}
                            onChange={(e) => handleTextBlockChange(block.id, e.target.value, e.currentTarget)}
                            onKeyDown={(e) => handleTextBlockKeyDown(e, block.id)}
                            onFocus={() => setActiveBlockId(block.id)}
                            placeholder="Вы можете добавить картинки или подзадачи..."
                            className="w-full py-1 bg-transparent border-none outline-none focus:ring-0 text-base text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
                          />
                        )}

                        {block.type === 'subtask' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSubtask(block.id)}
                              className={`shrink-0 w-4 h-4 border rounded ${block.isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
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
                            role="button"
                            tabIndex={0}
                            className="flex items-center gap-2 group/page cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded -ml-1 border-b border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                            onClick={() => handleOpenPage(block.id)}
                            onKeyDown={(e) => handleNonTextBlockKeyDown(e, block.id)}
                          >
                            <Layout size={18} className="text-gray-500 dark:text-gray-400" />
                            <span className={`text-base ${block.content ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 italic'} border-b border-gray-300 dark:border-gray-600 hover:border-gray-900 dark:hover:border-gray-100 transition-colors`}>
                              {block.content || "Новая страница"}
                            </span>
                          </div>
                        )}

                        {(block.type === 'image' || block.type === 'video' || block.type === 'file') && (
                          <div
                            tabIndex={0}
                            onKeyDown={(e) => handleNonTextBlockKeyDown(e, block.id)}
                          >
                            <EditorMediaDropzone
                              blockId={block.id}
                              blockType={block.type}
                              fileUrl={block.fileUrl}
                              fileName={block.fileName}
                              onUploaded={handleMediaUploaded}
                              onRemove={handleRemoveFile}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </SortableBlock>
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <SlashMenu
            open={slashOpen}
            selectedIndex={slashIndex}
            position={slashPosition}
            menuRef={slashMenuRef}
            onHoverIndex={setSlashIndex}
            onSelect={(type) => {
              void handleSlashSelect(type);
            }}
          />

          {/* Save Project */}
          <div className="pb-16">
            {saveError && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </div>
            )}
            {!isReadOnly && (
              <button
                onClick={handleSaveProject}
                disabled={isCreatingProject || !projectId}
                className="w-full bg-[#fceec9] hover:bg-[#fae6b5] disabled:bg-[#f7f0de] disabled:text-gray-500 disabled:cursor-not-allowed dark:bg-amber-600 dark:hover:bg-amber-500 text-gray-900 dark:text-white rounded-full py-4 px-6 font-bold flex items-center justify-center gap-2 transition-colors shadow-none text-base"
              >
                Сохранить проект
              </button>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

export default function NewProjectPage(props: NewProjectPageContentProps = {}) {
  return (
    <React.Suspense fallback={null}>
      <NewProjectPageContent {...props} />
    </React.Suspense>
  );
}
