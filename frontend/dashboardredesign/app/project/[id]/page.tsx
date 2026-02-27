'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useParams, useSearchParams } from 'next/navigation';
import { ChevronRight, Clock, Users, AlertCircle, Send, Share2, Copy, X, Search, UserPlus, Calendar, ChevronDown, Paperclip, Star, Check, FileText } from 'lucide-react';
import Header from '@/components/header';
import ResponsiblePersonsModal from '@/components/responsible-persons-modal';
import DelayReportsModal from '@/components/delay-reports-modal';
import LoadingSplash from '@/components/loading-splash';
import { api, getApiErrorMessage, getApiStatus, getCurrentUserId } from '@/lib/api';
import { packTaskBlocks, unpackTaskBlocks, type EditorBlock } from '@/components/editor/taskBlockMeta';
import { uploadChatAttachment } from '@/lib/chats';
import type { HierarchyTreeNode } from '@/lib/users';
import { getDisplayNameFromEmail, getFileUrl } from '@/lib/utils';

type TaskResponse = {
  id: string;
  stage_id: string;
  project_id: string;
  title: string;
  status: string;
  start_date?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  blocks?: unknown;
  updated_at?: string;
  updatedAt?: string;
};

type ProjectMemberEntity = {
  user: {
    id: string;
    email: string;
  };
  role: 'owner' | 'manager' | 'member';
};

type UserDirectoryEntity = {
  id: string;
  email: string;
  full_name?: string | null;
};

type DelayReportEntity = {
  id: string;
  task_id?: string | null;
  taskId?: string | null;
  message: string;
  created_at?: string;
  createdAt?: string;
};

type TaskCommentEntity = {
  id: string;
  message: string;
  created_at?: string;
  createdAt?: string;
  author?: {
    email?: string;
  };
};

type TaskHistoryEntity = {
  id: string;
  message: string;
  created_at?: string;
  createdAt?: string;
  author?: {
    email?: string;
  };
};

type TaskViewStage = {
  title: string;
  description: string;
  status: string;
  days?: string;
};

type TaskViewData = {
  title: string;
  deadline: string;
  startDate: string;
  responsible: string[];
  issue: string;
  preparation: string[];
  stages: TaskViewStage[];
};

function formatTaskDate(input?: string | null) {
  if (!input) return '—';
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return String(input);
  }
  return parsed.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function toDateInputValue(input?: string | null) {
  if (!input) return '';
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function getRoleLabel(role?: string) {
  if (role === 'owner') return 'Владелец';
  if (role === 'manager') return 'Менеджер';
  return 'Участник проекта';
}

function normalizeAssigneeIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))).sort();
}

function buildHierarchyUserDirectory(tree: HierarchyTreeNode[]): Record<string, { name: string; roleLabel: string }> {
  const directory: Record<string, { name: string; roleLabel: string }> = {};

  const walk = (nodes: HierarchyTreeNode[]) => {
    nodes.forEach((node) => {
      const userId = String(node.user_id || '').trim();
      if (userId) {
        const fullName = String(node.user?.full_name || '').trim();
        const email = String(node.user?.email || '').trim();
        const roleTitle = String(node.role_title || '').trim();
        const fallbackRole = node.type === 'company' ? 'Генеральный директор' : 'Сотрудник';
        const name =
          fullName
          || (email ? getDisplayNameFromEmail(email) : '')
          || String(node.title || '').trim()
          || 'Сотрудник';

        const existing = directory[userId];
        if (!existing || (!existing.roleLabel && roleTitle)) {
          directory[userId] = {
            name,
            roleLabel: roleTitle || fallbackRole,
          };
        }
      }

      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children);
      }
    });
  };

  walk(Array.isArray(tree) ? tree : []);
  return directory;
}

function isOverdueReasonMessage(message?: string | null) {
  const normalized = String(message || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized.includes('почему просрочка')
    || normalized.includes('причина просрочки')
    || normalized.includes('кто автор')
    || normalized.includes('кто пишет');
}

function parseOverdueReasonMessage(message?: string | null) {
  const text = String(message || '').trim();
  if (!text) {
    return '';
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.toLowerCase().startsWith('почему просрочка:') || line.toLowerCase().startsWith('причина просрочки:')) {
      return line.replace(/^(почему просрочка:|причина просрочки:)/i, '').trim();
    }
  }

  const oneLine = text.replace(/\s+/g, ' ').trim();
  const reasonMatch = oneLine.match(/(?:почему просрочка:|причина просрочки:)\s*(.+)$/i);
  if (reasonMatch?.[1]?.trim()) {
    return reasonMatch[1].trim();
  }

  const cleaned = lines
    .filter((line) => !line.toLowerCase().startsWith('кто автор:') && !line.toLowerCase().startsWith('кто пишет:'))
    .join(' ')
    .trim();

  return cleaned || text;
}

function formatTaskHistoryMessage(message?: string | null) {
  const text = String(message || '').trim();
  if (!text) {
    return '';
  }

  if (!isOverdueReasonMessage(text)) {
    return text;
  }

  if (/^(почему просрочка:|причина просрочки:)/i.test(text)) {
    return text;
  }

  const parsedReason = parseOverdueReasonMessage(text);
  if (!parsedReason) {
    return text;
  }

  return `Почему просрочка: ${parsedReason}`;
}

function parseTaskCommentMessage(message?: string | null) {
  const lines = String(message || '').split('\n');
  const attachments: string[] = [];
  const textLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const direct = line.replace(/^[-•]\s*/, '');
    const isAttachment = /^https?:\/\//i.test(direct) || direct.startsWith('/uploads/');

    if (line === 'Вложения:' || line === 'Attachments:') {
      continue;
    }

    if (isAttachment) {
      attachments.push(direct);
      continue;
    }

    textLines.push(rawLine);
  }

  return {
    text: textLines.join('\n').trim(),
    attachments,
  };
}

function resolveTaskAttachmentUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return getFileUrl(url) || url;
}

function getTaskAttachmentName(url: string) {
  const clean = String(url || '').split('?')[0];
  const chunks = clean.split('/').filter(Boolean);
  const last = chunks[chunks.length - 1] || 'attachment';
  return decodeURIComponent(last);
}

