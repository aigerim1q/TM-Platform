'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { getDisplayNameFromEmail } from '@/lib/utils';

type DelayReportEntity = {
  id: string;
  project_id: string;
  user_id: string;
  stage_id?: string | null;
  task_id?: string | null;
  taskId?: string | null;
  message: string;
  created_at?: string;
  createdAt?: string;
  author?: {
    id: string;
    email: string;
  };
};

interface DelayReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  taskId?: string;
  isProjectOverviewMode?: boolean;
  onChanged?: () => void | Promise<void>;
}

const PROJECT_OVERVIEW_PREFIX = '[PROJECT_OVERVIEW_DELAY]';

function hasProjectOverviewPrefix(message?: string | null) {
  return String(message || '').trim().startsWith(PROJECT_OVERVIEW_PREFIX);
}

function stripProjectOverviewPrefix(message?: string | null) {
  const text = String(message || '').trim();
  if (!hasProjectOverviewPrefix(text)) {
    return text;
  }

  return text.slice(PROJECT_OVERVIEW_PREFIX.length).trim();
}

function extractDelayReason(message?: string | null) {
  const text = stripProjectOverviewPrefix(message);
  if (!text) {
    return '';
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^(почему просрочка:|причина просрочки:)/i.test(line)) {
      return line.replace(/^(почему просрочка:|причина просрочки:)/i, '').trim();
    }
  }

  const oneLine = text.replace(/\s+/g, ' ').trim();
  const reasonMatch = oneLine.match(/(?:почему просрочка:|причина просрочки:)\s*(.+)$/i);
  if (reasonMatch?.[1]?.trim()) {
    return reasonMatch[1].trim();
  }

  const cleaned = lines
    .filter((line) => !/^(кто автор:|кто пишет:)/i.test(line))
    .join(' ')
    .trim();

  return cleaned || text;
}

function isDelayReasonReportMessage(message?: string | null) {
  const text = stripProjectOverviewPrefix(message).toLowerCase().trim();
  if (!text) {
    return false;
  }

  return text.includes('почему просрочка') || text.includes('причина просрочки');
}

function getInitials(email: string) {
  const trimmed = email.trim();
  if (!trimmed) return 'U';
  return trimmed.slice(0, 2).toUpperCase();
}

function getAvatarColor(seed: string) {
  const palette = [
    'bg-rose-100 text-rose-700',
    'bg-sky-100 text-sky-700',
    'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700',
    'bg-orange-100 text-orange-700',
    'bg-cyan-100 text-cyan-700',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) % palette.length;
  }
  return palette[hash];
}

function formatCreatedAt(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DelayReportsModal({ isOpen, onClose, projectId, taskId, isProjectOverviewMode = false, onChanged }: DelayReportsModalProps) {
  const [reports, setReports] = useState<DelayReportEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [reasonLine, setReasonLine] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = reasonLine.trim().length > 0 && !isSaving;

  const sortedReports = useMemo(() => {
    const filtered = taskId
      ? reports.filter((item) => {
          const reportTaskID = String(item.task_id || item.taskId || '').trim();
          return reportTaskID === taskId && isDelayReasonReportMessage(item.message);
        })
      : isProjectOverviewMode
        ? reports.filter((item) => {
            const linkedTaskId = String(item.task_id || item.taskId || '').trim();
            return !linkedTaskId && hasProjectOverviewPrefix(item.message) && isDelayReasonReportMessage(item.message);
          })
        : reports.filter((item) => isDelayReasonReportMessage(item.message));

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.created_at || a.createdAt || '').getTime();
      const bTime = new Date(b.created_at || b.createdAt || '').getTime();
      return bTime - aTime;
    });
  }, [isProjectOverviewMode, reports, taskId]);

  const loadReports = async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get<DelayReportEntity[]>(`/projects/${projectId}/delay-report`);
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Не удалось загрузить причины просрочки'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !projectId) return;

    setIsFormOpen(false);
    setReasonLine('');
    void loadReports();
  }, [isOpen, projectId]);

  const handleSubmit = async () => {
    if (!projectId || !canSubmit) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const body = `Почему просрочка: ${reasonLine.trim()}`;
      const message = isProjectOverviewMode
        ? `${PROJECT_OVERVIEW_PREFIX} ${body}`
        : body;
      await api.post(`/projects/${projectId}/delay-report`, {
        taskId: taskId || undefined,
        message,
      });
      setReasonLine('');
      setIsFormOpen(false);
      await loadReports();
      await onChanged?.();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Не удалось добавить причину просрочки'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl rounded-3xl bg-[#F5F5F5] p-0 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/30 dark:text-red-300">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Причины просрочки</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 transition-colors hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setIsFormOpen((prev) => !prev)}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              + Добавить причину
            </button>
          </div>

          {isFormOpen && (
            <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Почему просрочка</label>
                  <input
                    value={reasonLine}
                    onChange={(e) => setReasonLine(e.target.value)}
                    placeholder="Коротко опишите причину"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-yellow-900"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit}
                  className="rounded-full bg-yellow-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-yellow-700 disabled:opacity-60"
                >
                  {isSaving ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : sortedReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Пока нет причин просрочки.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedReports.map((report) => {
                const displayName = getDisplayNameFromEmail(report.author?.email);
                return (
                  <div
                    key={report.id}
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(
                          report.author?.id || report.user_id || report.id,
                        )}`}
                      >
                        {getInitials(displayName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {displayName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatCreatedAt(report.created_at || report.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-gray-500 dark:text-gray-400">Почему просрочка:</span>{' '}
                      {extractDelayReason(report.message)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
