'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';

export type ProjectEntity = {
  id: string;
  title: string;
  current_user_role?: 'owner' | 'manager' | 'member';
  currentUserRole?: 'owner' | 'manager' | 'member';
  updated_at?: string;
  updatedAt?: string;
  budget?: number | null;
  total_budget?: number | null;
  spent_budget?: number | null;
  remaining_budget?: number | null;
  progress_percent?: number | null;
  spentBudget?: number | null;
  remainingBudget?: number | null;
  progressPercent?: number | null;
  deadline?: string | null;
  start_date?: string | null;
  startDate?: string | null;
  cover_url?: string | null;
  coverUrl?: string | null;
  blocks?: unknown;
  stages?: StageEntity[];
};

export type StageEntity = {
  id: string;
  project_id: string;
  title: string;
  order_index: number;
  tasks: TaskEntity[];
};

export type TaskEntity = {
  id: string;
  stage_id: string;
  title: string;
  status: string;
  updated_at?: string;
  updatedAt?: string;
  deadline?: string | null;
  order_index: number;
};

export function useProject(projectId?: string) {
  const [project, setProject] = useState<ProjectEntity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data } = await api.get<ProjectEntity>(`/projects/${projectId}`);
      const projectData = data ?? null;

      if (!projectData) {
        setProject(null);
        return;
      }

      const { data: stagesData } = await api.get<StageEntity[]>(`/projects/${projectId}/stages`);
      const stages = Array.isArray(stagesData) ? stagesData : [];

      const stagesWithTasks = await Promise.all(
        stages.map(async (stage) => {
          const { data: tasksData } = await api.get<TaskEntity[]>(`/stages/${stage.id}/tasks`);
          return {
            ...stage,
            tasks: Array.isArray(tasksData) ? tasksData : [],
          };
        }),
      );

      setProject({
        ...projectData,
        stages: stagesWithTasks,
      });
    } catch (e) {
      setProject(null);
      setError(getApiErrorMessage(e, 'Не удалось загрузить проект'));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { project, isLoading, error, refresh, setProject };
}

export default useProject;
