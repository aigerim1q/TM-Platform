'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GraphProvider } from '@/components/hierarchy-graph/GraphProvider';
import { HierarchyGraphCanvas } from '@/components/hierarchy-graph/HierarchyGraphCanvas';
import { useHierarchyGraphStore } from '@/store/useHierarchyGraphStore';

function HierarchyGraphScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loading = useHierarchyGraphStore((state) => state.loading);

  const pickerMode = String(searchParams.get('mode') || '').trim().toLowerCase() === 'pick-assignee';
  const returnTo = useMemo(() => {
    const candidate = String(searchParams.get('returnTo') || '').trim();
    if (!candidate || !candidate.startsWith('/')) {
      return '/dashboard';
    }
    return candidate;
  }, [searchParams]);

  const buildReturnUrl = useCallback(
    (userId?: string) => {
      const base = new URL(returnTo, window.location.origin);
      if (userId) {
        base.searchParams.set('selectedAssignee', userId);
      }
      return `${base.pathname}${base.search}${base.hash}`;
    },
    [returnTo],
  );

  const handleUserNodePick = useCallback(
    ({ userId }: { userId: string; title: string }) => {
      if (!pickerMode) {
        return;
      }

      const normalized = String(userId || '').trim();
      if (!normalized) {
        return;
      }

      router.push(buildReturnUrl(normalized));
    },
    [buildReturnUrl, pickerMode, router],
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {pickerMode && (
        <div className="absolute left-4 top-4 z-20 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 shadow-xl dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100">
          <p className="font-semibold">Режим выбора ответственного</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Нажмите на узел сотрудника, чтобы назначить его на задачу.</p>
          <button
            type="button"
            onClick={() => router.push(buildReturnUrl())}
            className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Вернуться к задаче
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex h-full w-full items-center justify-center text-sm text-slate-600 dark:text-slate-300">
          Загрузка иерархии...
        </div>
      ) : (
        <HierarchyGraphCanvas onUserNodePick={handleUserNodePick} />
      )}

    </div>
  );
}

export default function HierarchyPage() {
  return (
    <GraphProvider>
      <Suspense
        fallback={
          <div className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-600 dark:text-slate-300">
              Загрузка иерархии...
            </div>
          </div>
        }
      >
        <HierarchyGraphScreen />
      </Suspense>
    </GraphProvider>
  );
}
