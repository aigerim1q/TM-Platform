'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from 'next/navigation';
import { Clock, Plus, X, Users, UserPlus, ChevronDown, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage, getCurrentUserId } from '@/lib/api';
import { getFileUrl } from '@/lib/utils';
import { unpackTaskBlocks } from '@/components/editor/taskBlockMeta';
import { emitProjectsUpdated, PROJECTS_UPDATED_EVENT } from '@/lib/projects-events';

type ProjectAPI = {
  id: string;
  title: string;
  current_user_role?: 'owner' | 'manager' | 'member';
  currentUserRole?: 'owner' | 'manager' | 'member';
  coverUrl?: string | null;
  cover_url?: string | null;
  budget?: number | null;
  total_budget?: number | null;
  deadline?: string | null;
  end_date?: string | null;
};

type StageAPI = {
  id: string;
  title: string;
};

type TaskAPI = {
  id: string;
  title: string;
  deadline?: string | null;
  status?: string;
  blocks?: unknown;
  assignees?: unknown;
};

type SubordinateUser = {
  id: string;
  email: string;
};

type HierarchyTreeUser = {
  id?: string;
  email?: string;
};

type HierarchyTreeNode = {
  user_id?: string | null;
  user?: HierarchyTreeUser | null;
  children?: HierarchyTreeNode[];
};

type HierarchyTreeResponse = {
  tree?: HierarchyTreeNode[];
};

type DashboardProject = {
  id: string;
  title: string;
  coverUrl: string;
  budget: number;
  deadline: string | null;
};

type DashboardTaskCard = {
  id: string;
  projectId: string;
  project: string;
  time: string;
  timeStatus: 'danger' | 'warning' | 'success';
  title: string;
  description: string;
  responsible?: string;
  deadline?: string | null;
};

interface TaskCardProps {
  id: string;
  project: string;
  time: string;
  timeStatus: 'danger' | 'warning' | 'success';
  title: string;
  description: string;
  responsible?: string;
  onClick?: () => void;
  onResponsibleClick?: (e: React.MouseEvent) => void;
}

function TaskCard({ project, time, timeStatus, title, description, onClick }: TaskCardProps) {
  const isDelayed = timeStatus === 'danger';

  return (
    <div
      onClick={onClick}
      className="bg-[#FBF9F7] dark:bg-card rounded-[2.5rem] p-8 border-2 border-[#E2E2E2] dark:border-white/5 flex flex-col h-full transition-all hover:shadow-lg group cursor-pointer"
    >
      <div className="flex items-center justify-between mb-8">
        <span className="text-[15px] font-medium text-gray-500">
          Проект: {project}
        </span>
        <div className="bg-black rounded-full px-4 py-1.5 flex items-center gap-2 border border-white/10 shadow-xl">
          <Clock size={16} className="text-white opacity-60" />
          <span className="text-[13px] font-bold text-white tracking-wide">
            {time}
          </span>
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDelayed ? 'bg-red-400 opacity-75' : 'bg-green-400 opacity-75'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isDelayed ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]'}`}></span>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1">
        <h3 className="text-[20px] font-bold text-gray-900 dark:text-gray-100 mb-3 leading-tight tracking-tight line-clamp-1 group-hover:text-[#D1B891] transition-colors">
          {title}
        </h3>
        <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
          {description}
        </p>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  id: string;
  title: string;
  coverUrl: string;
  budget: number;
  deadline: string | null;
  onClick?: () => void;
  onDelete?: (projectId: string, title: string) => void;
}

function formatBudget(budget: number) {
  if (!Number.isFinite(budget)) {
    return '—';
  }

  return new Intl.NumberFormat('ru-RU').format(budget);
}

function formatDeadline(deadline: string | null) {
  if (!deadline) {
    return 'Без дедлайна';
  }

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) {
    return deadline;
  }

  return parsed.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function isDeadlineOverdue(deadline: string | null) {
  if (!deadline) {
    return false;
  }

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getTime() < Date.now();
}

function isTaskCompletedStatus(status?: string) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'done' || normalized === 'completed';
}

