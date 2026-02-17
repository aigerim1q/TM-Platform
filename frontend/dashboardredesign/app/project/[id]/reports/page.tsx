'use client';

import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, MessageCircle, AlertCircle, Send, Paperclip, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '@/components/header';
import { api, getApiErrorMessage } from '@/lib/api';
import { getDisplayNameFromEmail, getFileUrl } from '@/lib/utils';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '');

type TaskResponse = {
  id: string;
  title: string;
  deadline?: string | null;
};

type ProjectResponse = {
  id: string;
  title?: string;
};

type TaskComment = {
  id: string;
  message: string;
  created_at?: string;
  createdAt?: string;
  task_id?: string | null;
  taskId?: string | null;
  author?: {
    id?: string;
    email?: string;
  };
};

type ParsedMessage = {
  text: string;
  attachments: string[];
};

function parseCommentMessage(message: string): ParsedMessage {
  const lines = message.split('\n');
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

function resolveAttachmentUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return getFileUrl(url) || url;
}

function detectUploadType(file: File): 'image' | 'video' | 'file' {
  const mime = file.type.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

async function uploadAttachment(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', detectUploadType(file));

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Не удалось загрузить файл');
  }

  const payload = (await res.json()) as { url?: string };
  if (!payload.url) {
    throw new Error('Файл загружен, но URL не получен');
  }

  return payload.url;
}

