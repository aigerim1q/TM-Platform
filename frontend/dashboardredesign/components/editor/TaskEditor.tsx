'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Trash2 } from 'lucide-react';
import AppSidebar from '@/components/app-sidebar';
import EditorModeBadge from '@/components/editor-mode-badge';
import { useAutosave } from '@/hooks/useAutosave';
import { useProject } from '@/hooks/useProject';
import { api, getApiErrorMessage, getCurrentUserId } from '@/lib/api';
import BlockRenderer from '@/components/editor/BlockRenderer';
import { packTaskBlocks, unpackTaskBlocks, type EditorBlock, type EditorBlockType } from '@/components/editor/taskBlockMeta';

type TaskResponse = {
  id: string;
  stage_id: string;
  project_id: string;
  title: string;
  status: string;
  start_date?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  order_index: number;
  updated_at?: string;
  updatedAt?: string;
  blocks?: unknown;
};

type ProjectOption = {
  id: string;
  title?: string;
};

type StageOption = {
  id: string;
  title?: string;
  order_index?: number;
};

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

type SlashCommandType = 'image' | 'video' | 'file' | 'page' | 'subtask';

const slashCommands: { label: string; type: SlashCommandType }[] = [
  { label: 'Image', type: 'image' },
  { label: 'Video', type: 'video' },
  { label: 'File', type: 'file' },
  { label: 'Page', type: 'page' },
  { label: 'Subtask', type: 'subtask' },
];

interface SlashMenuProps {
  open: boolean;
  selectedIndex: number;
  position: { x: number; y: number };
  menuRef: React.RefObject<HTMLDivElement | null>;
  onHoverIndex: (index: number) => void;
  onSelect: (type: SlashCommandType) => void;
}

