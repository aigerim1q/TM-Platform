'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Task {
    id: string;
    title: string;
    deadline?: string; // YYYY-MM-DD
    assignees?: string[];
    project?: string;
    stage?: string;
    color?: string; // For calendar visualization
    type?: 'task' | 'milestone' | 'dot';
}

interface TaskContextType {
    tasks: Task[];
    addTask: (task: Task) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
    // Initial mock data to populate the calendar
    const [tasks, setTasks] = useState<Task[]>([
        { id: '1', title: 'ЖЦП: Старт Shyraq', deadline: '2025-10-02', color: 'bg-blue-100 text-blue-600', type: 'task' },
        { id: '2', title: 'Тендер: Фасады', deadline: '2025-10-04', color: 'bg-[#fffaeb] text-amber-600 border border-amber-100', type: 'task' },
        { id: '3', title: 'Бетон 4-й блок', deadline: '2025-10-08', color: 'bg-green-100 text-green-700', type: 'task' },
        { id: '4', title: 'Смета Ansau', deadline: '2025-10-10', color: 'bg-red-500', type: 'dot' },
        { id: '5', title: 'ЖЦП: Технадзор', deadline: '2025-10-15', color: 'bg-purple-100 text-purple-600', type: 'task' },
        { id: '6', title: 'Отчет по эффективности', deadline: '2025-10-18', color: 'bg-[#fffaeb] text-amber-600 border border-amber-100', type: 'task' },
        // Dots for default data
        { id: '7', title: 'dot1', deadline: '2025-10-24', color: 'bg-blue-500', type: 'dot' },
        { id: '8', title: 'dot2', deadline: '2025-10-24', color: 'bg-green-500', type: 'dot' },
        { id: '9', title: 'dot3', deadline: '2025-10-24', color: 'bg-amber-500', type: 'dot' },
    ]);

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
        <TaskContext.Provider value={{ tasks, addTask, updateTask, deleteTask }}>
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