function formatDate(input?: string) {
  if (!input) return '';
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export default function ReportsPage() {
  const router = useRouter();
  const params = useParams();
  const [task, setTask] = useState<TaskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<TaskComment[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [reportText, setReportText] = useState('');
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const rawId = useMemo(() => String(params.id || ''), [params.id]);
  const isTaskReportsPage = useMemo(() => rawId.startsWith('task-'), [rawId]);
  const taskId = useMemo(() => (isTaskReportsPage ? rawId.slice(5) : ''), [isTaskReportsPage, rawId]);
  const projectId = useMemo(() => (isTaskReportsPage ? '' : rawId), [isTaskReportsPage, rawId]);
  const detailsRoute = useMemo(
    () => (isTaskReportsPage ? `/project/${rawId}` : `/project-overview/${rawId}`),
    [isTaskReportsPage, rawId],
  );

  const normalizeProjectReports = (items: TaskComment[]) =>
    items.filter((item) => {
      const linkedTaskId = String(item.task_id || item.taskId || '').trim();
      return linkedTaskId.length === 0;
    });

  const fetchChatMessages = useCallback(async () => {
    if (!taskId && !projectId) return;
    const { data } = isTaskReportsPage
      ? await api.get<TaskComment[]>(`/tasks/${taskId}/comments`)
      : await api.get<TaskComment[]>(`/projects/${projectId}/delay-report`);
    const normalizedComments = Array.isArray(data) ? data : [];
    setChatMessages(isTaskReportsPage ? normalizedComments : normalizeProjectReports(normalizedComments));
  }, [isTaskReportsPage, projectId, taskId]);

  useEffect(() => {
    if (!taskId && !projectId) {
      setChatMessages([]);
      return;
    }

    let cancelled = false;

    const loadPage = async () => {
      try {
        setIsLoading(true);
        setIsLoadingChat(true);
        setPageError(null);
        setChatError(null);

        const [entityRes, commentsRes] = await Promise.all(
          isTaskReportsPage
            ? [
                api.get<TaskResponse>(`/tasks/${taskId}`),
                api.get<TaskComment[]>(`/tasks/${taskId}/comments`),
              ]
            : [
                api.get<ProjectResponse>(`/projects/${projectId}`),
                api.get<TaskComment[]>(`/projects/${projectId}/delay-report`),
              ],
        );

        if (cancelled) return;
        const entity = entityRes?.data;
        const commentsData = commentsRes?.data;

        setTask(
          entity
            ? {
                id: String(entity.id || ''),
                title: String(entity.title || ''),
                deadline: isTaskReportsPage ? (entity as TaskResponse).deadline : null,
              }
            : null,
        );
        const normalizedComments = Array.isArray(commentsData) ? commentsData : [];
        setChatMessages(isTaskReportsPage ? normalizedComments : normalizeProjectReports(normalizedComments));
      } catch {
        if (!cancelled) {
          setPageError(
            isTaskReportsPage
              ? 'Не удалось загрузить страницу отчетов по задаче'
              : 'Не удалось загрузить страницу отчетов по проекту',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsLoadingChat(false);
        }
      }
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [isTaskReportsPage, projectId, taskId]);

  const reloadChat = async () => {
    await fetchChatMessages();
  };

  useEffect(() => {
    if (!taskId && !projectId) return;

    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      void fetchChatMessages();
    }, 3000);

    const onVisible = () => {
      if (!document.hidden) {
        void fetchChatMessages();
      }
    };

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchChatMessages, projectId, taskId]);

  const sendChatMessage = async () => {
    if ((!taskId && !projectId) || !chatInput.trim()) return;
    try {
      setIsSendingChat(true);
      setChatError(null);
      if (isTaskReportsPage) {
        await api.post(`/tasks/${taskId}/comment`, {
          message: chatInput.trim(),
        });
      } else {
        await api.post(`/projects/${projectId}/delay-report`, {
          message: chatInput.trim(),
        });
      }
      setChatInput('');
      await reloadChat();
    } catch {
      setChatError('Не удалось отправить сообщение');
    } finally {
      setIsSendingChat(false);
    }
  };

  const publishReport = async () => {
    if ((!taskId && !projectId) || isPublishing) return;
    if (!reportText.trim() && reportFiles.length === 0) return;

    try {
      setIsPublishing(true);
      setPublishError(null);

      const uploadedUrls: string[] = [];
      for (const file of reportFiles) {
        const uploadedUrl = await uploadAttachment(file);
        uploadedUrls.push(uploadedUrl);
      }

      const text = reportText.trim();
      const filesText = uploadedUrls.length
        ? `Вложения:\n${uploadedUrls.map((url) => `- ${url}`).join('\n')}`
        : '';

      const message = [text, filesText].filter(Boolean).join('\n\n');

      if (isTaskReportsPage) {
        await api.post(`/tasks/${taskId}/comment`, { message });
      } else {
        await api.post(`/projects/${projectId}/delay-report`, { message });
      }
      setReportText('');
      setReportFiles([]);
      await reloadChat();
    } catch (error) {
      setPublishError(getApiErrorMessage(error, 'Не удалось опубликовать отчет'));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-background pb-20">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-24">
        {/* Top Navigation - Spread Layout */}
        <div className="flex flex-col lg:flex-row items-center justify-between mb-8 gap-4 lg:gap-0">
          {/* Left Side Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <button
              onClick={() => router.push(detailsRoute)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Назад
            </button>

            <div className="flex w-full sm:w-auto gap-4 overflow-x-auto pb-2 sm:pb-0 justify-center">
              <button
                onClick={() => router.push(detailsRoute)}
                className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-8 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
              >
                  {isTaskReportsPage ? 'Задача' : 'Проект'}
              </button>

              <button className="bg-black dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap">
                Отчеты
              </button>

              <button
                type="button"
                onClick={() => router.push('/documents')}
                className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
              >
                Документы
              </button>
            </div>
          </div>

          {/* Center Button */}
          <div className="w-full sm:w-auto bg-amber-100 text-amber-900 px-6 py-2.5 rounded-full text-sm font-semibold text-center">
            {isTaskReportsPage ? 'Отчеты по задаче' : 'Отчеты по проекту'}
          </div>

          {/* Right Side Buttons */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {task?.title
              ? `${isTaskReportsPage ? 'Задача' : 'Проект'}: ${task.title}`
              : `Загрузка ${isTaskReportsPage ? 'задачи' : 'проекта'}...`}
          </div>
        </div>

        {pageError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
            {pageError}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Report */}
          <div className="lg:col-span-2">
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {task?.title || 'Отчеты по задаче'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Дедлайн: {formatDate(task?.deadline || undefined) || 'не указан'}
              </p>
            </div>

            <div className="flex items-center gap-2 py-3 border-t border-b border-gray-200 dark:border-gray-800 mb-6 text-gray-600 dark:text-gray-400">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm">Всего сообщений: {chatMessages.length}</span>
            </div>

            <div className="space-y-4">
              {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка отчетов...</p>}

              {!isLoading && chatMessages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400">
                  Пока нет отчетов. Создайте первый отчет справа.
                </div>
              )}

              {chatMessages.map((entry) => {
                const parsed = parseCommentMessage(entry.message || '');
                return (
                  <div key={entry.id} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {getDisplayNameFromEmail(entry.author?.email || 'Участник')}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(entry.created_at || entry.createdAt)}</p>
                    </div>

                    {parsed.text && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">{parsed.text}</p>
                    )}

                    {parsed.attachments.length > 0 && (
                      <div className="space-y-2">
                        {parsed.attachments.map((url, idx) => {
                          const fullUrl = resolveAttachmentUrl(url);
                          const isImage = /\.(png|jpe?g|webp)$/i.test(fullUrl);
                          const isVideo = /\.(mp4|mov)$/i.test(fullUrl);

                          if (isImage) {
                            return (
                              <img
                                key={`${entry.id}-img-${idx}`}
                                src={fullUrl}
                                alt="attachment"
                                className="w-full max-h-80 rounded-xl object-cover"
                              />
                            );
                          }

                          if (isVideo) {
                            return (
                              <video
                                key={`${entry.id}-video-${idx}`}
                                src={fullUrl}
                                controls
                                className="w-full max-h-80 rounded-xl"
                              />
                            );
                          }

                          return (
                            <a
                              key={`${entry.id}-file-${idx}`}
                              href={fullUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block text-sm text-amber-600 hover:text-amber-700 underline"
                            >
                              Открыть вложение {idx + 1}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            {/* Task Reports Chat */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Чат по отчетам</h3>

              {!taskId && !projectId && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Чат недоступен для этой страницы</p>
              )}

              {(taskId || projectId) && (
                <>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1 mb-4">
                    {isLoadingChat && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка сообщений...</p>
                    )}

                    {!isLoadingChat && chatMessages.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Сообщений пока нет</p>
                    )}

                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{getDisplayNameFromEmail(msg.author?.email || 'Участник')}</p>
                          <p className="text-xs text-gray-500">{formatDate(msg.created_at || msg.createdAt)}</p>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-end gap-2">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Напишите отчет или сообщение..."
                      className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      rows={3}
                    />
                    <button
                      type="button"
                      onClick={() => void sendChatMessage()}
                      disabled={isSendingChat || !chatInput.trim()}
                      className="h-10 w-10 shrink-0 rounded-full bg-yellow-500 text-white flex items-center justify-center hover:bg-yellow-600 disabled:opacity-60"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  {chatError && <p className="mt-2 text-xs text-red-500">{chatError}</p>}
                </>
              )}
            </div>

            {/* Warnings Section */}
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 flex gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-900 mb-1">Прочие отсрочки</p>
                  <p className="text-xs text-orange-800">Сроки и отчеты синхронизируются по текущей задаче</p>
                </div>
              </div>

            {/* Create Report Card */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">📝</span>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Создать отчет</h3>
              </div>

              {/* Description Section */}
              <div className="mb-8">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 tracking-wide">ОПИСАНИЕ РАБОТЫ</label>
                <textarea
                  placeholder="Что было сделано сегодня?"
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-32 text-gray-900 dark:text-white"
                />
              </div>

              {/* Media Files Section */}
              <div className="mb-8">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-4 tracking-wide">МЕДИА ФАЙЛЫ</label>

                <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 text-center">
                  <input
                    id="report-files-input"
                    type="file"
                    multiple
                    accept="image/*,video/mp4,video/quicktime,.pdf,.doc,.docx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []);
                      if (picked.length > 0) {
                        setReportFiles((prev) => [...prev, ...picked]);
                      }
                      e.currentTarget.value = '';
                    }}
                  />

                  <label
                    htmlFor="report-files-input"
                    className="inline-flex items-center gap-2 cursor-pointer rounded-full px-4 py-2 bg-amber-100 text-amber-900 text-sm font-semibold hover:bg-amber-200"
                  >
                    <Paperclip className="w-4 h-4" />
                    Добавить файлы
                  </label>

                  <p className="text-xs text-gray-400 mt-3">JPG, PNG, WEBP, MP4, MOV, PDF, DOC, DOCX, XLS</p>

                  {reportFiles.length > 0 && (
                    <div className="mt-4 space-y-2 text-left">
                      {reportFiles.map((file, idx) => (
                        <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm">
                          <span className="truncate text-gray-700 dark:text-gray-300">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setReportFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Publish Button */}
              <button
                type="button"
                onClick={() => void publishReport()}
                disabled={isPublishing || (!reportText.trim() && reportFiles.length === 0)}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors disabled:opacity-60"
              >
                {isPublishing ? 'Публикация...' : 'Опубликовать'}
              </button>

              {publishError && <p className="mt-3 text-xs text-red-500">{publishError}</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