export default function TaskDetail() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = String(params.id || '');
  const isTaskPage = rawId.startsWith('task-');
  const taskId = isTaskPage ? rawId.slice(5) : '';
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [isCompleteConfirmOpen, setIsCompleteConfirmOpen] = useState(false);
  const [isPostponeConfirmOpen, setIsPostponeConfirmOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [delegateDueDate, setDelegateDueDate] = useState('');
  const [delegatePriority, setDelegatePriority] = useState('Высокий');
  const [delegateComment, setDelegateComment] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
  const [isDelayReportsModalOpen, setIsDelayReportsModalOpen] = useState(false);
  const [task, setTask] = useState<TaskResponse | null>(null);
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [taskBlocks, setTaskBlocks] = useState<EditorBlock[]>([]);
  const [taskComments, setTaskComments] = useState<TaskCommentEntity[]>([]);
  const [taskHistory, setTaskHistory] = useState<TaskHistoryEntity[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<File[]>([]);
  const [isMentionMenuOpen, setIsMentionMenuOpen] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isUpdatingTaskStatus, setIsUpdatingTaskStatus] = useState(false);
  const [isDelegatingTask, setIsDelegatingTask] = useState(false);
  const [taskActionMessage, setTaskActionMessage] = useState<string | null>(null);
  const [showCompletedStages, setShowCompletedStages] = useState(false);
  const [taskDelayReason, setTaskDelayReason] = useState<string | null>(null);
  const [taskProjectTitle, setTaskProjectTitle] = useState('');
  const [projectMembers, setProjectMembers] = useState<ProjectMemberEntity[]>([]);
  const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
  const [assigneeSelection, setAssigneeSelection] = useState<string[]>([]);
  const [isSavingAssignees, setIsSavingAssignees] = useState(false);
  const [allUsers, setAllUsers] = useState<UserDirectoryEntity[]>([]);
  const [hierarchyUserDirectory, setHierarchyUserDirectory] = useState<Record<string, { name: string; roleLabel: string }>>({});
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [isTaskNotFound, setIsTaskNotFound] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [highlightedTaskCommentId, setHighlightedTaskCommentId] = useState<string | null>(null);
  const commentDocInputRef = useRef<HTMLInputElement | null>(null);
  const commentImageInputRef = useRef<HTMLInputElement | null>(null);
  const taskCommentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasHandledTaskCommentAnchorRef = useRef(false);
  const currentUserId = getCurrentUserId();

  const selectedAssigneeFromHierarchy = useMemo(
    () => String(searchParams.get('selectedAssignee') || '').trim(),
    [searchParams],
  );
  const targetCommentIdFromQuery = useMemo(
    () => String(searchParams.get('commentId') || '').trim(),
    [searchParams],
  );

  useEffect(() => {
    hasHandledTaskCommentAnchorRef.current = false;
  }, [targetCommentIdFromQuery]);

  useEffect(() => {
    if (!isTaskPage || !taskId) {
      setTask(null);
      setTaskAssignees([]);
      setTaskBlocks([]);
      setTaskComments([]);
      setTaskHistory([]);
      setTaskError(null);
      setIsTaskNotFound(false);
      return;
    }

    let cancelled = false;

    const loadTask = async () => {
      setIsLoadingTask(true);
      setTaskError(null);
      setIsTaskNotFound(false);

      try {
        const [{ data }, { data: commentsData }, { data: historyData }] = await Promise.all([
          api.get<TaskResponse>(`/tasks/${taskId}`),
          api.get<TaskCommentEntity[]>(`/tasks/${taskId}/comments`),
          api.get<TaskHistoryEntity[]>(`/tasks/${taskId}/history`),
        ]);
        if (cancelled) {
          return;
        }

        setTask(data);
        const unpacked = unpackTaskBlocks(data?.blocks);
        setTaskAssignees(unpacked.assignees);
        setTaskBlocks(unpacked.blocks);
        setTaskComments(Array.isArray(commentsData) ? commentsData : []);
        setTaskHistory(Array.isArray(historyData) ? historyData : []);
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (getApiStatus(error) === 404) {
          setIsTaskNotFound(true);
          setTask(null);
          setTaskAssignees([]);
          return;
        }
        setTaskError(getApiErrorMessage(error, 'Не удалось загрузить задачу'));
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
  }, [isTaskPage, taskId]);

  const refreshTaskDelayReason = useCallback(async () => {
    if (!isTaskPage || !task?.project_id || !task?.id) {
      setTaskDelayReason(null);
      return;
    }

    try {
      const { data } = await api.get<DelayReportEntity[]>(`/projects/${task.project_id}/delay-report`);
      const reports = Array.isArray(data) ? data : [];
      const filtered = reports.filter((report) => {
        const reportTaskId = (report.task_id || report.taskId || '').trim();
        return reportTaskId === task.id && isOverdueReasonMessage(report.message);
      });

      const latest = [...filtered].sort((a, b) => {
        const aTime = new Date(a.created_at || a.createdAt || '').getTime();
        const bTime = new Date(b.created_at || b.createdAt || '').getTime();
        return bTime - aTime;
      })[0];

      setTaskDelayReason(latest?.message?.trim() || null);
    } catch {
      setTaskDelayReason(null);
    }
  }, [isTaskPage, task?.id, task?.project_id]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      await refreshTaskDelayReason();
      if (cancelled) {
        return;
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshTaskDelayReason]);

  useEffect(() => {
    if (!isTaskPage || !task?.project_id) {
      setProjectMembers([]);
      setAllUsers([]);
      setHierarchyUserDirectory({});
      return;
    }

    let cancelled = false;

    const loadMembers = async () => {
      const [membersResult, usersResult, hierarchyResult] = await Promise.allSettled([
        api.get<ProjectMemberEntity[]>(`/projects/${task.project_id}/members`),
        api.get<UserDirectoryEntity[]>('/users'),
        api.get<{ tree?: HierarchyTreeNode[] }>('/hierarchy/tree'),
      ]);

      if (cancelled) {
        return;
      }

      const membersData = membersResult.status === 'fulfilled' ? membersResult.value.data : [];
      const usersData = usersResult.status === 'fulfilled' ? usersResult.value.data : [];
      const hierarchyTree = hierarchyResult.status === 'fulfilled' ? (hierarchyResult.value.data?.tree || []) : [];

      setProjectMembers(Array.isArray(membersData) ? membersData : []);
      setAllUsers(Array.isArray(usersData) ? usersData : []);
      setHierarchyUserDirectory(buildHierarchyUserDirectory(Array.isArray(hierarchyTree) ? hierarchyTree : []));
    };

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [isTaskPage, task?.project_id]);

  useEffect(() => {
    if (!isTaskPage || !selectedAssigneeFromHierarchy) {
      return;
    }

    setAssigneeSelection((prev) => {
      const fromTask = taskAssignees.map((id) => String(id || '').trim()).filter(Boolean);
      const base = prev.length > 0 ? prev : fromTask;
      const merged = new Set(base.map((id) => String(id || '').trim()).filter(Boolean));
      merged.add(selectedAssigneeFromHierarchy);
      return Array.from(merged);
    });
    setIsAssigneeModalOpen(true);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('selectedAssignee');
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl);
  }, [isTaskPage, pathname, router, searchParams, selectedAssigneeFromHierarchy, taskAssignees]);

  useEffect(() => {
    if (!isTaskPage || !task?.project_id) {
      setTaskProjectTitle('');
      return;
    }

    let cancelled = false;

    const loadProjectTitle = async () => {
      try {
        const { data } = await api.get<{ title?: string }>(`/projects/${task.project_id}`);
        if (cancelled) return;
        setTaskProjectTitle(String(data?.title || ''));
      } catch {
        if (!cancelled) {
          setTaskProjectTitle('');
        }
      }
    };

    void loadProjectTitle();

    return () => {
      cancelled = true;
    };
  }, [isTaskPage, task?.project_id]);

  useEffect(() => {
    if (!isTaskPage || !targetCommentIdFromQuery) {
      return;
    }
    if (hasHandledTaskCommentAnchorRef.current) {
      return;
    }

    if (activeTab !== 'comments') {
      setActiveTab('comments');
      return;
    }

    const exists = taskComments.some((item) => String(item.id || '').trim() === targetCommentIdFromQuery);
    if (!exists) {
      return;
    }

    const targetNode = taskCommentRefs.current[targetCommentIdFromQuery];
    if (!targetNode) {
      return;
    }

    setHighlightedTaskCommentId(targetCommentIdFromQuery);
    targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    hasHandledTaskCommentAnchorRef.current = true;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('commentId');
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl);

    const timeoutID = window.setTimeout(() => {
      setHighlightedTaskCommentId((prev) => (prev === targetCommentIdFromQuery ? null : prev));
    }, 2600);

    return () => {
      window.clearTimeout(timeoutID);
    };
  }, [activeTab, isTaskPage, pathname, router, searchParams, targetCommentIdFromQuery, taskComments]);

  const currentTaskUserRole = useMemo<'owner' | 'manager' | 'member'>(() => {
    const matchedMember = projectMembers.find((member) => member.user.id === currentUserId);
    return matchedMember?.role || 'member';
  }, [currentUserId, projectMembers]);

  const currentUserEmail = useMemo(() => {
    const matchedMember = projectMembers.find((member) => member.user.id === currentUserId);
    return String(matchedMember?.user.email || '').trim().toLowerCase();
  }, [currentUserId, projectMembers]);

  const isCurrentUserTaskAssignee = useMemo(() => {
    const normalizedAssignees = new Set(taskAssignees.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean));
    const normalizedUserID = String(currentUserId || '').trim().toLowerCase();
    if (normalizedUserID && normalizedAssignees.has(normalizedUserID)) {
      return true;
    }
    if (currentUserEmail && normalizedAssignees.has(currentUserEmail)) {
      return true;
    }
    return false;
  }, [currentUserEmail, currentUserId, taskAssignees]);

  const canInviteToTask = isTaskPage
    && (currentTaskUserRole === 'owner' || currentTaskUserRole === 'manager' || isCurrentUserTaskAssignee);
  const canDelegateTask = isTaskPage
    && (currentTaskUserRole === 'owner' || currentTaskUserRole === 'manager' || isCurrentUserTaskAssignee);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    const usersById = new Map(allUsers.map((user) => [String(user.id || '').trim(), user]));

    projectMembers.forEach((member) => {
      const memberId = String(member.user.id || '').trim();
      const hierarchyInfo = hierarchyUserDirectory[memberId];
      const userFromDirectory = usersById.get(memberId);
      const fullName = String(userFromDirectory?.full_name || '').trim();
      const email = String(userFromDirectory?.email || member.user.email || '').trim();

      map.set(
        memberId,
        hierarchyInfo?.name
        || fullName
        || (email ? getDisplayNameFromEmail(email) : 'Сотрудник'),
      );
    });
    return map;
  }, [allUsers, hierarchyUserDirectory, projectMembers]);

  const visibleTaskAssignees = useMemo(() => {
    const usersById = new Map(allUsers.map((user) => [String(user.id || '').trim(), user]));

    return taskAssignees.map((assignee) => {
      const normalized = String(assignee || '').trim();
      if (!normalized) return 'Сотрудник';

      const hierarchyInfo = hierarchyUserDirectory[normalized];
      if (hierarchyInfo?.name) {
        return hierarchyInfo.name;
      }

      const fromMembers = memberNameById.get(normalized);
      if (fromMembers) {
        return fromMembers;
      }

      const userFromDirectory = usersById.get(normalized);
      const fullName = String(userFromDirectory?.full_name || '').trim();
      const email = String(userFromDirectory?.email || '').trim();
      if (fullName) return fullName;
      if (email) return getDisplayNameFromEmail(email);
      return 'Сотрудник';
    });
  }, [allUsers, hierarchyUserDirectory, memberNameById, taskAssignees]);

  const assigneeCandidates = useMemo(() => {
    const base = projectMembers.map((member) => ({
      id: member.user.id,
      name: memberNameById.get(member.user.id) || getDisplayNameFromEmail(member.user.email),
      roleLabel: getRoleLabel(member.role),
    }));

    const knownIds = new Set(base.map((item) => item.id));
    const allUsersById = new Map(allUsers.map((user) => [String(user.id || '').trim(), user]));

    assigneeSelection.forEach((id) => {
      const normalized = String(id || '').trim();
      if (!normalized || knownIds.has(normalized)) {
        return;
      }

      const hierarchyInfo = hierarchyUserDirectory[normalized];
      const userFromDirectory = allUsersById.get(normalized);
      const fullName = String(userFromDirectory?.full_name || '').trim();
      const email = String(userFromDirectory?.email || '').trim();

      base.push({
        id: normalized,
        name:
          hierarchyInfo?.name
          || fullName
          || (email ? getDisplayNameFromEmail(email) : 'Сотрудник'),
        roleLabel: hierarchyInfo?.roleLabel || 'Роль не указана',
      });
      knownIds.add(normalized);
    });

    return base;
  }, [allUsers, assigneeSelection, hierarchyUserDirectory, memberNameById, projectMembers]);

  const toggleAssignee = (memberId: string) => {
    setAssigneeSelection((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const handleAddProjectMember = async (userId: string) => {
    if (!task?.project_id || isAddingMember) return;
    setIsAddingMember(true);
    setTaskError(null);
    try {
      await api.post(`/projects/${task.project_id}/members`, {
        userId,
        role: 'member',
      });
      const { data: membersData } = await api.get<ProjectMemberEntity[]>(
        `/projects/${task.project_id}/members`
      );
      setProjectMembers(Array.isArray(membersData) ? membersData : []);
      setMemberSearchQuery('');
    } catch (error) {
      setTaskError(getApiErrorMessage(error, 'Не удалось добавить участника'));
    } finally {
      setIsAddingMember(false);
    }
  };

  const nonMemberUsers = useMemo(() => {
    const memberIds = new Set(projectMembers.map((m) => m.user.id));
    return allUsers.filter(
      (u) => !memberIds.has(u.id) &&
        getDisplayNameFromEmail(u.email).toLowerCase().includes(memberSearchQuery.toLowerCase())
    );
  }, [allUsers, projectMembers, memberSearchQuery]);

  const openHierarchyAssigneePicker = useCallback(() => {
    if (!isTaskPage) {
      return;
    }

    const currentTaskPath = `/project/${rawId}`;
    const params = new URLSearchParams({
      mode: 'pick-assignee',
      returnTo: currentTaskPath,
    });
    router.push(`/hierarchy?${params.toString()}`);
  }, [isTaskPage, rawId, router]);

  const hasPendingAssigneeChanges = useMemo(() => {
    const selected = normalizeAssigneeIds(assigneeSelection);
    const current = normalizeAssigneeIds(taskAssignees);
    if (selected.length !== current.length) {
      return true;
    }
    return selected.some((id, index) => id !== current[index]);
  }, [assigneeSelection, taskAssignees]);

  const saveTaskAssignees = async ({ closeAfterSave = true }: { closeAfterSave?: boolean } = {}) => {
    if (!task || isSavingAssignees) {
      return false;
    }

    const unpacked = unpackTaskBlocks(task.blocks);
    const normalizedAssignees = normalizeAssigneeIds(assigneeSelection);

    setIsSavingAssignees(true);
    setTaskError(null);
    try {
      const { data } = await api.patch<TaskResponse>(`/tasks/${task.id}`, {
        title: task.title,
        status: task.status,
        startDate: task.start_date || task.startDate || null,
        deadline: task.deadline || null,
        assignmentMode: 'assignee',
        assignees: normalizedAssignees,
        blocks: packTaskBlocks(unpacked.blocks, normalizedAssignees),
        expected_updated_at: task.updated_at || task.updatedAt,
      });

      setTask(data || task);
      setTaskAssignees(normalizedAssignees);
      if (closeAfterSave) {
        setIsAssigneeModalOpen(false);
      }
      return true;
    } catch (error) {
      setTaskError(getApiErrorMessage(error, 'Не удалось назначить ответственных по задаче'));
      return false;
    } finally {
      setIsSavingAssignees(false);
    }
  };

  const closeAssigneeModal = useCallback(() => {
    if (isSavingAssignees) {
      return;
    }
    if (!hasPendingAssigneeChanges) {
      setIsAssigneeModalOpen(false);
      return;
    }
    void saveTaskAssignees({ closeAfterSave: true });
  }, [hasPendingAssigneeChanges, isSavingAssignees, saveTaskAssignees]);

  const refreshTaskContext = async () => {
    if (!task?.id) {
      return;
    }

    const [{ data }, { data: commentsData }, { data: historyData }] = await Promise.all([
      api.get<TaskResponse>(`/tasks/${task.id}`),
      api.get<TaskCommentEntity[]>(`/tasks/${task.id}/comments`),
      api.get<TaskHistoryEntity[]>(`/tasks/${task.id}/history`),
    ]);

    setTask(data || task);
    const unpacked = unpackTaskBlocks(data?.blocks);
    setTaskAssignees(unpacked.assignees);
    setTaskBlocks(unpacked.blocks);
    setTaskComments(Array.isArray(commentsData) ? commentsData : []);
    setTaskHistory(Array.isArray(historyData) ? historyData : []);
  };

  const updateTaskStatus = async (nextStatus: 'done' | 'in_progress' | 'delayed') => {
    if (!task) {
      return;
    }

    setIsUpdatingTaskStatus(true);
    setTaskError(null);
    try {
      await api.patch(`/tasks/${task.id}`, {
        title: task.title,
        status: nextStatus,
        startDate: task.start_date || task.startDate || null,
        deadline: task.deadline || null,
        assignees: taskAssignees,
        blocks: packTaskBlocks(taskBlocks, taskAssignees),
        expected_updated_at: task.updated_at || task.updatedAt,
      });

      await refreshTaskContext();
      if (nextStatus === 'done') {
        setTaskActionMessage('Задача успешно завершена. Возвращаемся на дашборд...');
        window.setTimeout(() => {
          router.push('/dashboard');
        }, 900);
      } else {
        setTaskActionMessage(
          nextStatus === 'delayed'
            ? 'Задача отложена'
            : 'Статус задачи обновлен',
        );
      }
    } catch (error) {
      setTaskError(getApiErrorMessage(error, 'Не удалось обновить статус задачи'));
    } finally {
      setIsUpdatingTaskStatus(false);
    }
  };

  const isTaskDone = (task?.status || '').toLowerCase() === 'done' || (task?.status || '').toLowerCase() === 'completed';
  const isTaskDelayed = (task?.status || '').toLowerCase() === 'delayed';

  const sendTaskComment = async () => {
    const text = commentText.trim();
    if (!task?.id || (!text && commentAttachments.length === 0) || isSendingComment) {
      return;
    }

    setIsSendingComment(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of commentAttachments) {
        const uploaded = await uploadChatAttachment(file);
        uploadedUrls.push(uploaded.url);
      }

      const filesText = uploadedUrls.length
        ? `Вложения:\n${uploadedUrls.map((url) => `- ${url}`).join('\n')}`
        : '';

      const message = [text, filesText].filter(Boolean).join('\n\n');
      await api.post(`/tasks/${task.id}/comment`, { message });
      setCommentText('');
      setCommentAttachments([]);
      setIsMentionMenuOpen(false);
      await refreshTaskContext();
    } catch (error) {
      setTaskError(getApiErrorMessage(error, 'Не удалось отправить комментарий'));
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleCommentFilesPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setCommentAttachments((prev) => [...prev, ...files]);
    event.target.value = '';
  };

  const removeCommentAttachment = (index: number) => {
    setCommentAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const insertMention = (rawValue: string) => {
    const mentionValue = String(rawValue || '').trim().split(/\s+/)[0] || '';
    if (!mentionValue) {
      return;
    }

    setCommentText((prev) => {
      const suffix = prev && !prev.endsWith(' ') ? ' ' : '';
      return `${prev}${suffix}@${mentionValue} `;
    });
    setIsMentionMenuOpen(false);
  };

  const mentionableMembers = useMemo(
    () => projectMembers.filter((member) => member.user.id !== currentUserId),
    [currentUserId, projectMembers],
  );

  const dynamicPreparation = useMemo(() => {
    if (!isTaskPage) {
      return [] as string[];
    }

    return taskBlocks
      .filter((block) => block.type === 'text')
      .map((block) => String(block.content || '').trim())
      .filter(Boolean);
  }, [isTaskPage, taskBlocks]);

  const orderedTaskContentBlocks = useMemo(() => {
    if (!isTaskPage) {
      return [] as EditorBlock[];
    }

    return taskBlocks.filter((block) => {
      if (block.type === 'subtask') {
        return false;
      }
      if (block.type === 'page') {
        const rawPageId = String(block.pageId || (block as EditorBlock & { page_id?: string }).page_id || '').trim();
        return Boolean(String(block.content || '').trim() || rawPageId);
      }
      if (block.type === 'image' || block.type === 'video' || block.type === 'file') {
        return Boolean(String(block.fileUrl || block.content || '').trim());
      }
      return Boolean(String(block.content || '').trim());
    });
  }, [isTaskPage, taskBlocks]);

  const dynamicStages = useMemo<TaskViewStage[]>(() => {
    if (!isTaskPage) {
      return [] as TaskViewStage[];
    }

    return taskBlocks
      .filter((block) => block.type === 'subtask')
      .map((block) => {
        const isDone = Boolean(block.isCompleted);
        return {
          title: String(block.content || '').trim() || 'Подзадача',
          description: '',
          status: isDone ? 'Выполнено' : 'В работе',
        };
      });
  }, [isTaskPage, taskBlocks]);

  const teamMembers = [
    ...projectMembers
      .filter((member) => member.user.id !== currentUserId)
      .map((member) => ({
        id: member.user.id,
        name: getDisplayNameFromEmail(member.user.email),
        role: member.role,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.user.email)}`,
        status: 'available' as const,
        statusText: getRoleLabel(member.role),
      })),
  ];

  const filteredMembers = teamMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelegateTask = async () => {
    if (!task || !selectedPerson || isDelegatingTask) {
      return;
    }

    if (!canDelegateTask) {
      setTaskError('Делегировать задачу может owner, manager или назначенный исполнитель');
      return;
    }

    const delegatedTo = String(selectedPerson || '').trim();
    if (!delegatedTo) {
      return;
    }

    setIsDelegatingTask(true);
    setTaskError(null);
    try {
      await api.patch(`/tasks/${task.id}`, {
        title: task.title,
        status: 'in_progress',
        startDate: task.start_date || task.startDate || null,
        deadline: delegateDueDate ? new Date(`${delegateDueDate}T00:00:00.000Z`).toISOString() : (task.deadline || null),
        assignmentMode: 'delegation',
        assignees: [delegatedTo],
        blocks: packTaskBlocks(taskBlocks, [delegatedTo]),
        expected_updated_at: task.updated_at || task.updatedAt,
      });

      await refreshTaskContext();
      setTaskActionMessage('Задача успешно делегирована');
      setIsDelegateModalOpen(false);
      setSelectedPerson(null);
      setSearchQuery('');
      setDelegateComment('');
      setDelegateDueDate('');
    } catch (error) {
      setTaskError(getApiErrorMessage(error, 'Не удалось делегировать задачу'));
    } finally {
      setIsDelegatingTask(false);
    }
  };

  const taskData: TaskViewData = {
    title: '',
    deadline: '—',
    startDate: 'Дата начала: —',
    responsible: [],
    issue: '',
    preparation: [],
    stages: [],
  };

  const displayTaskData = useMemo(() => {
    if (!isTaskPage) {
      return taskData;
    }

    if (!task) {
      return {
        ...taskData,
        responsible: visibleTaskAssignees,
        issue: taskDelayReason || '',
        preparation: dynamicPreparation,
        stages: dynamicStages,
      };
    }

    return {
      ...taskData,
      title: task.title || '',
      deadline: formatTaskDate(task.deadline),
      startDate: `Дата начала: ${formatTaskDate(task.start_date || task.startDate)}`,
      responsible: visibleTaskAssignees,
      issue: taskDelayReason || '',
      preparation: dynamicPreparation,
      stages: dynamicStages,
    };
  }, [dynamicPreparation, dynamicStages, isTaskPage, task, taskDelayReason, visibleTaskAssignees]);

  const completedStagesCount = useMemo(
    () => displayTaskData.stages.filter((stage) => stage.status === 'Выполнено').length,
    [displayTaskData.stages],
  );

  const visibleStages = useMemo(() => {
    if (showCompletedStages) {
      return displayTaskData.stages;
    }
    return displayTaskData.stages.filter((stage) => stage.status !== 'Выполнено');
  }, [displayTaskData.stages, showCompletedStages]);

  const parsedIssue = useMemo(() => parseOverdueReasonMessage(displayTaskData.issue), [displayTaskData.issue]);

  if (isTaskPage && isLoadingTask && !task && !isTaskNotFound && !taskError) {
    return (
      <div className="min-h-screen bg-white dark:bg-background pb-20">
        <Header />
        <main className="max-w-7xl mx-auto px-6 pt-24">
          <LoadingSplash compact title="Загружаем задачу" subtitle="Подтягиваем последние данные..." />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background pb-20">
      {/* Header */}
      <Header />

      <main className="max-w-7xl mx-auto px-6 pt-24">
        {/* Top Navigation */}
        <div className="flex flex-col md:flex-row items-center gap-3 mb-10">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-semibold shadow-sm"
          >
            ← Назад
          </button>

          <div className="flex w-full md:w-auto gap-3 overflow-x-auto pb-2 md:pb-0">
            <button className="flex-1 md:flex-none bg-black dark:bg-white text-white dark:text-black px-8 py-2 rounded-full text-sm font-semibold shadow-md whitespace-nowrap">
              {isTaskPage ? 'Задача' : 'Проект'}
            </button>
            <button
              onClick={() => router.push(`/project/${params.id}/reports`)}
              className="flex-1 md:flex-none bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-8 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
            >
              Отчеты
            </button>
          </div>

          {isTaskPage && Boolean(taskId) && (
            <button
              type="button"
              onClick={() => {
                const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
                const params = new URLSearchParams({ returnTo });
                router.push(`/tasks/${taskId}/edit?${params.toString()}`);
              }}
              className="w-full md:w-auto rounded-full bg-amber-600 px-6 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors whitespace-nowrap"
            >
              Редактировать задачу
            </button>
          )}
        </div>

        {/* Title Section */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight max-w-4xl">{displayTaskData.title}</h1>
        </div>

        {isTaskPage && isLoadingTask && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <LoadingSplash compact title="Загружаем задачу" subtitle="Подтягиваем последние данные..." />
          </div>
        )}

        {isTaskPage && isTaskNotFound && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Task not found
          </div>
        )}

        {taskError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {taskError}
          </div>
        )}

        {taskActionMessage && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {taskActionMessage}
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Deadline Card */}
          <div className="bg-[#FFF4F4] dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="bg-red-500/10 dark:bg-red-400/20 p-2.5 rounded-2xl text-red-600 dark:text-red-300">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-red-900 dark:text-red-200 uppercase tracking-wide mb-1 opacity-70 dark:opacity-90">Дедлайн</p>
                <p className="text-base text-red-950 dark:text-red-100 font-bold leading-snug">{displayTaskData.deadline}</p>
                <p className="text-sm text-red-800/80 dark:text-red-200/90 mt-0.5">{displayTaskData.startDate}</p>
              </div>
            </div>
          </div>

          {/* Responsible Card */}
          <div
            onClick={() => {
              if (isTaskPage) {
                if (!canInviteToTask) {
                  return;
                }
                setAssigneeSelection(taskAssignees);
                setIsAssigneeModalOpen(true);
                return;
              }
              setIsResponsibleModalOpen(true);
            }}
            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="bg-gray-100 dark:bg-gray-700 p-2.5 rounded-2xl text-gray-600 dark:text-gray-300">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wide mb-1">Ответственные</p>
                <p className="text-base text-gray-900 dark:text-white font-bold leading-tight wrap-break-word">{displayTaskData.responsible.join(', ')}</p>
                <button
                  type="button"
                  disabled={isTaskPage && !canInviteToTask}
                  className="text-amber-600 disabled:text-gray-400 text-[11px] font-bold mt-2 flex items-center gap-1 hover:underline disabled:no-underline"
                >
                  УПРАВЛЯТЬ <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div
            onClick={() => setIsDelayReportsModalOpen(true)}
            className="bg-[#111111] rounded-[32px] p-6 shadow-xl relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-red-500/20 transition-all" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="bg-white/10 p-2.5 rounded-2xl text-white">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wide mb-1">Проблема / Статус</p>
                {displayTaskData.issue ? (
                  <div className="space-y-1.5 text-sm text-white/95 leading-relaxed">
                    <p>
                      <span className="text-white/60">Почему просрочка:</span>{' '}
                      <span className="font-semibold">{parsedIssue || displayTaskData.issue}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-white font-medium leading-relaxed">Нажмите, чтобы указать причину просрочки</p>
                )}
                <button
                  type="button"
                  onClick={() => setIsDelayReportsModalOpen(true)}
                  className="text-amber-400 text-[11px] font-bold mt-2 flex items-center gap-1 hover:underline"
                >
                  {displayTaskData.issue ? 'ПОДРОБНЕЕ' : 'НАПИСАТЬ'} <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2">
            {/* Preparation Section */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Подготовка</h2>
              {isTaskPage ? (
                orderedTaskContentBlocks.length > 0 ? (
                  <div className="space-y-4">
                    {orderedTaskContentBlocks.map((block) => {
                      const content = String(block.content || '').trim();
                      const rawMediaUrl = String(block.fileUrl || block.content || '').trim();
                      const mediaUrl = getFileUrl(rawMediaUrl) || rawMediaUrl;
                      const fileName = String(block.fileName || 'Вложение').trim() || 'Вложение';

                      if (block.type === 'text') {
                        return (
                          <p key={block.id} className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                            {content}
                          </p>
                        );
                      }

                      if (block.type === 'image') {
                        return (
                          <img
                            key={block.id}
                            src={mediaUrl}
                            alt={fileName}
                            className="w-full max-h-80 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
                          />
                        );
                      }

                      if (block.type === 'video') {
                        return (
                          <video
                            key={block.id}
                            src={mediaUrl}
                            controls
                            className="w-full max-h-80 rounded-xl border border-gray-200 dark:border-gray-700"
                          />
                        );
                      }

                      if (block.type === 'file') {
                        return (
                          <a
                            key={block.id}
                            href={mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700 hover:underline"
                          >
                            📎 {fileName}
                          </a>
                        );
                      }

                      if (block.type === 'page') {
                        const pageId = String(block.pageId || (block as EditorBlock & { page_id?: string }).page_id || '').trim();
                        const projectId = String(task?.project_id || '').trim();
                        const canOpenPage = Boolean(pageId && projectId);
                        const returnTo = (pathname && pathname.startsWith('/')) ? pathname : `/project/${rawId}`;
                        const params = new URLSearchParams({ returnTo });
                        const pageEditorPath = canOpenPage
                          ? `/project/${projectId}/editor/page/${pageId}?${params.toString()}`
                          : '';

                        return (
                          <div key={block.id} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400">
                              <FileText className="h-3.5 w-3.5" />
                            </span>
                            <button
                              type="button"
                              disabled={!canOpenPage}
                              onClick={() => {
                                if (!pageEditorPath) {
                                  return;
                                }
                                router.push(pageEditorPath);
                              }}
                              className="w-full rounded-lg px-1 py-0.5 text-left text-base font-semibold text-gray-700 underline decoration-dotted underline-offset-2 transition-colors hover:text-amber-600 disabled:cursor-not-allowed disabled:no-underline disabled:text-gray-500 dark:text-gray-300 dark:disabled:text-gray-500 cursor-pointer"
                            >
                              {content || 'Новая страница'}
                            </button>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Контент задачи пока пуст</p>
                )
              ) : displayTaskData.preparation.length > 0 ? (
                <ul className="space-y-2">
                  {displayTaskData.preparation.map((item, idx) => (
                    <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                      • {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Пока нет текстовых заметок</p>
              )}
            </div>

            {/* Stages Section */}
            {!isTaskPage && displayTaskData.stages.length > 0 && (
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Этапы выполнения</h2>
                  {completedStagesCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCompletedStages((prev) => !prev)}
                      className="text-xs px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      {showCompletedStages ? 'Скрыть выполненные' : `Показать выполненные (${completedStagesCount})`}
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {visibleStages.map((stage, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${stage.status === 'Выполнено' ? 'bg-green-100' : 'bg-orange-100'
                          }`}>
                          <div className={`w-4 h-4 rounded-full ${stage.status === 'Выполнено' ? 'bg-green-500' : 'bg-orange-500'
                            }`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{stage.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{stage.description}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${stage.status === 'Выполнено' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {stage.status}
                          </span>
                          {stage.days && <span className="text-xs text-red-600 font-semibold whitespace-nowrap">{stage.days}</span>}
                        </div>
                      </div>
                    </div>
                  ))}

                  {visibleStages.length === 0 && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-400">
                      Все этапы выполнены ✅
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1">
            {/* Action Buttons */}
            <button
              type="button"
              disabled={isTaskDone || isUpdatingTaskStatus}
              onClick={() => setIsCompleteConfirmOpen(true)}
              className="w-full bg-yellow-600 rounded-2xl p-4 text-white font-semibold text-center hover:bg-yellow-700 transition-colors mb-4 disabled:opacity-60"
            >
              {isTaskDone ? '✓ Задача завершена' : isUpdatingTaskStatus ? 'Сохраняем...' : '✓ Завершить задачу'}
            </button>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                disabled={isUpdatingTaskStatus}
                onClick={() => {
                  if (isTaskDelayed) {
                    void updateTaskStatus('in_progress');
                    return;
                  }
                  setIsPostponeConfirmOpen(true);
                }}
                className="py-3 px-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
              >
                {isTaskDelayed ? 'Возобновить' : 'Отложить'}
              </button>
              <button
                disabled={isUpdatingTaskStatus}
                onClick={() => {
                  if (!canDelegateTask) {
                    setTaskError('Делегировать задачу может owner, manager или назначенный исполнитель');
                    return;
                  }
                  setSelectedPerson(null);
                  setSearchQuery('');
                  setDelegateDueDate(toDateInputValue(task?.deadline));
                  setIsDelegateModalOpen(true);
                }}
                className="py-3 px-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
              >
                Делегировать
              </button>
            </div>

            {/* Comments Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800">
              <div className="flex gap-6 mb-6">
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`font-semibold text-base pb-1 transition-all ${activeTab === 'comments'
                    ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  Комментарии
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`font-semibold text-base pb-1 transition-all ${activeTab === 'history'
                    ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  История
                </button>
              </div>

              {activeTab === 'comments' ? (
                <>
                  <div className="space-y-4 mb-6">
                    {taskComments.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Комментариев пока нет</p>
                    ) : (
                      taskComments.map((item) => {
                        const parsed = parseTaskCommentMessage(item.message || '');
                        const commentID = String(item.id || '').trim();
                        const isHighlighted = highlightedTaskCommentId === commentID;

                        return (
                          <div
                            key={item.id}
                            id={`task-comment-${commentID}`}
                            ref={(node) => {
                              taskCommentRefs.current[commentID] = node;
                            }}
                            className={`rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-3 transition-all ${
                              isHighlighted
                                ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-900'
                                : ''
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">{getDisplayNameFromEmail(item.author?.email || 'Пользователь')}</p>
                              <p className="text-gray-500 text-xs">{formatTaskDate(item.created_at || item.createdAt)}</p>
                            </div>

                            {parsed.text ? (
                              <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap mb-2">{parsed.text}</p>
                            ) : null}

                            {parsed.attachments.length > 0 ? (
                              <div className="space-y-2">
                                {parsed.attachments.map((url, idx) => {
                                  const fullUrl = resolveTaskAttachmentUrl(url);
                                  const isImage = /\.(png|jpe?g|webp)$/i.test(fullUrl);
                                  const isVideo = /\.(mp4|mov)$/i.test(fullUrl);

                                  if (isImage) {
                                    return (
                                      <img
                                        key={`${item.id}-img-${idx}`}
                                        src={fullUrl}
                                        alt="attachment"
                                        className="w-full max-h-40 rounded-lg object-cover"
                                      />
                                    );
                                  }

                                  if (isVideo) {
                                    return (
                                      <video
                                        key={`${item.id}-video-${idx}`}
                                        src={fullUrl}
                                        controls
                                        className="w-full max-h-40 rounded-lg"
                                      />
                                    );
                                  }

                                  return (
                                    <a
                                      key={`${item.id}-file-${idx}`}
                                      href={fullUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-amber-700 hover:underline dark:border-gray-700 dark:bg-gray-900 dark:text-amber-300"
                                    >
                                      {getTaskAttachmentName(url)}
                                    </a>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Comment Input */}
                  <div className="mt-8">
                    {commentAttachments.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {commentAttachments.map((file, idx) => (
                          <span
                            key={`${file.name}-${file.size}-${idx}`}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          >
                            {file.name}
                            <button
                              type="button"
                              onClick={() => removeCommentAttachment(idx)}
                              className="text-gray-500 hover:text-red-500"
                              aria-label="Удалить файл"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-3 items-end mb-3">
                      <input
                        type="text"
                        placeholder="Напишать комментарий..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-400 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => void sendTaskComment()}
                        disabled={isSendingComment || (commentText.trim().length === 0 && commentAttachments.length === 0)}
                        className="bg-yellow-500 text-white w-10 h-10 rounded-full hover:bg-yellow-600 transition-colors flex items-center justify-center disabled:opacity-60"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="relative flex gap-4 px-4">
                      <button
                        type="button"
                        onClick={() => commentDocInputRef.current?.click()}
                        className="text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-1"
                      >
                        📄 Документы
                      </button>
                      <button
                        type="button"
                        onClick={() => commentImageInputRef.current?.click()}
                        className="text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-1"
                      >
                        📷 Фото
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsMentionMenuOpen((prev) => !prev)}
                        className="text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-1"
                      >
                        @ Упомянуть
                      </button>

                      <input
                        ref={commentDocInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,application/*"
                        className="hidden"
                        onChange={handleCommentFilesPicked}
                      />
                      <input
                        ref={commentImageInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleCommentFilesPicked}
                      />

                      {isMentionMenuOpen && (
                        <div className="absolute left-0 top-7 z-20 w-72 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                          {mentionableMembers.length === 0 ? (
                            <p className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">Нет пользователей для упоминания</p>
                          ) : (
                            mentionableMembers.map((member) => {
                              const mentionDisplayName = memberNameById.get(member.user.id) || getDisplayNameFromEmail(member.user.email);
                              return (
                                <button
                                  key={member.user.id}
                                  type="button"
                                  onClick={() => insertMention(mentionDisplayName)}
                                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                  <span className="text-sm text-gray-800 dark:text-gray-200">{mentionDisplayName}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* History Tab Content */
                <div className="space-y-1">
                  {taskHistory.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">История пока пустая</p>
                  ) : (
                    taskHistory.map((item) => (
                      <div key={item.id} className="border-l-2 border-amber-400 pl-3 py-2">
                        <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{formatTaskHistoryMessage(item.message)}</p>
                        <p className="text-xs text-gray-500 mt-1">{getDisplayNameFromEmail(item.author?.email || 'Пользователь')} • {formatTaskDate(item.created_at || item.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delegate Modal */}
        {isDelegateModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setIsDelegateModalOpen(false)}
          >
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Modal content */}
            <div
              className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Делегировать задачу</h2>
                </div>
                <button
                  onClick={() => setIsDelegateModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Modal body - Two columns */}
              <div className="flex gap-8 px-6 pb-6">
                {/* Left column - Selected task */}
                <div className="w-64 flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Выбранная задача</p>

                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Проект: {taskProjectTitle || task?.project_id || '—'}</span>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight mb-3">{task?.title || 'Задача'}</p>
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Дедлайн: {formatTaskDate(task?.deadline)}</span>
                    </div>
                  </div>

                  {/* Due date */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Срок выполнения</p>
                    <div className="relative">
                      <input
                        type="date"
                        value={delegateDueDate}
                        onChange={(e) => setDelegateDueDate(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-400 text-gray-900 dark:text-white"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Приоритет</p>
                    <div className="relative">
                      <select
                        value={delegatePriority}
                        onChange={(e) => setDelegatePriority(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none cursor-pointer text-gray-900 dark:text-white"
                      >
                        <option value="Высокий">Высокий</option>
                        <option value="Средний">Средний</option>
                        <option value="Низкий">Низкий</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Комментарий к задаче</p>
                    <textarea
                      placeholder="Добавьте инструкции..."
                      value={delegateComment}
                      onChange={(e) => setDelegateComment(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-400 resize-none h-20 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Right column - Select executor */}
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900 dark:text-white mb-3">Выберите исполнителя</p>

                  {/* Search input */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Поиск сотрудника..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-400 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Team members list */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        onClick={() => setSelectedPerson(member.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${selectedPerson === member.id
                          ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
                          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                      >
                        {/* Radio button */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedPerson === member.id ? 'border-green-500' : 'border-gray-300'
                          }`}>
                          {selectedPerson === member.id && (
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          )}
                        </div>

                        {/* Avatar with status */}
                        <div className="relative">
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          {member.status === 'available' && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </div>

                        {/* Name and status */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{member.name}</p>
                          </div>
                          <p className="text-xs text-gray-500">{member.statusText}</p>
                        </div>

                        {/* Match percentage and role */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">{getRoleLabel(member.role)}</p>
                        </div>
                      </div>
                    ))}

                    {filteredMembers.length === 0 && (
                      <p className="py-4 text-center text-sm text-gray-500">
                        {projectMembers.length <= 1
                          ? 'Добавьте участников проекта, чтобы делегировать задачу'
                          : 'Нет совпадений'}
                      </p>
                    )}
                  </div>

                </div>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setIsDelegateModalOpen(false)}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelegateTask()}
                  disabled={!selectedPerson || isDelegatingTask}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white font-semibold rounded-full hover:bg-amber-700 transition-colors disabled:opacity-60"
                >
                  {isDelegatingTask ? 'Делегирование...' : 'Делегировать'}
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Responsible Persons Modal */}
        <ResponsiblePersonsModal
          isOpen={isResponsibleModalOpen}
          onClose={() => setIsResponsibleModalOpen(false)}
          projectId={isTaskPage ? String(task?.project_id || '') : String(params.id || '')}
        />

        <DelayReportsModal
          isOpen={isDelayReportsModalOpen}
          onClose={() => setIsDelayReportsModalOpen(false)}
          projectId={isTaskPage ? String(task?.project_id || '') : String(params.id || '')}
          taskId={isTaskPage ? String(task?.id || '') : undefined}
          onChanged={() => refreshTaskDelayReason()}
        />

        {isTaskPage && isAssigneeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeAssigneeModal}
            />

            <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ответственные по задаче</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Выберите сотрудников для назначения на задачу</p>
                </div>
                <button
                  type="button"
                  onClick={closeAssigneeModal}
                  disabled={isSavingAssignees}
                  className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Existing project members — toggle as assignees */}
              <div className="mb-2 max-h-60 space-y-2 overflow-y-auto">
                {assigneeCandidates.map((candidate) => {
                  const isSelected = assigneeSelection.includes(candidate.id);
                  return (
                    <button
                      type="button"
                      key={candidate.id}
                      onClick={() => toggleAssignee(candidate.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${isSelected
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                        }`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{candidate.name}</p>
                        <p className="text-xs text-gray-500">{candidate.roleLabel}</p>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-gray-300'}`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })}

                {assigneeCandidates.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-500">Нет сотрудников для назначения</p>
                )}
              </div>

              {/* Add from hierarchy section */}
              {canInviteToTask && (
                <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4" />
                    Добавить из иерархий
                  </p>
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    Откройте иерархию компании и выберите сотрудника для назначения на задачу.
                  </p>
                  <button
                    type="button"
                    onClick={openHierarchyAssigneePicker}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                  >
                    <UserPlus className="h-4 w-4" />
                    Добавить из иерархий
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeAssigneeModal}
                  disabled={isSavingAssignees}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => void saveTaskAssignees()}
                  disabled={isSavingAssignees}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {isSavingAssignees ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isCompleteConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsCompleteConfirmOpen(false)} />
            <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Завершить задачу?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
                После подтверждения задача получит статус «Выполнено».
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCompleteConfirmOpen(false)}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsCompleteConfirmOpen(false);
                    await updateTaskStatus('done');
                  }}
                  className="rounded-full bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700"
                >
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        )}

        {isPostponeConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsPostponeConfirmOpen(false)} />
            <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Отложить задачу?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
                После подтверждения задача получит статус «Отложено».
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPostponeConfirmOpen(false)}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsPostponeConfirmOpen(false);
                    await updateTaskStatus('delayed');
                  }}
                  className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
