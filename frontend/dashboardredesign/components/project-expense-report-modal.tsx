'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, ReceiptText } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';

type ProjectExpense = {
  id: string;
  project_id: string;
  title: string;
  amount: number;
  created_by: string;
  created_at: string;
};

interface ProjectExpenseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  refreshKey?: number;
}

function formatAmount(value: number) {
  return `${new Intl.NumberFormat('ru-RU').format(Math.max(0, Number(value) || 0))} ₸`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function ProjectExpenseReportModal({
  isOpen,
  onClose,
  projectId,
  refreshKey = 0,
}: ProjectExpenseReportModalProps) {
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExpenses = async (targetProjectId?: string) => {
    if (!targetProjectId) return;

    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ProjectExpense[]>(`/projects/${targetProjectId}/expenses`);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Не удалось загрузить отчетность расходов'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void loadExpenses(projectId);
  }, [isOpen, projectId, refreshKey]);

  const summary = useMemo(() => {
    const totalAmount = expenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    return {
      totalAmount,
      operationCount: expenses.length,
    };
  }, [expenses]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-black/45 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/10 p-2 text-white">
              <ReceiptText className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Отчетность расходов проекта</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 rounded-xl border border-red-400/40 bg-red-900/30 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs text-white/60">Всего расходов</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatAmount(summary.totalAmount)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs text-white/60">Количество операций</p>
              <p className="mt-1 text-lg font-semibold text-white">{summary.operationCount}</p>
            </div>
          </div>

          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="text-sm text-white/70">Загрузка...</div>
            ) : expenses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 px-4 py-6 text-center text-sm text-white/60">
                Расходов пока нет.
              </div>
            ) : (
              expenses.map((expense) => (
                <div key={expense.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{expense.title || 'Расход'}</p>
                      <p className="mt-1 text-xs text-white/60">{formatDate(expense.created_at)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-emerald-300">{formatAmount(expense.amount)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