function normalizeToken(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function addUserTokens(target: Set<string>, userID?: unknown, email?: unknown) {
  const normalizedID = normalizeToken(userID);
  const normalizedEmail = normalizeToken(email);

  if (normalizedID) {
    target.add(normalizedID);
  }
  if (normalizedEmail) {
    target.add(normalizedEmail);
  }
}

function collectSubordinateTokensFromNode(node: HierarchyTreeNode, target: Set<string>) {
  const children = Array.isArray(node.children) ? node.children : [];
  children.forEach((child) => {
    addUserTokens(target, child.user?.id || child.user_id, child.user?.email);
    collectSubordinateTokensFromNode(child, target);
  });
}

function collectHierarchySubordinateTokens(tree: HierarchyTreeNode[], currentUserId: string): Set<string> {
  const targetUser = normalizeToken(currentUserId);
  const tokens = new Set<string>();
  if (!targetUser) {
    return tokens;
  }

  const walk = (node: HierarchyTreeNode) => {
    const nodeUserID = normalizeToken(node.user?.id || node.user_id);
    if (nodeUserID && nodeUserID === targetUser) {
      collectSubordinateTokensFromNode(node, tokens);
    }

    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach(walk);
  };

  tree.forEach(walk);
  return tokens;
}

function ProjectCard({ id, title, coverUrl, budget, deadline, onClick, onDelete }: ProjectCardProps) {
  const imageSrc = getFileUrl(coverUrl) || "/placeholder.svg";

  return (
    <div
      data-project-id={id}
      onClick={onClick}
      className="bg-[#FBF9F7] dark:bg-card rounded-[2.5rem] overflow-hidden border-2 border-[#E2E2E2] dark:border-white/5 cursor-pointer hover:shadow-2xl transition-all duration-300 group"
    >
      <div className="relative aspect-16/10 overflow-hidden">
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id, title);
            }}
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-red-600 transition-colors"
            title="Удалить проект"
            aria-label="Удалить проект"
          >
            <Trash2 size={14} />
          </button>
        )}
        <img
          src={imageSrc}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>

      <div className="p-6">
        <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-3 line-clamp-1">
          {title}
        </h3>

        <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-center justify-between">
            <span className="font-medium">Бюджет</span>
            <span className="font-bold text-gray-900 dark:text-gray-100">{formatBudget(budget)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Дедлайн</span>
            <span className={`font-bold ${isDeadlineOverdue(deadline) ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
              {formatDeadline(deadline)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[2.5rem] border-2 border-[#E2E2E2] bg-[#FBF9F7] p-8 dark:border-white/5 dark:bg-card">
      <div className="mb-8 flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-7 w-24 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="space-y-3">
        <div className="h-6 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[2.5rem] border-2 border-[#E2E2E2] bg-[#FBF9F7] dark:border-white/5 dark:bg-card">
      <div className="aspect-16/10 w-full bg-gray-200 dark:bg-gray-700" />
      <div className="space-y-3 p-6">
        <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  color: 'green' | 'red' | 'yellow';
  title: string;
  count: number;
}

function SectionHeader({ color, title, count }: SectionHeaderProps) {
  const dotColors = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-amber-400',
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 dark:bg-card/50 px-4 py-2 dark:border dark:border-white/10">
      <span className={`h-3 w-3 rounded-full ${dotColors[color]}`} />
      <span className="font-medium text-gray-800 dark:text-white text-sm">{title}: {count}</span>
    </div>
  );
}

function AddButton({ text, onClick }: { text: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white dark:bg-card/50 dark:px-4 dark:py-2 dark:rounded-full dark:border dark:border-white/10 font-medium text-sm transition-all"
    >
      <Plus size={16} />
      {text}
    </button>
  );
}

// AddTaskModal removed — replaced by dedicated page at /tasks/new

interface ResponsibleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ResponsibleModal({ isOpen, onClose }: ResponsibleModalProps) {
  const [selectedResponsible, setSelectedResponsible] = useState('');

  if (!isOpen) return null;

  const responsiblePeople = [
    {
      id: 1,
      name: 'Омар Ахмет',
      role: 'Архитектор',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      isYou: true,
    },
    {
      id: 2,
      name: 'Зейнулла Рышман',
      role: 'Архитектор',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      isYou: false,
    },
    {
      id: 3,
      name: 'Айдын Рахимбаев',
      role: 'Аудитор',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
      isYou: false,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-amber-50 dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users size={24} className="text-gray-700 dark:text-gray-200" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ответственные</h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
              <UserPlus size={18} />
              <span className="text-sm">Назначить менеджера</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-amber-100 dark:hover:bg-white/10 transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* People List */}
        <div className="space-y-4 mb-6">
          {responsiblePeople.map((person) => (
            <div key={person.id} className="flex items-center gap-3">
              <img
                src={person.avatar || "/placeholder.svg"}
                alt={person.name}
                className="w-14 h-14 rounded-full object-cover"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{person.name}</span>
                  {person.isYou && (
                    <span className="text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-2 py-0.5 rounded-full">
                      это вы
                    </span>
                  )}
                </div>
                <span className="text-sm text-amber-700 dark:text-amber-400">{person.role}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Delegation */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Быстрое делегирование
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Выбрать ответственного
            </span>
          </div>
          <div className="relative">
            <select
              value={selectedResponsible}
              onChange={(e) => setSelectedResponsible(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl appearance-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-gray-700 dark:text-white transition-colors"
            >
              <option value="">Выбрать ответст...</option>
              <option value="omar">Омар Ахмет</option>
              <option value="zeinulla">Зейнулла Рышман</option>
              <option value="aidyn">Айдын Рахимбаев</option>
            </select>
            <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Add Button */}
        <button className="w-full flex items-center justify-center gap-2 bg-amber-200 hover:bg-amber-300 dark:bg-amber-600 dark:hover:bg-amber-500 text-amber-900 dark:text-white font-semibold py-3 rounded-xl transition-colors">
          <UserPlus size={20} />
          Добавить участников
        </button>
      </div>
    </div>
  );
}

export default function DashboardContent() {
  const router = useRouter();
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [myTasks, setMyTasks] = useState<DashboardTaskCard[]>([]);
  const [subordinateTasks, setSubordinateTasks] = useState<DashboardTaskCard[]>([]);
  const [subordinateProjects, setSubordinateProjects] = useState<DashboardProject[]>([]);

  // Task creation moved to dedicated page at /tasks/new

  const getTaskTimeBadge = (deadline?: string | null) => {
    if (!deadline) {
      return { time: 'без срока', timeStatus: 'warning' as const };
    }

    const parsed = new Date(deadline);
    if (Number.isNaN(parsed.getTime())) {
      return { time: 'без срока', timeStatus: 'warning' as const };
    }

    const diffMs = parsed.getTime() - Date.now();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours < 0) {
      return { time: `${diffHours} часов`, timeStatus: 'danger' as const };
    }

    if (diffHours < 24) {
      return { time: `${diffHours} часов`, timeStatus: 'warning' as const };
    }

    const diffDays = Math.round(diffHours / 24);
    return { time: `${diffDays} дней`, timeStatus: 'success' as const };
  };

  const isUrgentTask = (deadline?: string | null) => {
    if (!deadline) {
      return false;
    }

    const parsed = new Date(deadline);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }

    const diffMs = parsed.getTime() - Date.now();
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    return diffMs <= fiveDaysMs;
  };

  const urgentTasks = useMemo(() => myTasks.filter((task) => isUrgentTask(task.deadline)), [myTasks]);
  const regularMyTasks = useMemo(() => myTasks.filter((task) => !isUrgentTask(task.deadline)), [myTasks]);

  const handleTaskClick = (taskId: string) => {
    const normalizedTaskId = String(taskId || '').trim().replace(/^task-/, '');
    if (!normalizedTaskId) {
      return;
    }
    router.push(`/project/task-${normalizedTaskId}`);
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/project-overview/${projectId}`);
  };

  const handleCreateProject = async () => {
    setProjectsError(null);

    try {
      const { data } = await api.post<{ id: string }>('/projects', {
        title: 'Новый проект',
        budget: 0,
      });

      if (!data?.id) {
        throw new Error('project id is missing');
      }

      router.push(`/projects/${data.id}/editor`);
    } catch (error) {
      setProjectsError(getApiErrorMessage(error, 'Не удалось создать проект'));
    }
  };

  const handleResponsibleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResponsibleModalOpen(true);
  };

  const handleOpenDeleteProjectModal = (id: string, title: string) => {
    setDeleteProjectConfirm({ id, title });
  };

  const handleConfirmDeleteProject = async () => {
    if (!deleteProjectConfirm || isDeletingProject) {
      return;
    }

    const deletedProjectID = deleteProjectConfirm.id;
    setProjectsError(null);
    setIsDeletingProject(true);
    try {
      await api.delete(`/projects/${deletedProjectID}`);
      setProjects((prev) => prev.filter((project) => project.id !== deletedProjectID));
      setMyTasks((prev) => prev.filter((task) => task.projectId !== deletedProjectID));
      setSubordinateTasks((prev) => prev.filter((task) => task.projectId !== deletedProjectID));
      setDeleteProjectConfirm(null);
      emitProjectsUpdated();
    } catch (error) {
      setProjectsError(getApiErrorMessage(error, 'Не удалось удалить проект'));
    } finally {
      setIsDeletingProject(false);
    }
  };

  const loadProjects = useCallback(async (silent = false) => {
    if (!silent) {
      setProjectsLoading(true);
      setProjectsError(null);
    }

    try {
      const { data } = await api.get<ProjectAPI[]>('/projects');
      const projectsList = Array.isArray(data) ? data : [];
      const mapped = projectsList.map((project) => ({
        id: project.id,
        title: project.title,
        coverUrl: project.coverUrl || project.cover_url || '',
        budget: Number(project.budget ?? project.total_budget ?? 0),
        deadline: project.deadline || project.end_date || null,
      }));
      setProjects(mapped);

      const taskCards: DashboardTaskCard[] = [];
      const subordinateTaskCards: DashboardTaskCard[] = [];

      const currentUserId = getCurrentUserId();
      const loadSubordinateTokens = async (): Promise<Set<string>> => {
        const tokens = new Set<string>();
        if (!currentUserId) {
          return tokens;
        }

        const [subordinatesResult, hierarchyResult] = await Promise.allSettled([
          api.get<SubordinateUser[]>(`/users/${currentUserId}/subordinates`),
          api.get<HierarchyTreeResponse>('/hierarchy/tree'),
        ]);

        if (subordinatesResult.status === 'fulfilled') {
          const directSubordinates = Array.isArray(subordinatesResult.value.data) ? subordinatesResult.value.data : [];
          directSubordinates.forEach((user) => {
            addUserTokens(tokens, user.id, user.email);
          });
        }

        if (hierarchyResult.status === 'fulfilled') {
          const hierarchyTree = Array.isArray(hierarchyResult.value.data?.tree) ? hierarchyResult.value.data.tree : [];
          const hierarchySubordinates = collectHierarchySubordinateTokens(hierarchyTree, currentUserId);
          hierarchySubordinates.forEach((token) => tokens.add(token));
        }

        return tokens;
      };

      const subordinateTokensPromise = loadSubordinateTokens();
      const normalizedCurrentUserId = normalizeToken(currentUserId);
      const canManageByProject = new Map<string, boolean>();
      projectsList.forEach((project) => {
        const currentUserRole = String(project.current_user_role || project.currentUserRole || '').toLowerCase();
        canManageByProject.set(project.id, currentUserRole === 'owner' || currentUserRole === 'manager');
      });

      // Load members for each project to filter subordinate projects
      const memberResults = await Promise.allSettled(
        projectsList.map((project) => api.get<any[]>(`/projects/${project.id}/members`))
      );

      const stageResults = await Promise.allSettled(
        projectsList.map((project) => api.get<StageAPI[]>(`/projects/${project.id}/stages`)),
      );

      const stageEntries: Array<{ project: ProjectAPI; stage: StageAPI }> = [];
      stageResults.forEach((result, index) => {
        if (result.status !== 'fulfilled') {
          return;
        }
        const stages = Array.isArray(result.value.data) ? result.value.data : [];
        stages.forEach((stage) => {
          stageEntries.push({ project: projectsList[index], stage });
        });
      });

      const taskResults = await Promise.allSettled(
        stageEntries.map(({ stage }) => api.get<TaskAPI[]>(`/stages/${stage.id}/tasks`)),
      );

      const subordinateTokens = await subordinateTokensPromise;

      // Filter projects that have subordinate members
      const subordinateProjectsList: DashboardProject[] = [];
      memberResults.forEach((result, index) => {
        if (result.status !== 'fulfilled') {
          return;
        }
        const project = projectsList[index];
        const members = Array.isArray(result.value.data) ? result.value.data : [];
        
        // Check if any member is a subordinate
        const hasSubordinateMember = members.some((member: any) => {
          if (!member.user) return false;
          const memberId = normalizeToken(member.user.id);
          const memberEmail = normalizeToken(member.user.email);
          return subordinateTokens.has(memberId) || subordinateTokens.has(memberEmail);
        });

        if (hasSubordinateMember) {
          subordinateProjectsList.push(mapped[index]);
        }
      });

      setSubordinateProjects(subordinateProjectsList);

      taskResults.forEach((result, index) => {
        if (result.status !== 'fulfilled') {
          return;
        }

        const entry = stageEntries[index];
        const tasks = Array.isArray(result.value.data) ? result.value.data : [];
        const canManageProjectTasks = canManageByProject.get(entry.project.id) || false;

        tasks.forEach((task) => {
          if (isTaskCompletedStatus(task.status)) {
            return;
          }

          const badge = getTaskTimeBadge(task.deadline);
          const taskCard: DashboardTaskCard = {
            id: task.id,
            projectId: entry.project.id,
            project: entry.project.title,
            time: badge.time,
            timeStatus: badge.timeStatus,
            title: task.title || 'Новая задача',
            description: `Этап: ${entry.stage.title}`,
            deadline: task.deadline || null,
          };

          taskCards.push(taskCard);

          const taskAssigneesFromBlocks = unpackTaskBlocks(task.blocks).assignees;
          const taskAssigneesFromField = Array.isArray(task.assignees)
            ? task.assignees.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
          const normalizedTaskAssignees = [...taskAssigneesFromBlocks, ...taskAssigneesFromField]
            .map((item) => normalizeToken(item))
            .filter(Boolean);

          const hasSubordinateAssignee = subordinateTokens.size > 0
            && normalizedTaskAssignees.some((token) => subordinateTokens.has(token));

          const hasDelegatedAssignee = canManageProjectTasks
            && Boolean(normalizedCurrentUserId)
            && normalizedTaskAssignees.length > 0
            && normalizedTaskAssignees.some((token) => token !== normalizedCurrentUserId);

          if (hasSubordinateAssignee || hasDelegatedAssignee) {
            subordinateTaskCards.push(taskCard);
          }
        });
      });

      setMyTasks(taskCards.slice(0, 30));
      setSubordinateTasks(subordinateTaskCards.slice(0, 30));
    } catch (error) {
      if (!silent) {
        setProjects([]);
        setMyTasks([]);
        setSubordinateTasks([]);
        setProjectsError(getApiErrorMessage(error, 'Не удалось загрузить проекты'));
      }
    } finally {
      if (!silent) {
        setProjectsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadProjects(false);

    const onProjectsUpdated = () => {
      void loadProjects(true);
    };
    const onFocus = () => {
      void loadProjects(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadProjects(true);
      }
    };
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void loadProjects(true);
      }
    }, 8000);

    window.addEventListener(PROJECTS_UPDATED_EVENT, onProjectsUpdated as EventListener);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(PROJECTS_UPDATED_EVENT, onProjectsUpdated as EventListener);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadProjects]);

  if (projectsLoading) {
    return (
      <main className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <SectionHeader color="green" title="Срочные задачи" count={0} />
          <div className="mt-4 overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={`urgent-skeleton-${idx}`} className="w-96 shrink-0">
                  <TaskCardSkeleton />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <SectionHeader color="red" title="Мои задачи" count={0} />
          <div className="mt-4 overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={`my-skeleton-${idx}`} className="w-96 shrink-0">
                  <TaskCardSkeleton />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <SectionHeader color="yellow" title="Проекты" count={0} />
          <div className="mt-4 overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={`project-skeleton-${idx}`} className="w-96 shrink-0">
                  <ProjectCardSkeleton />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8">
      {/* Task creation modal removed — use /tasks/new page */}

      {/* Responsible Modal */}
      <ResponsibleModal
        isOpen={isResponsibleModalOpen}
        onClose={() => setIsResponsibleModalOpen(false)}
      />

      {deleteProjectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Удалить проект?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
              Проект «{deleteProjectConfirm.title}» будет удалён без возможности восстановления.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteProjectConfirm(null)}
                disabled={isDeletingProject}
                className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteProject()}
                disabled={isDeletingProject}
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isDeletingProject ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Urgent Tasks Section */}
      <div className="mb-8">
        <SectionHeader color="green" title="Срочные задачи" count={urgentTasks.length} />
        <div className="mt-4 overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
            {urgentTasks.map((task) => (
              <div key={task.id} className="w-96 shrink-0">
                <TaskCard
                  {...task}
                  onClick={() => handleTaskClick(task.id)}
                  onResponsibleClick={handleResponsibleClick}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My Tasks Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader color="red" title="Мои задачи" count={regularMyTasks.length} />
          <AddButton text="Добавить задачу" onClick={() => router.push('/tasks/new')} />
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
            {regularMyTasks.map((task) => (
              <div key={task.id} className="w-96 shrink-0">
                <TaskCard
                  {...task}
                  onClick={() => handleTaskClick(task.id)}
                  onResponsibleClick={handleResponsibleClick}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader color="yellow" title="Проекты" count={projects.length} />
          <AddButton text="Добавить проект" onClick={handleCreateProject} />
        </div>
        {projectsError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {projectsError}
          </div>
        )}
        {projectsLoading && (
          <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">Загрузка проектов...</div>
        )}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
          {projects.map((project) => (
              <div key={project.id} className="w-96 shrink-0">
                <ProjectCard
                  {...project}
                  onClick={() => handleProjectClick(project.id)}
                  onDelete={handleOpenDeleteProjectModal}
                />
              </div>
          ))}
          </div>
        </div>
      </div>

      {/* Subordinate Tasks Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader color="red" title="Задачи подчинённых" count={subordinateTasks.length} />
          <AddButton text="Добавить проект" onClick={handleCreateProject} />
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
          {subordinateTasks.map((task) => (
              <div key={task.id} className="w-96 shrink-0">
                <TaskCard
                  {...task}
                  onClick={() => handleTaskClick(task.id)}
                  onResponsibleClick={handleResponsibleClick}
                />
              </div>
          ))}
          </div>
        </div>
        {subordinateTasks.length === 0 && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Нет активных задач, назначенных подчинённым.
          </p>
        )}
      </div>

      {/* Subordinate Projects Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader color="yellow" title="Проекты подчиненных" count={subordinateProjects.length} />
          <AddButton text="Добавить проект" onClick={handleCreateProject} />
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
          {subordinateProjects.map((project) => (
              <div key={project.id} className="w-96 shrink-0">
                <ProjectCard
                  {...project}
                  onClick={() => handleProjectClick(project.id)}
                  onDelete={handleOpenDeleteProjectModal}
                />
              </div>
          ))}
          </div>
        </div>
        {subordinateProjects.length === 0 && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Нет проектов с назначенными подчинёнными.
          </p>
        )}
      </div>
    </main>
  );
}
