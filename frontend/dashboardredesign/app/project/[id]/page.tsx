'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronRight, Clock, Users, AlertCircle, Send, Share2, Copy, X, Search, UserPlus, Calendar, ChevronDown, Paperclip, Star, Check } from 'lucide-react';
import Header from '@/components/header';
import ResponsiblePersonsModal from '@/components/responsible-persons-modal';
import DelayReportsModal from '@/components/delay-reports-modal';
import { api, getApiErrorMessage, getApiStatus, getCurrentUserId } from '@/lib/api';
import { packTaskBlocks, unpackTaskBlocks, type EditorBlock } from '@/components/editor/taskBlockMeta';
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

export default function TaskDetail() {
  const router = useRouter();
  const params = useParams();
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
  const [allUsers, setAllUsers] = useState<{ id: string; email: string }[]>([]);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isLoadingTask, setIsLoadingTask] = useState(false);
  const [isTaskNotFound, setIsTaskNotFound] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const currentUserId = getCurrentUserId();

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

  useEffect(() => {
    if (!isTaskPage || !task?.project_id || !task?.id) {
      setTaskDelayReason(null);
      return;
    }

    let cancelled = false;

    const loadDelayReason = async () => {
      try {
        const { data } = await api.get<DelayReportEntity[]>(`/projects/${task.project_id}/delay-report`);
        if (cancelled) {
          return;
        }

        const reports = Array.isArray(data) ? data : [];
        const filtered = reports.filter((report) => {
          const reportTaskId = (report.task_id || report.taskId || '').trim();
          return reportTaskId === task.id;
        });

        const latest = [...filtered].sort((a, b) => {
          const aTime = new Date(a.created_at || a.createdAt || '').getTime();
          const bTime = new Date(b.created_at || b.createdAt || '').getTime();
          return bTime - aTime;
        })[0];

        setTaskDelayReason(latest?.message?.trim() || null);
      } catch {
        if (!cancelled) {
          setTaskDelayReason(null);
        }
      }
    };

    void loadDelayReason();

    return () => {
      cancelled = true;
    };
  }, [isTaskPage, task?.id, task?.project_id]);

  useEffect(() => {
    if (!isTaskPage || !task?.project_id) {
      setProjectMembers([]);
      return;
    }

    let cancelled = false;

    const loadMembers = async () => {
      try {
        const [{ data: membersData }, { data: usersData }] = await Promise.all([
          api.get<ProjectMemberEntity[]>(`/projects/${task.project_id}/members`),
          api.get<{ id: string; email: string }[]>('/users'),
        ]);
        if (cancelled) {
          return;
        }
        setProjectMembers(Array.isArray(membersData) ? membersData : []);
        setAllUsers(Array.isArray(usersData) ? usersData : []);
      } catch {
        if (!cancelled) {
          setProjectMembers([]);
        }
      }
    };

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [isTaskPage, task?.project_id]);

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

  const canInviteToTask = isTaskPage && currentTaskUserRole === 'owner';
  const canDelegateTask = isTaskPage
    && (currentTaskUserRole === 'owner' || currentTaskUserRole === 'manager' || isCurrentUserTaskAssignee);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    projectMembers.forEach((member) => {
      map.set(member.user.id, getDisplayNameFromEmail(member.user.email));
    });
    return map;
  }, [projectMembers]);

  const visibleTaskAssignees = useMemo(() => {
    return taskAssignees.map((assignee) => memberNameById.get(assignee) || assignee);
  }, [memberNameById, taskAssignees]);

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

  const saveTaskAssignees = async () => {
    if (!task || isSavingAssignees) {
      return;
    }

    const unpacked = unpackTaskBlocks(task.blocks);
    const normalizedAssignees = Array.from(new Set(assigneeSelection.map((id) => String(id || '').trim()).filter(Boolean)));

    setIsSavingAssignees(true);
    setTaskError(null);
    try {
      const { data } = await api.patch<TaskResponse>(`/tasks/${task.id}`, {
        title: task.title,
        status: task.status,
        startDate: task.start_date || task.startDate || null,
        deadline: task.deadline || null,
        assignees: normalizedAssignees,
        blocks: packTaskBlocks(unpacked.blocks, normalizedAssignees),
        expected_updated_at: task.updated_at || task.updatedAt,
      });

      setTask(data || task);
      setTaskAssignees(normalizedAssignees);
      setIsAssigneeModalOpen(false);
    } catch (error) {
      setTaskError(getApiErrorMessage(error, 'Не удалось назначить ответственных по задаче'));
    } finally {
      setIsSavingAssignees(false);
    }
  };

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
    if (!task?.id || !text || isSendingComment) {
      return;
    }

    setIsSendingComment(true);
    try {
      await api.post(`/tasks/${task.id}/comment`, { message: text });
      setCommentText('');
      await refreshTaskContext();
    } catch (error) {
      setTaskError(getApiErrorMessage(error, 'Не удалось отправить комментарий'));
    } finally {
      setIsSendingComment(false);
    }
  };

  const dynamicPreparation = useMemo(() => {
    if (!isTaskPage) {
      return [] as string[];
    }

    return taskBlocks
      .filter((block) => block.type === 'text')
      .map((block) => String(block.content || '').trim())
      .filter(Boolean);
  }, [isTaskPage, taskBlocks]);

  const dynamicPreparationMedia = useMemo(() => {
    if (!isTaskPage) {
      return [] as Array<{
        id: string;
        type: 'image' | 'video' | 'file';
        url: string;
        fileName: string;
      }>;
    }

    return taskBlocks
      .filter((block) => block.type === 'image' || block.type === 'video' || block.type === 'file')
      .map((block) => {
        const rawUrl = String(block.fileUrl || block.content || '').trim();
        const resolvedUrl = getFileUrl(rawUrl) || rawUrl;
        return {
          id: block.id,
          type: block.type,
          url: resolvedUrl,
          fileName: String(block.fileName || 'Вложение').trim() || 'Вложение',
        };
      })
      .filter((item) => Boolean(item.url));
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

  const historyItems = [
    {
      id: 1,
      type: 'expense',
      user: 'Вы',
      action: 'добавили новый расход',
      detail: 'Арматура A500C',
      time: '2 минуты назад',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    },
    {
      id: 2,
      type: 'deadline',
      user: 'Евгений С.',
      action: 'обновил дедлайн задачи',
      oldDate: '24.11.2025',
      newDate: '26.01.2026',
      time: '15 минут назад',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    },
    {
      id: 3,
      type: 'delegate',
      user: '',
      action: 'Автоматически делегирована задача',
      detail: '"Подготовка опалубки" перешла к следующему этапу согласно графику',
      time: '1 час назад',
      avatar: 'system',
    },
    {
      id: 4,
      type: 'status',
      user: 'Серик Р.',
      action: 'изменил статус',
      oldStatus: 'Ожидание',
      newStatus: 'В работе',
      time: '3 часа назад',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    },
    {
      id: 5,
      type: 'file',
      user: 'Омар А.',
      action: 'прикрепил файл',
      fileName: 'smetka_v3',
      time: 'Вчера, 18:30',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    },
    {
      id: 6,
      type: 'created',
      user: '',
      action: 'Задача создано в системе',
      time: '22.12.2025',
      avatar: 'system',
    },
  ];

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
        assignees: [delegatedTo],
        blocks: packTaskBlocks(taskBlocks, [delegatedTo]),
        expected_updated_at: task.updated_at || task.updatedAt,
      });

      if (task.project_id) {
        const userName = memberNameById.get(delegatedTo) || delegatedTo;
        const extra = [
          delegatePriority ? `Приоритет: ${delegatePriority}` : '',
          delegateComment.trim() ? `Комментарий: ${delegateComment.trim()}` : '',
        ].filter(Boolean).join(' • ');
        await api.post(`/projects/${task.project_id}/delay-report`, {
          taskId: task.id,
          message: extra
            ? `Задача делегирована пользователю: ${userName}. ${extra}`
            : `Задача делегирована пользователю: ${userName}`,
        });
      }

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

  const responsiblePersons = [
    {
      id: '1',
      name: 'Омар Ахмет',
      role: 'Архитектор',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    },
    {
      id: '2',
      name: 'Зейнулла Рышман',
      role: 'Архитектор',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    },
    {
      id: '3',
      name: 'Серик Рах',
      role: 'Прораб',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    },
  ];

  const taskData: TaskViewData = {
    title: 'Возведение колонн на 1 этаже несущих конструкции',
    deadline: '26.11.2025 23:59 (-9 часов)',
    startDate: 'Дата начала: 15.11.2025 12:00',
    responsible: ['Омар Ахмет', 'Зейнулла Ршыман', 'Серик Рах...'],
    issue: 'Причина просрочки: Айды Рахимбаев болел 5 дней',
    preparation: [
      'Проверка геодезической разбивки осей и отметок',
      'Подготовка и выравнивание опубликованных для колонн',
      'Проверка качества арматурных каркасов (диаметр, шаг, фиксация)',
      'Затем переидем к задачам:',
    ],
    stages: [
      {
        title: 'Пересмотреть и доработать чертежи',
        description: 'Пересмотреть расположение всех существующих квартир\nПереработать конфигурацию несущих стен',
        status: 'Выполнено',
      },
      {
        title: 'С новой конфигурацией добавить...',
        description: 'Добавить больше квартир за счет оптимизации пространства и корректировки нежиных зон...',
        status: 'Выполнено',
      },
      {
        title: 'Провести проверку новой планировки',
        description: 'Проверить соответствие новой планировки требованиям пожарной безопасности',
        status: 'Ошибка',
        days: '-9 часов',
      },
    ],
  };

  const displayTaskData = useMemo(() => {
    if (!isTaskPage || !task) {
      return taskData;
    }

    return {
      ...taskData,
      title: task.title || taskData.title,
      deadline: formatTaskDate(task.deadline),
      startDate: `Дата начала: ${formatTaskDate(task.start_date || task.startDate)}`,
      responsible: visibleTaskAssignees.length > 0 ? visibleTaskAssignees : taskData.responsible,
      issue: taskDelayReason || taskData.issue,
      preparation: dynamicPreparation.length > 0 ? dynamicPreparation : taskData.preparation,
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
              onClick={() => router.push(`/tasks/${taskId}/edit`)}
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
            Loading...
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
          <div className="bg-[#111111] rounded-[32px] p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-red-500/20 transition-all" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="bg-white/10 p-2.5 rounded-2xl text-white">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wide mb-1">Проблема / Статус</p>
                <p className="text-sm text-white font-medium leading-relaxed">{displayTaskData.issue}</p>
                <button
                  type="button"
                  onClick={() => setIsDelayReportsModalOpen(true)}
                  className="text-amber-400 text-[11px] font-bold mt-2 flex items-center gap-1 hover:underline"
                >
                  ПОДРОБНЕЕ <ChevronRight size={12} />
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
              {displayTaskData.preparation.length > 0 ? (
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

              {isTaskPage && dynamicPreparationMedia.length > 0 && (
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Вложения из редактора</p>
                  <div className="space-y-3">
                    {dynamicPreparationMedia.map((item) => {
                      if (item.type === 'image') {
                        return (
                          <img
                            key={item.id}
                            src={item.url}
                            alt={item.fileName}
                            className="w-full max-h-80 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
                          />
                        );
                      }

                      if (item.type === 'video') {
                        return (
                          <video
                            key={item.id}
                            src={item.url}
                            controls
                            className="w-full max-h-80 rounded-xl border border-gray-200 dark:border-gray-700"
                          />
                        );
                      }

                      return (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700 hover:underline"
                        >
                          📎 {item.fileName}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Stages Section */}
            {displayTaskData.stages.length > 0 && (
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
                      taskComments.map((item) => (
                        <div key={item.id} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-3">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{getDisplayNameFromEmail(item.author?.email || 'Пользователь')}</p>
                            <p className="text-gray-500 text-xs">{formatTaskDate(item.created_at || item.createdAt)}</p>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">{item.message}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment Input */}
                  <div className="mt-8">
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
                        disabled={isSendingComment || commentText.trim().length === 0}
                        className="bg-yellow-500 text-white w-10 h-10 rounded-full hover:bg-yellow-600 transition-colors flex items-center justify-center disabled:opacity-60"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex gap-4 px-4">
                      <button
                        type="button"
                        onClick={() => router.push('/documents')}
                        className="text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-1"
                      >
                        📄 Документы
                      </button>
                      <button className="text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-1">
                        📷 Фото
                      </button>
                      <button className="text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-1">
                        @ Упомянуть
                      </button>
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
                        <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{item.message}</p>
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

                  {/* Add member inline for delegation */}
                  {canInviteToTask && nonMemberUsers.length > 0 && (
                    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <UserPlus className="h-3.5 w-3.5" />
                        Добавить участника в проект
                      </p>
                      <div className="max-h-32 space-y-1 overflow-y-auto">
                        {nonMemberUsers.slice(0, 5).map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            disabled={isAddingMember}
                            onClick={() => void handleAddProjectMember(user.id)}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                          >
                            <span className="font-medium text-gray-700 dark:text-gray-300">{getDisplayNameFromEmail(user.email)}</span>
                            <span className="text-xs text-amber-600 font-semibold">+ Добавить</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
          persons={responsiblePersons}
        />

        <DelayReportsModal
          isOpen={isDelayReportsModalOpen}
          onClose={() => setIsDelayReportsModalOpen(false)}
          projectId={isTaskPage ? String(task?.project_id || '') : String(params.id || '')}
          taskId={isTaskPage ? String(task?.id || '') : undefined}
        />

        {isTaskPage && isAssigneeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => !isSavingAssignees && setIsAssigneeModalOpen(false)}
            />

            <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ответственные по задаче</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Выберите участников проекта для назначения на задачу</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssigneeModalOpen(false)}
                  disabled={isSavingAssignees}
                  className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Existing project members — toggle as assignees */}
              <div className="mb-2 max-h-60 space-y-2 overflow-y-auto">
                {projectMembers.map((member) => {
                  const isSelected = assigneeSelection.includes(member.user.id);
                  return (
                    <button
                      type="button"
                      key={member.user.id}
                      onClick={() => toggleAssignee(member.user.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${isSelected
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                        }`}
                    >
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{getDisplayNameFromEmail(member.user.email)}</p>
                        <p className="text-xs text-gray-500">{getRoleLabel(member.role)}</p>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-gray-300'}`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })}

                {projectMembers.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-500">Нет участников проекта для назначения</p>
                )}
              </div>

              {/* Add new project members section */}
              {canInviteToTask && (
                <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4" />
                    Добавить участника в проект
                  </p>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder="Поиск пользователей..."
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                    />
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {nonMemberUsers.slice(0, 10).map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        disabled={isAddingMember}
                        onClick={() => void handleAddProjectMember(user.id)}
                        className="flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{getDisplayNameFromEmail(user.email)}</span>
                        <span className="text-xs text-amber-600 font-semibold">+ Добавить</span>
                      </button>
                    ))}
                    {memberSearchQuery && nonMemberUsers.length === 0 && (
                      <p className="py-2 text-center text-xs text-gray-400">Пользователи не найдены</p>
                    )}
                    {!memberSearchQuery && nonMemberUsers.length === 0 && allUsers.length > 0 && (
                      <p className="py-2 text-center text-xs text-gray-400">Все пользователи уже добавлены</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAssigneeModalOpen(false)}
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
