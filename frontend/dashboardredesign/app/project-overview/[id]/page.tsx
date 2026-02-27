'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Clock, Users, Plus, Trash2 } from 'lucide-react';
import Header from '@/components/header';
import ResponsiblePersonsModal from '@/components/responsible-persons-modal';
import DelayReportsModal from '@/components/delay-reports-modal';
import ProjectExpenseReportModal from '@/components/project-expense-report-modal';
import EditorModeBadge from '@/components/editor-mode-badge';
import { getDisplayNameFromEmail, getFileUrl } from '@/lib/utils';
import { useProject } from '@/hooks/useProject';
import { api, getApiErrorMessage } from '@/lib/api';

type ProjectMemberEntity = {
  user: {
    id: string;
    email: string;
  };
  role: 'owner' | 'manager' | 'member';
};

function formatProjectBudget(budget: number | null | undefined) {
  if (budget == null || !Number.isFinite(budget)) {
    return '—';
  }

  return new Intl.NumberFormat('ru-RU').format(budget);
}

function formatProjectDeadline(deadline: string | null | undefined) {
  if (!deadline) {
    return '—';
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

export default function ProjectOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
  const [isDelayReportsModalOpen, setIsDelayReportsModalOpen] = useState(false);
  const [isCreatingStage, setIsCreatingStage] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<
    | {
      type: 'stage' | 'task';
      id: string;
      title: string;
    }
    | null
  >(null);
  const [stageActionError, setStageActionError] = useState<string | null>(null);
  const [expenseActionError, setExpenseActionError] = useState<string | null>(null);
  const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
  const [createItemTitle, setCreateItemTitle] = useState('');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isExpenseReportModalOpen, setIsExpenseReportModalOpen] = useState(false);
  const [expenseReportRefreshKey, setExpenseReportRefreshKey] = useState(0);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [isCreatingExpense, setIsCreatingExpense] = useState(false);
  const [responsibleNames, setResponsibleNames] = useState<string[]>([]);

  const projectId = params.id as string;
  const { project, error: projectError, refresh, setProject } = useProject(projectId);

  const projectName = (project?.title || projectId || '').trim() || 'Проект';
  const coverUrl = getFileUrl(project?.cover_url || project?.coverUrl) || '/placeholder.svg';
  const userRole = (project?.current_user_role || project?.currentUserRole || 'member') as 'owner' | 'manager' | 'member';
  const canManageProject = userRole === 'owner' || userRole === 'manager';

  const loadResponsibleMembers = async () => {
    const normalizedProjectId = String(project?.id || projectId || '').trim();
    if (!normalizedProjectId) {
      setResponsibleNames([]);
      return;
    }

    try {
      const { data } = await api.get<ProjectMemberEntity[]>(`/projects/${normalizedProjectId}/members`);
      const members = Array.isArray(data) ? data : [];
      const names = members
        .filter((member) => member.role === 'manager' || member.role === 'member')
        .map((member) => getDisplayNameFromEmail(member.user.email))
        .filter((name) => String(name || '').trim().length > 0);

      setResponsibleNames(Array.from(new Set(names)));
    } catch {
      setResponsibleNames([]);
    }
  };

  useEffect(() => {
    void loadResponsibleMembers();
  }, [project?.id, projectId]);

  const projectData = {
    title: projectName,
    image: coverUrl,
    startDate: formatProjectDeadline(project?.start_date || project?.startDate),
    deadline: formatProjectDeadline(project?.deadline),
    responsible: responsibleNames.length > 0 ? responsibleNames.join(', ') : 'не назначены',
    hasWarning: true,
    warningText: 'Причины просрочки',
  };

  const totalBudget = Math.max(0, Number(project?.total_budget ?? project?.budget ?? 0) || 0);
  const spentBudget = Math.max(0, Number(project?.spent_budget ?? project?.spentBudget ?? 0) || 0);
  const remainingBudget = Math.max(
    0,
    Number(project?.remaining_budget ?? project?.remainingBudget ?? (totalBudget - spentBudget)) || 0,
  );
  const budgetProgressRaw = Number(project?.progress_percent ?? project?.progressPercent ?? 0) || 0;
  const budgetProgress = Math.max(0, Math.min(100, budgetProgressRaw));

  const stages = project?.stages ?? [];

  const getStatusClasses = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'done' || normalized === 'completed') {
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    }
    if (normalized === 'in_progress') {
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    }
    return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  };

  const getBudgetProgressClassName = (progressPercent: number) => {
    if (progressPercent >= 80) {
      return 'bg-red-600';
    }
    if (progressPercent >= 50) {
      return 'bg-orange-500';
    }
    return 'bg-green-600';
  };

  const openCreateStageModal = () => {
    if (!canManageProject) {
      return;
    }
    setCreateItemTitle(`Этап ${stages.length + 1}`);
    setStageActionError(null);
    setIsCreateItemModalOpen(true);
  };

  const handleCreateTaskFromStage = async (stageId: string) => {
    if (!canManageProject || isCreatingTask) {
      return;
    }

    setStageActionError(null);
    setIsCreatingTask(true);
    try {
      const { data: newTask } = await api.post(`/stages/${stageId}/tasks`, {
        title: '',
      });

      if (newTask?.id) {
        setProject((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            stages: (prev.stages ?? []).map((stage) => {
              if (stage.id !== stageId) {
                return stage;
              }

              const stageTasks = Array.isArray(stage.tasks) ? stage.tasks : [];
              return {
                ...stage,
                tasks: [...stageTasks, newTask],
              };
            }),
          };
        });

        router.push(`/tasks/${newTask.id}/edit`);
      } else {
        await refresh();
      }
    } catch (error) {
      setStageActionError(getApiErrorMessage(error, 'Не удалось создать задачу'));
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleCreateItem = async () => {
    if (!canManageProject) {
      return;
    }
    const title = createItemTitle.trim();
    if (!title || !project?.id || isCreatingStage) {
      return;
    }

    setStageActionError(null);
    setIsCreatingStage(true);
    try {
      await api.post(`/projects/${project.id}/stages`, {
        title,
        order_index: stages.length,
      });
      setIsCreateItemModalOpen(false);
      setCreateItemTitle('');
      await refresh();
    } catch (error) {
      setStageActionError(getApiErrorMessage(error, 'Не удалось создать этап'));
    } finally {
      setIsCreatingStage(false);
    }
  };

  const handleDeleteStage = async (stageId: string, stageTitle: string) => {
    if (!canManageProject || deletingStageId) {
      return;
    }

    setDeleteConfirm({ type: 'stage', id: stageId, title: stageTitle });
  };

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!canManageProject || deletingTaskId) {
      return;
    }

    setDeleteConfirm({ type: 'task', id: taskId, title: taskTitle });
  };

  const handleOpenTaskPage = (taskId: string) => {
    const normalizedTaskId = String(taskId || '').trim().replace(/^task-/, '');
    if (!normalizedTaskId) {
      return;
    }
    router.push(`/project/task-${normalizedTaskId}`);
  };

  const handleOpenExpenseModal = () => {
    setExpenseActionError(null);
    setExpenseTitle('');
    setExpenseAmount('');
    setIsExpenseModalOpen(true);
  };

  const handleCreateExpense = async () => {
    if (!project?.id || isCreatingExpense) {
      return;
    }

    const parsedAmount = Number.parseInt(expenseAmount.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setExpenseActionError('Введите корректную сумму расхода');
      return;
    }

    setExpenseActionError(null);
    setIsCreatingExpense(true);

    try {
      await api.post(`/projects/${project.id}/expenses`, {
        title: expenseTitle.trim(),
        amount: parsedAmount,
      });
      setIsExpenseModalOpen(false);
      setExpenseTitle('');
      setExpenseAmount('');
      await refresh();
      setExpenseReportRefreshKey((prev) => prev + 1);
    } catch (error) {
      setExpenseActionError(getApiErrorMessage(error, 'Не удалось добавить расход'));
    } finally {
      setIsCreatingExpense(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) {
      return;
    }

    setStageActionError(null);
    if (deleteConfirm.type === 'stage') {
      setDeletingStageId(deleteConfirm.id);
      try {
        await api.delete(`/projects/${project?.id || projectId}/stages/${deleteConfirm.id}`);
        setDeleteConfirm(null);
        await refresh();
      } catch (error) {
        setStageActionError(getApiErrorMessage(error, 'Не удалось удалить этап'));
      } finally {
        setDeletingStageId(null);
      }
      return;
    }

    setDeletingTaskId(deleteConfirm.id);
    try {
      await api.delete(`/tasks/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      await refresh();
    } catch (error) {
      setStageActionError(getApiErrorMessage(error, 'Не удалось удалить задачу'));
    } finally {
      setDeletingTaskId(null);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-background pb-20">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-24">
        {projectError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {projectError}
          </div>
        )}
        {stageActionError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {stageActionError}
          </div>
        )}
        {expenseActionError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {expenseActionError}
          </div>
        )}
        {/* Navigation Buttons - All in one line */}
        <div className="flex flex-col md:flex-row items-center gap-3 mb-12">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-semibold shadow-sm"
          >
            ← Назад
          </button>

          <div className="flex w-full md:w-auto gap-3 overflow-x-auto pb-2 md:pb-0">
            <button className="flex-1 md:flex-none bg-black dark:bg-white text-white dark:text-black px-8 py-2 rounded-full text-sm font-semibold shadow-md whitespace-nowrap">
              Проект
            </button>
            {canManageProject && (
              <button
                onClick={() => router.push(`/projects/${project?.id || projectId}/editor`)}
                className="flex-1 md:flex-none bg-gray-900 text-white px-8 py-2 rounded-full text-sm font-semibold hover:bg-gray-800 transition-colors whitespace-nowrap shadow-md"
              >
                Редактировать проект
              </button>
            )}
            <button
              onClick={() => router.push(`/project/${params.id}/reports`)}
              className="flex-1 md:flex-none bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-8 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
            >
              Отчеты
            </button>
          </div>
          <div className="w-full md:w-auto md:ml-auto flex justify-end">
            <EditorModeBadge role={userRole} />
          </div>
        </div>

        {/* Project Header - Matching Screenshot */}
        <div className="mb-10">
          <div className="w-85 h-47.5 overflow-hidden rounded-[40px] mb-8 shadow-sm ring-1 ring-black/5">
            <img
              src={projectData.image}
              alt="Project"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-[36px] font-bold text-gray-900 dark:text-white tracking-tight mb-10">
            {projectData.title}
          </h1>
        </div>

        {/* Project Info Cards - Matching Screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {/* Deadline Card */}
          <div className="bg-[#E9DFBD] dark:bg-[#4a4225] rounded-[40px] p-7 flex items-center gap-4 shadow-sm">
            <div className="text-gray-900 dark:text-amber-100 shrink-0">
              <Clock className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <p className="text-[15px] font-bold text-gray-900 dark:text-amber-50 leading-tight">
                Начало: {projectData.startDate}
              </p>
              <p className="text-[15px] font-bold text-gray-900 dark:text-amber-50 leading-tight">
                Конец: {projectData.deadline}
              </p>
            </div>
          </div>

          {/* Responsibility Card */}
          <div
            onClick={() => setIsResponsibleModalOpen(true)}
            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[40px] p-7 flex items-center gap-4 shadow-sm relative group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="text-gray-900 dark:text-white shrink-0">
              <Users className="w-9 h-9" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-gray-900 dark:text-white truncate">
                Ответственные: {projectData.responsible}
              </p>
            </div>
            <div className="p-1 rounded-full text-gray-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-45">
                <path d="M7 17l10-10M17 17V7H7" />
              </svg>
            </div>
          </div>

          {/* Warning Card */}
          <div
            onClick={() => setIsDelayReportsModalOpen(true)}
            className="bg-black dark:bg-red-900/40 dark:border dark:border-red-800 rounded-[40px] p-7 flex items-center gap-4 shadow-lg relative group cursor-pointer hover:bg-black/90 dark:hover:bg-red-900/60 transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-red-600 shrink-0 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-white leading-snug">
                {projectData.warningText}
              </p>
            </div>
            <div className="p-1 rounded-full text-white/40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-45">
                <path d="M7 17l10-10M17 17V7H7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Stages */}
        {stages.map((stage, stageIndex) => {
          const stageTasks = (stage.tasks ?? []).filter((task) => task.stage_id === stage.id);

          return (
          <div key={stage.id} className="mb-12">
            {/* Phase Header */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="bg-black dark:bg-white text-white dark:text-black rounded-full px-3 py-1 text-xs font-bold">
                  {stageIndex + 1}
                </div>
                {stage.title}
              </h2>
                {canManageProject && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleCreateTaskFromStage(stage.id)}
                      disabled={deletingStageId === stage.id || isCreatingTask}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" />
                      {isCreatingTask ? 'Создание...' : 'Добавить задачу'}
                    </button>
                    <button
                      onClick={() => void handleDeleteStage(stage.id, stage.title)}
                      disabled={deletingStageId === stage.id}
                      className="inline-flex items-center gap-2 rounded-full border border-red-200 dark:border-red-800 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingStageId === stage.id ? 'Удаление...' : 'Удалить этап'}
                    </button>
                  </div>
                )}
            </div>

            {/* Phase Tasks */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {stageTasks.map((task) => (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenTaskPage(task.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenTaskPage(task.id);
                    }
                  }}
                  className={`bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 transition-shadow ${
                    'hover:shadow-md cursor-pointer'
                  }`}
                >
                  {/* Project name and status */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Проект: {projectName}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(task.status)}`}
                      >
                        {task.status}
                      </div>
                      {canManageProject && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteTask(task.id, task.title);
                          }}
                          disabled={deletingTaskId === task.id}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-60"
                          title="Удалить задачу"
                          aria-label="Удалить задачу"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Task title */}
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">{task.title}</h3>

                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Дедлайн: {formatProjectDeadline(task.deadline)}
                  </p>
                </div>
              ))}
              {stageTasks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-400">
                  Пока нет задач в этом этапе.
                </div>
              )}
            </div>
          </div>
          );
        })}

        {/* Budget Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Бюджет проекта</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">НАЧАЛЬНЫЙ БЮДЖЕТ</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatProjectBudget(totalBudget)} ₸</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">ПОТРАЧЕНО</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatProjectBudget(spentBudget)} ₸</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">ОСТАТОК</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatProjectBudget(remainingBudget)} ₸</p>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-gray-600 dark:text-gray-400">Использовано бюджета</p>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{budgetProgress.toFixed(1)}%</p>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`${getBudgetProgressClassName(budgetProgress)} h-2 rounded-full`}
              style={{ width: `${budgetProgress}%` }}
            />
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              onClick={() => setIsExpenseReportModalOpen(true)}
              className="inline-flex items-center rounded-full border border-white/15 bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:border-gray-600"
            >
              Видеть отчетность
            </button>
            <button
              onClick={handleOpenExpenseModal}
              className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              + Добавить расход
            </button>
          </div>
        </div>

        {/* Add Phase Button */}
        {canManageProject && (
          <div className="flex justify-center">
            <button
              onClick={openCreateStageModal}
              disabled={isCreatingStage}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-60 text-white px-6 py-3 rounded-full font-semibold transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {isCreatingStage ? 'Создание этапа...' : 'Добавить этап проекта'}
            </button>
          </div>
        )}
      </main>

      {isCreateItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Новый этап проекта
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Введите название этапа
            </p>

            <input
              type="text"
              value={createItemTitle}
              onChange={(e) => setCreateItemTitle(e.target.value)}
              placeholder="Например: Этап 2"
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-yellow-900"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreateItem();
                }
                if (e.key === 'Escape') {
                  setIsCreateItemModalOpen(false);
                }
              }}
            />

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreateItemModalOpen(false)}
                className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleCreateItem()}
                disabled={isCreatingStage || !createItemTitle.trim()}
                className="rounded-full bg-yellow-600 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-700 disabled:opacity-60"
              >
                {isCreatingStage ? 'Сохранение...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Новый расход
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Добавьте статью расхода проекта
            </p>

            <div className="space-y-3">
              <input
                type="text"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="Например: Закупка материалов"
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-yellow-900"
              />

              <input
                type="text"
                inputMode="numeric"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Сумма, ₸"
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-yellow-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleCreateExpense();
                  }
                  if (e.key === 'Escape') {
                    setIsExpenseModalOpen(false);
                  }
                }}
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleCreateExpense()}
                disabled={isCreatingExpense}
                className="rounded-full bg-yellow-600 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-700 disabled:opacity-60"
              >
                {isCreatingExpense ? 'Сохранение...' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {deleteConfirm.type === 'stage' ? 'Удалить этап?' : 'Удалить задачу?'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
              {deleteConfirm.type === 'stage'
                ? `Этап «${deleteConfirm.title}» будет удалён вместе со всеми задачами внутри.`
                : `Задача «${deleteConfirm.title}» будет удалена без возможности восстановления.`}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={Boolean(deletingStageId || deletingTaskId)}
                className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={Boolean(deletingStageId || deletingTaskId)}
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingStageId || deletingTaskId ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsible Persons Modal */}
      <ResponsiblePersonsModal
        isOpen={isResponsibleModalOpen}
        onClose={() => setIsResponsibleModalOpen(false)}
        projectId={project?.id || projectId}
        userRole={userRole}
        onChanged={async () => {
          await refresh();
          await loadResponsibleMembers();
        }}
      />

      <DelayReportsModal
        isOpen={isDelayReportsModalOpen}
        onClose={() => setIsDelayReportsModalOpen(false)}
        projectId={project?.id || projectId}
        isProjectOverviewMode
      />

      <ProjectExpenseReportModal
        isOpen={isExpenseReportModalOpen}
        onClose={() => setIsExpenseReportModalOpen(false)}
        projectId={project?.id || projectId}
        refreshKey={expenseReportRefreshKey}
      />
    </div>
  );
}
