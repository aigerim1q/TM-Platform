'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import { PROJECTS_UPDATED_EVENT } from '@/lib/projects-events';

export interface Task {
    id: string;
    title: string;
    deadline?: string; // YYYY-MM-DD
    status?: string;
    assignees?: string[];
    project?: string;
    projectId?: string;
    stage?: string;
    source?: 'project' | 'task';
    color?: string; // For calendar visualization
    type?: 'task' | 'milestone' | 'dot';
}

type ProjectEntity = {
    id: string;
    title?: string;
    deadline?: string | null;
};

type StageEntity = {
    id: string;
    title?: string;
};

type StageTaskEntity = {
    id: string;
    title?: string;
    deadline?: string | null;
    status?: string | null;
};

interface TaskContextType {
    tasks: Task[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    addTask: (task: Task) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const normalizeDateOnly = (input?: string | null) => {
        if (!input) return '';
        const parsed = new Date(input);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toISOString().slice(0, 10);
    };

    const getTaskColorByStatus = (status?: string | null) => {
        const normalized = String(status || '').trim().toLowerCase();

        if (normalized === 'done' || normalized === 'completed') {
            return 'bg-emerald-100 text-emerald-700';
        }

        if (normalized === 'delayed') {
            return 'bg-rose-100 text-rose-700';
        }

        if (normalized === 'in_progress') {
            return 'bg-blue-100 text-blue-700';
        }

        return 'bg-amber-100 text-amber-700';
    };

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data: projectsData } = await api.get<ProjectEntity[]>('/projects');
            const projects = Array.isArray(projectsData) ? projectsData : [];

            const projectDeadlineItems: Task[] = projects
                .map((project) => {
                    const deadline = normalizeDateOnly(project.deadline);
                    if (!deadline) return null;

                    return {
                        id: `project-${project.id}`,
                        title: `Проект: ${project.title || 'Без названия'}`,
                        deadline,
                        project: project.title || 'Без названия',
                        projectId: project.id,
                        source: 'project' as const,
                        color: 'bg-amber-100 text-amber-700 border border-amber-200',
                        type: 'milestone' as const,
                    };
                })
                .filter((item): item is Task => Boolean(item));

            const stagesByProject = await Promise.all(
                projects.map(async (project) => {
                    const { data: stagesData } = await api.get<StageEntity[]>(`/projects/${project.id}/stages`);
                    return {
                        project,
                        stages: Array.isArray(stagesData) ? stagesData : [],
                    };
                }),
            );

            const taskDeadlineItemsNested = await Promise.all(
                stagesByProject.map(async ({ project, stages }) => {
                    const tasksByStage = await Promise.all(
                        stages.map(async (stage) => {
                            const { data: stageTasksData } = await api.get<StageTaskEntity[]>(`/stages/${stage.id}/tasks`);
                            const stageTasks = Array.isArray(stageTasksData) ? stageTasksData : [];
                            return stageTasks
                                .map((stageTask) => {
                                    const deadline = normalizeDateOnly(stageTask.deadline);
                                    if (!deadline) return null;

                                    return {
                                        id: `task-${stageTask.id}`,
                                        title: stageTask.title || 'Без названия задачи',
                                        deadline,
                                        status: stageTask.status || undefined,
                                        project: project.title || 'Без названия',
                                        projectId: project.id,
                                        stage: stage.title || 'Этап',
                                        source: 'task' as const,
                                        color: getTaskColorByStatus(stageTask.status),
                                        type: 'task' as const,
                                    };
                                })
                                .filter((item): item is Task => Boolean(item));
                        }),
                    );

                    return tasksByStage.flat();
                }),
            );

            const taskDeadlineItems = taskDeadlineItemsNested.flat();

            const combined = [...projectDeadlineItems, ...taskDeadlineItems].sort((a, b) => {
                const aDate = new Date(a.deadline || '').getTime();
                const bDate = new Date(b.deadline || '').getTime();
                return aDate - bDate;
            });

            setTasks(combined);
        } catch (e) {
            setError(getApiErrorMessage(e, 'Не удалось загрузить дедлайны проектов и задач'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();

        const onProjectsUpdated = () => {
            void refresh();
        };
        window.addEventListener(PROJECTS_UPDATED_EVENT, onProjectsUpdated as EventListener);

        const intervalId = window.setInterval(() => {
            if (!document.hidden) {
                void refresh();
            }
        }, 60000);

        return () => {
            window.removeEventListener(PROJECTS_UPDATED_EVENT, onProjectsUpdated as EventListener);
            window.clearInterval(intervalId);
        };
    }, [refresh]);

    const addTask = (task: Task) => {
        setTasks(prev => [...prev, task]);
    };

    const updateTask = (id: string, updates: Partial<Task>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const deleteTask = (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    return (
        <TaskContext.Provider value={{ tasks, isLoading, error, refresh, addTask, updateTask, deleteTask }}>
            {children}
        </TaskContext.Provider>
    );
}

export function useTaskContext() {
    const context = useContext(TaskContext);
    if (context === undefined) {
        throw new Error('useTaskContext must be used within a TaskProvider');
    }
    return context;
}
