'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppSidebar from '@/components/app-sidebar';
import { api, getApiErrorMessage } from '@/lib/api';

type ProjectOption = {
  id: string;
  title: string;
  current_user_role?: 'owner' | 'manager' | 'member';
  currentUserRole?: 'owner' | 'manager' | 'member';
};

type StageOption = {
  id: string;
  title: string;
  order_index?: number;
};

function canEditProject(project: ProjectOption | null) {
  if (!project) {
    return false;
  }

  const role = project.current_user_role || project.currentUserRole || 'member';
  return role === 'owner' || role === 'manager';
}

function AutoCreateTask() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preferredProjectId = useMemo(() => String(searchParams.get('projectId') || ''), [searchParams]);
  const preferredStageId = useMemo(() => String(searchParams.get('stageId') || ''), [searchParams]);

  const [statusText, setStatusText] = useState('Создаем задачу...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const createTask = async () => {
      try {
        setError(null);
        setStatusText('Загружаем проекты...');

        const { data: projectsData } = await api.get<ProjectOption[]>('/projects');
        const projects = Array.isArray(projectsData) ? projectsData : [];

        if (projects.length === 0) {
          throw new Error('Нет доступных проектов');
        }

        const editableProjects = projects.filter((project) => canEditProject(project));
        const selectedProject =
          editableProjects.find((project) => project.id === preferredProjectId) ||
          editableProjects[0] ||
          null;

        if (!selectedProject) {
          throw new Error('Для создания задач нужны права owner или manager');
        }

        setStatusText('Загружаем этапы...');
        const { data: stagesData } = await api.get<StageOption[]>(`/projects/${selectedProject.id}/stages`);
        const sortedStages = (Array.isArray(stagesData) ? stagesData : []).sort(
          (a, b) => Number(a.order_index || 0) - Number(b.order_index || 0),
        );

        if (sortedStages.length === 0) {
          throw new Error('В выбранном проекте нет этапов');
        }

        const selectedStage = sortedStages.find((stage) => stage.id === preferredStageId) || sortedStages[0];

        setStatusText('Создаем задачу...');
        const { data: taskData } = await api.post<{ id: string }>(`/stages/${selectedStage.id}/tasks`, {
          title: 'Новая задача',
          deadline: null,
        });

        if (!taskData?.id) {
          throw new Error('Не удалось получить id задачи');
        }

        if (!cancelled) {
          router.replace(`/tasks/${taskData.id}/edit`);
        }
      } catch (e) {
        if (!cancelled) {
          setError(getApiErrorMessage(e, e instanceof Error ? e.message : 'Не удалось создать задачу'));
        }
      }
    };

    void createTask();

    return () => {
      cancelled = true;
    };
  }, [preferredProjectId, preferredStageId, router]);

  return (
    <div className="flex min-h-screen bg-white dark:bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-12">
          <div className="mb-8 flex items-center justify-between gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Новая задача</h1>
          </div>

          {!error && <p className="text-sm text-gray-500 dark:text-gray-400">{statusText}</p>}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mt-6 rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Назад
          </button>
        </div>
      </main>
    </div>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={null}>
      <AutoCreateTask />
    </Suspense>
  );
}
