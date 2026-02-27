'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, AtSign, CheckCircle2, Clock3, ImagePlus, MessageSquare, Paperclip, Send, Share2 } from 'lucide-react';
import Header from '@/components/header';
import BlockRenderer from '@/components/editor/BlockRenderer';
import { packTaskBlocks, unpackTaskBlocks, type EditorBlock } from '@/components/editor/taskBlockMeta';
import { api, getApiErrorMessage, getApiStatus, getCurrentUserId } from '@/lib/api';
import { useProject } from '@/hooks/useProject';
import { getDisplayNameFromEmail } from '@/lib/utils';
import LoadingSplash from '@/components/loading-splash';

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

type TaskComment = {
  id: string;
  task_id: string;
  project_id: string;
  user_id: string;
  message: string;
  created_at: string;
  author?: { email?: string };
};

type TaskHistoryItem = {
  id: string;
  task_id?: string | null;
  taskId?: string | null;
  message: string;
  created_at: string;
  author?: { email?: string };
};

function toDateLabel(input?: string | null) {
  if (!input) return '—';
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return String(input);
  return parsed.toLocaleString('ru-RU');
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

export default function ProjectTaskPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = String(params.id || '');
  const taskId = rawId.startsWith('task-') ? rawId.slice(5) : rawId;

  const [task, setTask] = useState<TaskResponse | null>(null);
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [isSubmittingDelay, setIsSubmittingDelay] = useState(false);

  const projectId = task?.project_id || '';
  const { project, refresh } = useProject(projectId || undefined);
  const userRole = (project?.current_user_role || project?.currentUserRole || 'member') as 'owner' | 'manager' | 'member';
  const currentUserId = getCurrentUserId();

  const stageTitle = useMemo(() => {
    if (!project?.stages || !task?.stage_id) return 'Этап';
    return project.stages.find((stage) => stage.id === task.stage_id)?.title || 'Этап';
  }, [project?.stages, task?.stage_id]);

  const canWrite = useMemo(() => {
    if (userRole === 'owner' || userRole === 'manager') {
      return true;
    }

    const normalizedUserID = normalizeToken(currentUserId);
    if (!normalizedUserID) {
      return false;
    }

    const normalizedAssignees = new Set(assignees.map((item) => normalizeToken(item)).filter(Boolean));
    return normalizedAssignees.has(normalizedUserID);
  }, [assignees, currentUserId, userRole]);
  const canManage = canWrite;

  const loadTask = async () => {
    if (!taskId) return;

    setLoading(true);
    setIsNotFound(false);
    setError(null);
    try {
      const [{ data: taskData }, { data: commentsData }, { data: historyData }] = await Promise.all([
        api.get<TaskResponse>(`/tasks/${taskId}`),
        api.get<TaskComment[]>(`/tasks/${taskId}/comments`),
        api.get<TaskHistoryItem[]>(`/tasks/${taskId}/history`),
      ]);

      setTask(taskData);

      const unpacked = unpackTaskBlocks(taskData?.blocks);
      setBlocks(unpacked.blocks);
      setAssignees(unpacked.assignees);
      setComments(Array.isArray(commentsData) ? commentsData : []);
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (loadError) {
      const status = getApiStatus(loadError);
      if (status === 404) {
        setIsNotFound(true);
        setTask(null);
        setBlocks([]);
        setAssignees([]);
        setComments([]);
        setHistory([]);
      } else {
        setError(getApiErrorMessage(loadError, 'Не удалось загрузить задачу'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTask();
  }, [taskId]);

  const appendHistory = async (message: string) => {
    if (!projectId || !taskId) return;

    await api.post(`/projects/${projectId}/delay-report`, {
      taskId,
      message,
    });
  };

  const updateStatus = async (nextStatus: string, historyMessage: string) => {
    if (!task) return;

    try {
      await api.patch(`/tasks/${task.id}`, {
        title: task.title,
        status: nextStatus,
        startDate: task.start_date || task.startDate || null,
        deadline: task.deadline,
        assignees,
        blocks: packTaskBlocks(blocks, assignees),
        expected_updated_at: task.updated_at || task.updatedAt,
      });
      await appendHistory(historyMessage);
      await loadTask();
      await refresh();
    } catch (statusError) {
      setError(getApiErrorMessage(statusError, 'Не удалось изменить статус задачи'));
    }
  };

  const openDelayModal = () => {
    if (!canWrite) {
      setError('Только назначенные участники могут указать причину просрочки');
      return;
    }

    setError(null);
    setDelayReason('');
    setIsDelayModalOpen(true);
  };

  const handleDelaySubmit = async () => {
    const reason = delayReason.trim();

    if (!reason) {
      setError('Заполните причину просрочки');
      return;
    }

    setIsSubmittingDelay(true);
    try {
      await updateStatus('delayed', `Почему просрочка: ${reason}`);
      setIsDelayModalOpen(false);
      setDelayReason('');
    } finally {
      setIsSubmittingDelay(false);
    }
  };

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text || !taskId || isSendingComment || !canWrite) {
      return;
    }

    setIsSendingComment(true);
    try {
      await api.post(`/tasks/${taskId}/comment`, {
        message: text,
      });
      setCommentText('');
      await loadTask();
    } catch (commentError) {
      setError(getApiErrorMessage(commentError, 'Не удалось отправить комментарий'));
    } finally {
      setIsSendingComment(false);
    }
  };

  if (!taskId) {
    return null;
  }

  if (loading && !task) {
    return (
      <div className="min-h-screen bg-white dark:bg-background pb-20">
        <Header />
        <main className="max-w-6xl mx-auto px-6 pt-24">
          <LoadingSplash compact title="Загружаем задачу" subtitle="Собираем данные задачи..." />
        </main>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="min-h-screen bg-white dark:bg-background pb-20">
        <Header />
        <main className="max-w-6xl mx-auto px-6 pt-24">
          <p className="text-sm text-gray-500">Task not found</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-background pb-20">
      <Header />

      <main className="max-w-6xl mx-auto px-6 pt-24">
        <div className="mb-6">
          <button
            onClick={() => {
              if (projectId) {
                router.push(`/project-overview/${projectId}`);
                return;
              }
              router.back();
            }}
            className="rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            ← Назад
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          <span>{project?.title || 'Проект'}</span>
          <span className="mx-2">/</span>
          <span>{stageTitle}</span>
          <span className="mx-2">/</span>
          <span className="font-semibold text-gray-900 dark:text-white">{task?.title || 'Задача'}</span>
        </div>

        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">{task?.title || 'Задача'}</h1>
        <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">
          Старт: {toDateLabel(task?.start_date || task?.startDate)}
          {' • '}
          Дедлайн: {toDateLabel(task?.deadline)}
          {assignees.length > 0 ? ` • Исполнители: ${assignees.length}` : ''}
        </p>

        <div className="mb-8 flex flex-wrap gap-3">
          <button
            onClick={() => void updateStatus('done', 'Статус изменен: задача завершена')}
            className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4" /> Завершить задачу
          </button>
          <button
            onClick={openDelayModal}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Clock3 className="h-4 w-4" /> Отложить задачу
          </button>
          {canManage && (
            <button
              onClick={() => void appendHistory('Задача делегирована')}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Share2 className="h-4 w-4" /> Делегировать
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push('/documents')}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Paperclip className="h-4 w-4" /> Документы
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 mb-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Содержимое задачи</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Загрузка...</p>
          ) : blocks.length === 0 ? (
            <p className="text-sm text-gray-500">Пусто</p>
          ) : (
            <div className="space-y-3">
              {blocks.map((block) => (
                <BlockRenderer key={block.id} block={block} readOnly />
              ))}
            </div>
          )}
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === 'comments'
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              <MessageSquare className="h-4 w-4" /> Комментарии
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === 'history'
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              <AlertCircle className="h-4 w-4" /> История
            </button>
          </div>

          <div className="mb-4 max-h-96 space-y-3 overflow-y-auto">
            {activeTab === 'comments' &&
              (comments.length === 0 ? (
                <p className="text-sm text-gray-500">Комментариев пока нет</p>
              ) : (
                comments.map((item) => (
                  <div key={item.id} className="rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                    <p className="text-gray-900 dark:text-gray-100">{item.message}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {getDisplayNameFromEmail(item.author?.email || 'Пользователь')} • {toDateLabel(item.created_at)}
                    </p>
                  </div>
                ))
              ))}

            {activeTab === 'history' &&
              (history.length === 0 ? (
                <p className="text-sm text-gray-500">История пока пустая</p>
              ) : (
                history.map((item) => (
                  <div key={`timeline-${item.id}`} className="border-l-2 border-amber-400 pl-3">
                    <p className="text-sm text-gray-900 dark:text-gray-100">{item.message}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {getDisplayNameFromEmail(item.author?.email || 'Пользователь')} • {toDateLabel(item.created_at)}
                    </p>
                  </div>
                ))
              ))}
          </div>

          {activeTab === 'comments' &&
            (canWrite ? (
              <div className="flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Написать комментарий..."
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-gray-700 dark:bg-gray-800"
                />
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl border border-gray-300 px-3 py-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="Упомянуть пользователя"
                  title="Упомянуть пользователя"
                >
                  <AtSign className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl border border-gray-300 px-3 py-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="Добавить фото"
                  title="Добавить фото"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl border border-gray-300 px-3 py-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="Прикрепить файл"
                  title="Прикрепить файл"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  onClick={() => void handleSendComment()}
                  disabled={isSendingComment}
                  className="inline-flex items-center rounded-xl bg-amber-500 px-3 py-2 text-white hover:bg-amber-600 disabled:opacity-60"
                  aria-label="Отправить комментарий"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Только назначенные участники могут писать в обсуждении
              </div>
            ))}
        </section>
      </main>

      {isDelayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!isSubmittingDelay) {
                setIsDelayModalOpen(false);
              }
            }}
          />

          <div className="relative z-10 w-full rounded-t-3xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:max-w-md sm:rounded-3xl">
            <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">Проблема / статус</h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Укажите причину просрочки.</p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">Почему просрочка</label>
                <textarea
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  placeholder="Коротко опишите причину"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  disabled={isSubmittingDelay}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDelayModalOpen(false)}
                disabled={isSubmittingDelay}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleDelaySubmit()}
                disabled={isSubmittingDelay}
                className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {isSubmittingDelay ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