function SlashMenu({ open, selectedIndex, position, menuRef, onHoverIndex, onSelect }: SlashMenuProps) {
  if (!open) return null;

  return (
    <div
      ref={menuRef}
      style={{ position: 'absolute', top: position.y, left: position.x, zIndex: 9999 }}
      className="min-w-47.5 rounded-md bg-gray-900 text-white shadow-xl border border-gray-700 py-1"
    >
      {slashCommands.map((item, index) => (
        <button
          key={item.type}
          type="button"
          onMouseEnter={() => onHoverIndex(index)}
          onClick={() => onSelect(item.type)}
          className={`block w-full px-3 py-2 text-left text-sm transition-colors ${selectedIndex === index ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface SortableBlockProps {
  block: EditorBlock;
  children: React.ReactNode;
}

function SortableBlock({ block, children }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

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

function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function ensureTrailingTextBlock(currentBlocks: EditorBlock[]) {
  const lastBlock = currentBlocks[currentBlocks.length - 1];
  if (!lastBlock || lastBlock.type === 'text') return currentBlocks;
  const trailing: EditorBlock = { id: crypto.randomUUID(), type: 'text', content: '' };
  return [...currentBlocks, trailing];
}

export default function TaskEditor({ taskId }: { taskId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isLoadingTask, setIsLoadingTask] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [title, setTitle] = useState('Новая задача');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [taskStatus, setTaskStatus] = useState('todo');
  const [taskOrderIndex, setTaskOrderIndex] = useState(0);
  const [taskUpdatedAt, setTaskUpdatedAt] = useState('');
  const [projectId, setProjectId] = useState('');
  const [stageId, setStageId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [stageOptions, setStageOptions] = useState<StageOption[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [isSavingAndRedirecting, setIsSavingAndRedirecting] = useState(false);
  const [assignees, setAssignees] = useState<string[]>([]);

  const { project } = useProject(projectId || undefined);
  const userRole = (project?.current_user_role || project?.currentUserRole || '') as 'owner' | 'manager' | 'member' | '';
  const editorRole: 'owner' | 'manager' | 'member' = userRole === 'owner' || userRole === 'manager' || userRole === 'member' ? userRole : 'owner';
  const isRoleResolved = !projectId || project !== null;
  const currentUserId = useMemo(() => String(getCurrentUserId() || '').trim().toLowerCase(), []);
  const returnToPath = useMemo(() => {
    const raw = String(searchParams.get('returnTo') || '').trim();
    return raw.startsWith('/') ? raw : '';
  }, [searchParams]);
  const normalizedTaskId = useMemo(
    () => String(taskId || '').trim().replace(/^task-/, ''),
    [taskId],
  );
  const taskDetailsPath = useMemo(
    () => (normalizedTaskId ? `/project/task-${normalizedTaskId}` : ''),
    [normalizedTaskId],
  );

  const isCurrentUserAssignee = useMemo(() => {
    if (!currentUserId) {
      return false;
    }
    const normalizedAssignees = new Set(assignees.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
    return normalizedAssignees.has(currentUserId);
  }, [assignees, currentUserId]);
  const isReadOnly = Boolean(projectId) && (!isRoleResolved || (userRole === 'member' && !isCurrentUserAssignee));

  const [blocks, setBlocks] = useState<EditorBlock[]>([{ id: crypto.randomUUID(), type: 'text', content: '' }]);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashBlockId, setSlashBlockId] = useState<string | null>(null);
  const [slashPosition, setSlashPosition] = useState({ x: 0, y: 0 });

  const blockRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const slashMenuRef = useRef<HTMLDivElement | null>(null);

  const applyPageTitlesToBlocks = useCallback((prev: EditorBlock[], titlesMap: Map<string, string>) => {
    if (!Array.isArray(prev) || prev.length === 0 || titlesMap.size === 0) {
      return prev;
    }

    let changed = false;
    const next = prev.map((block) => {
      if (block.type !== 'page' || !block.pageId) {
        return block;
      }

      const nextTitle = titlesMap.get(String(block.pageId));
      if (!nextTitle || nextTitle === block.content) {
        return block;
      }

      changed = true;
      return {
        ...block,
        content: nextTitle,
      };
    });

    return changed ? next : prev;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTask = async () => {
      if (!taskId) return;

      setIsLoadingTask(true);
      setSaveError(null);

      try {
        const { data } = await api.get<TaskResponse>(`/tasks/${taskId}`);
        if (cancelled || !data) return;

        setTitle(String(data.title || 'Новая задача'));
        setTaskStatus(String(data.status || 'todo'));
        setTaskOrderIndex(Number(data.order_index || 0));
        setStartDate(toDateInputValue(data.start_date || data.startDate));
        setDeadline(toDateInputValue(data.deadline));
        setProjectId(String(data.project_id || ''));
        setStageId(String(data.stage_id || ''));
        setSelectedProjectId(String(data.project_id || ''));
        setSelectedStageId(String(data.stage_id || ''));
        setTaskUpdatedAt(String(data.updated_at || data.updatedAt || ''));

        const unpacked = unpackTaskBlocks(data.blocks);
        setAssignees(unpacked.assignees);

        if (unpacked.blocks.length > 0) {
          setBlocks(ensureTrailingTextBlock(unpacked.blocks));
        } else {
          setBlocks([{ id: crypto.randomUUID(), type: 'text', content: '' }]);
        }
      } catch (error) {
        if (!cancelled) {
          setSaveError(getApiErrorMessage(error, 'Не удалось загрузить задачу'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTask(false);
        }
      }
    };

    void loadTask();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const { data } = await api.get<ProjectOption[]>('/projects');
        if (cancelled) return;
        const projects = Array.isArray(data) ? data : [];
        setProjectOptions(projects);
      } catch (error) {
        if (!cancelled) {
          setSaveError(getApiErrorMessage(error, 'Не удалось загрузить список проектов'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProjects(false);
        }
      }
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setStageOptions([]);
      setSelectedStageId('');
      return;
    }

    let cancelled = false;

    const loadStages = async () => {
      setIsLoadingStages(true);
      try {
        const { data } = await api.get<StageOption[]>(`/projects/${selectedProjectId}/stages`);
        if (cancelled) return;

        const stages = (Array.isArray(data) ? data : []).sort(
          (a, b) => Number(a.order_index || 0) - Number(b.order_index || 0),
        );
        setStageOptions(stages);

        if (stages.length === 0) {
          setSelectedStageId('');
          return;
        }

        const hasCurrentSelection = stages.some((stage) => stage.id === selectedStageId);
        if (!hasCurrentSelection) {
          setSelectedStageId(stages[0].id);
        }
      } catch (error) {
        if (!cancelled) {
          setSaveError(getApiErrorMessage(error, 'Не удалось загрузить этапы проекта'));
          setStageOptions([]);
          setSelectedStageId('');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStages(false);
        }
      }
    };

    void loadStages();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, selectedStageId]);

  useEffect(() => {
    if (!projectId) {
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

        if (titlesMap.size === 0) {
          return;
        }

        setBlocks((prev) => ensureTrailingTextBlock(applyPageTitlesToBlocks(prev, titlesMap)));
      } catch {
        // no-op: keep editor usable even if page title sync request fails
      }
    };

    void syncPageTitles();

    return () => {
      cancelled = true;
    };
  }, [applyPageTitlesToBlocks, projectId]);

  const autosaveBlocks = useMemo(() => packTaskBlocks(blocks, assignees), [blocks, assignees]);

  const { saveStatus, saveError: autosaveError } = useAutosave({
    id: taskId,
    type: 'task',
    debounceMs: 1500,
    data: {
      title: title.trim() || 'Новая задача',
      status: taskStatus,
      startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : null,
      deadline: deadline ? new Date(`${deadline}T00:00:00.000Z`).toISOString() : null,
      order_index: taskOrderIndex,
      assignees,
      blocks: autosaveBlocks,
      expected_updated_at: taskUpdatedAt || undefined,
    },
    onSaved: (responseData) => {
      if (!responseData || typeof responseData !== 'object') return;
      const typedResponse = responseData as { updated_at?: string; updatedAt?: string };
      const updatedAt = typedResponse.updated_at || typedResponse.updatedAt || '';
      if (updatedAt) {
        setTaskUpdatedAt(updatedAt);
      }
    },
    enabled: !isReadOnly,
  });

  const registerRef = (id: string, el: HTMLElement | null) => {
    blockRefs.current[id] = el;
  };

  const focusBlock = (id: string) => {
    setTimeout(() => {
      blockRefs.current[id]?.focus();
    }, 10);
  };

  const createBlock = (type: EditorBlockType = 'text', afterId: string): string => {
    if (isReadOnly) return afterId;

    const newId = crypto.randomUUID();
    const newBlock: EditorBlock = { id: newId, type, content: '' };

    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === afterId);
      if (index === -1) {
        return ensureTrailingTextBlock([...prev, newBlock]);
      }
      const next = [...prev];
      next.splice(index + 1, 0, newBlock);
      return ensureTrailingTextBlock(next);
    });

    return newId;
  };

  const removeBlock = (id: string) => {
    if (isReadOnly) return;

    setBlocks((prev) => {
      const filtered = prev.filter((b) => b.id !== id);
      if (filtered.length === 0) {
        const initial: EditorBlock = { id: crypto.randomUUID(), type: 'text', content: '' };
        return [initial];
      }
      return ensureTrailingTextBlock(filtered);
    });
  };

  const updateBlockContent = (id: string, content: string) => {
    if (isReadOnly) return;
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const toggleSubtask = (id: string) => {
    if (isReadOnly) return;
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, isCompleted: !b.isCompleted } : b)));
  };

  const changeBlockType = (id: string, type: EditorBlockType) => {
    if (isReadOnly) return;
    setBlocks((prev) => ensureTrailingTextBlock(prev.map((b) => (b.id === id ? { ...b, type } : b))));
    focusBlock(id);
  };

  const closeSlashMenu = () => {
    setSlashOpen(false);
    setSlashIndex(0);
    setSlashBlockId(null);
  };

  const buildPageEditorUrl = useCallback((targetProjectId: string, pageId: string) => {
    const returnTo = (pathname && pathname.startsWith('/')) ? pathname : `/tasks/${taskId}/edit`;
    const params = new URLSearchParams({ returnTo });
    return `/project/${targetProjectId}/editor/page/${pageId}?${params.toString()}`;
  }, [pathname, taskId]);

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
      y: rect.bottom + window.scrollY + 8,
    };
  };

  const handleTextBlockChange = (blockId: string, value: string, inputElement: HTMLInputElement) => {
    if (isReadOnly) return;

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

  const handleSlashSelect = (type: SlashCommandType) => {
    if (isReadOnly || !slashBlockId) return;

    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== slashBlockId || block.type !== 'text') {
          return block;
        }

        return {
          ...block,
          content: block.content.endsWith('/') ? block.content.slice(0, -1) : block.content,
        };
      }),
    );

    if (type === 'page') {
      closeSlashMenu();
      void createAndOpenTaskPage(slashBlockId);
      return;
    }

    changeBlockType(slashBlockId, type);
    focusBlock(slashBlockId);
    closeSlashMenu();
  };

  const handleOpenPageBlock = (blockId: string) => {
    if (isReadOnly) return;

    const block = blocks.find((item) => item.id === blockId);
    if (!block) {
      return;
    }

    if (block.pageId && projectId) {
      router.push(buildPageEditorUrl(projectId, block.pageId));
      return;
    }

    void createAndOpenTaskPage(blockId);
  };

  const createAndOpenTaskPage = async (blockId: string) => {
    if (isReadOnly) {
      return;
    }

    if (!projectId) {
      setSaveError('Проект ещё создаётся. Повторите через секунду.');
      return;
    }

    const block = blocks.find((item) => item.id === blockId);
    if (block?.pageId) {
      router.push(buildPageEditorUrl(projectId, block.pageId));
      return;
    }

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

      const updatedBlocks = blocks.map((item) => {
        if (item.id !== blockId) {
          return item;
        }

        return {
          ...item,
          type: 'page' as const,
          content: data.title || pageTitle,
          pageId: data.id,
        };
      });

      setBlocks(updatedBlocks);

      const { data: updatedTask } = await api.patch<TaskResponse>(`/tasks/${taskId}`, {
        title: title.trim() || 'Новая задача',
        status: taskStatus,
        startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : null,
        deadline: deadline ? new Date(`${deadline}T00:00:00.000Z`).toISOString() : null,
        order_index: taskOrderIndex,
        assignees,
        blocks: packTaskBlocks(updatedBlocks, assignees),
        expected_updated_at: taskUpdatedAt || undefined,
      });

      const updatedAt = String(updatedTask?.updated_at || updatedTask?.updatedAt || '');
      if (updatedAt) {
        setTaskUpdatedAt(updatedAt);
      }

      router.push(buildPageEditorUrl(projectId, data.id));
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Не удалось создать страницу проекта из задачи'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, blockId: string) => {
    if (isReadOnly) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newId = createBlock('text', blockId);
      focusBlock(newId);
      return;
    }

    if (e.key === 'Backspace' && blocks.length > 1) {
      const currentBlock = blocks.find((b) => b.id === blockId);
      if (currentBlock && currentBlock.content === '') {
        e.preventDefault();
        removeBlock(blockId);
      }
    }
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

  const handleMediaUploaded = async (
    blockId: string,
    media: { fileUrl: string; fileName: string; fileType: string; fileSize: number },
  ) => {
    if (isReadOnly) return;

    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? {
              ...b,
              content: media.fileUrl,
              fileUrl: media.fileUrl,
              fileName: media.fileName,
              fileType: media.fileType,
            }
          : b,
      ),
    );

    if (projectId) {
      try {
        await api.post('/project-files', {
          project_id: projectId,
          url: media.fileUrl,
          type: media.fileType,
          name: media.fileName,
          size: media.fileSize,
        });
      } catch (error) {
        setSaveError(getApiErrorMessage(error, 'Не удалось зарегистрировать файл задачи'));
      }
    }

    const nextBlockId = createBlock('text', blockId);
    focusBlock(nextBlockId);
  };

  const handleRemoveFile = (blockId: string) => {
    if (isReadOnly) return;

    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? {
              ...b,
              content: '',
              fileUrl: undefined,
              fileName: undefined,
              fileType: undefined,
            }
          : b,
      ),
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (isReadOnly) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setBlocks((items) => {
      const oldIndex = items.findIndex((item) => item.id === String(active.id));
      const newIndex = items.findIndex((item) => item.id === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleSaveTaskAndOpenPage = async () => {
    if (isReadOnly || isSavingAndRedirecting) {
      return;
    }

    if (!selectedProjectId) {
      setSaveError('Выберите проект');
      return;
    }

    if (!selectedStageId) {
      setSaveError('Выберите этап проекта');
      return;
    }

    setSaveError(null);
    setIsSavingAndRedirecting(true);

    try {
      const { data } = await api.patch<TaskResponse>(`/tasks/${taskId}`, {
        title: title.trim() || 'Новая задача',
        status: taskStatus,
        startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : null,
        deadline: deadline ? new Date(`${deadline}T00:00:00.000Z`).toISOString() : null,
        stage_id: selectedStageId,
        order_index: taskOrderIndex,
        assignees,
        blocks: autosaveBlocks,
        expected_updated_at: taskUpdatedAt || undefined,
      });

      if (data?.updated_at || data?.updatedAt) {
        setTaskUpdatedAt(String(data.updated_at || data.updatedAt || ''));
      }
      if (data?.project_id) {
        setProjectId(String(data.project_id));
        setSelectedProjectId(String(data.project_id));
      }
      if (data?.stage_id) {
        setStageId(String(data.stage_id));
        setSelectedStageId(String(data.stage_id));
      }

      if (taskDetailsPath) {
        router.push(taskDetailsPath);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Не удалось сохранить задачу'));
    } finally {
      setIsSavingAndRedirecting(false);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-16 py-12">
          <div className="mb-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (returnToPath) {
                  router.push(returnToPath);
                  return;
                }
                if (taskDetailsPath) {
                  router.push(taskDetailsPath);
                  return;
                }
                if (projectId) {
                  router.push(`/project-overview/${projectId}`);
                  return;
                }
                router.back();
              }}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              ← Назад
            </button>
            <EditorModeBadge role={editorRole} />
          </div>

          {saveError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </div>
          )}
          {!saveError && saveStatus === 'error' && autosaveError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {autosaveError}
            </div>
          )}

          <textarea
            value={title}
            onChange={(e) => {
              if (!isReadOnly) {
                setTitle(e.target.value);
              }
            }}
            readOnly={isReadOnly}
            placeholder="Новая задача"
            rows={1}
            className="w-full text-5xl font-bold text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 border-none outline-none resize-none overflow-hidden bg-transparent mb-6 py-2"
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
          />

          <div className="mb-6 text-xs text-gray-400 dark:text-gray-500">
            {isLoadingTask ? 'Loading task...' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? (autosaveError || 'Изменения не сохранены') : ''}
          </div>

          <div className="space-y-1 mb-8">
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

            <div className="flex items-center group py-1">
              <div className="w-40 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <span className="text-sm">Проект</span>
              </div>
              <div className="flex-1">
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setSelectedStageId('');
                  }}
                  disabled={isReadOnly || isLoadingProjects || isSavingAndRedirecting}
                  className="w-full text-sm text-gray-700 dark:text-gray-300 bg-transparent border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 focus:ring-0"
                >
                  <option value="">{isLoadingProjects ? 'Загрузка проектов...' : 'Выберите проект'}</option>
                  {projectOptions.map((projectOption) => (
                    <option key={projectOption.id} value={projectOption.id}>
                      {projectOption.title || 'Без названия'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center group py-1">
              <div className="w-40 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <span className="text-sm">Этап проекта</span>
              </div>
              <div className="flex-1">
                <select
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(e.target.value)}
                  disabled={isReadOnly || !selectedProjectId || isLoadingStages || isSavingAndRedirecting}
                  className="w-full text-sm text-gray-700 dark:text-gray-300 bg-transparent border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 focus:ring-0"
                >
                  <option value="">{isLoadingStages ? 'Загрузка этапов...' : 'Выберите этап'}</option>
                  {stageOptions.map((stageOption) => (
                    <option key={stageOption.id} value={stageOption.id}>
                      {stageOption.title || 'Без названия'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800 mb-8" />

          <div className="space-y-1 pb-20">
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
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
                        <BlockRenderer
                          block={block}
                          readOnly={isReadOnly}
                          registerRef={registerRef}
                          onTextChange={handleTextBlockChange}
                          onTextKeyDown={handleTextBlockKeyDown}
                          onKeyDown={handleKeyDown}
                          onFocus={() => undefined}
                          onToggleSubtask={toggleSubtask}
                          onOpenPage={handleOpenPageBlock}
                          onMediaUploaded={handleMediaUploaded}
                          onRemoveFile={handleRemoveFile}
                        />
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

          <div className="pb-16 flex gap-3">
            <button
              type="button"
              onClick={() => void handleSaveTaskAndOpenPage()}
              disabled={isReadOnly || isSavingAndRedirecting || !selectedProjectId || !selectedStageId}
              className="w-full bg-gray-900 hover:bg-black text-white rounded-full py-4 px-6 font-bold transition-colors"
            >
              {isSavingAndRedirecting ? 'Сохраняем задачу...' : 'Сохранить задачу'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
