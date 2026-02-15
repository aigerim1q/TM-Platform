'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calculator, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isWeekend,
    addWeeks,
    subWeeks,
    parseISO,
    differenceInCalendarDays
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { useTaskContext } from './task-provider';

export default function CalendarContent() {
    const router = useRouter();
    const { tasks, isLoading, error } = useTaskContext();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'week'>('month');

    // Navigation Handlers
    const next = () => {
        if (view === 'month') {
            setCurrentDate(addMonths(currentDate, 1));
        } else {
            setCurrentDate(addWeeks(currentDate, 1));
        }
    };

    const prev = () => {
        if (view === 'month') {
            setCurrentDate(subMonths(currentDate, 1));
        } else {
            setCurrentDate(subWeeks(currentDate, 1));
        }
    };

    const goToMonthView = () => setView('month');
    const goToWeekView = () => setView('week');

    // Grid Generation Logic
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    // Generate days based on view
    const calendarDays = view === 'month'
        ? eachDayOfInterval({ start: startDate, end: endDate })
        : eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Formatting strings
    const headerDate = format(currentDate, 'LLLL yyyy', { locale: ru }); // "октябрь 2025"
    const headerDateCapitalized = headerDate.charAt(0).toUpperCase() + headerDate.slice(1);

    // Helper to find tasks for a day
    const getTasksForDay = (day: Date) => {
        return tasks.filter(task => {
            if (!task.deadline) return false;
            // Simple string comparison YYYY-MM-DD
            const taskDate = parseISO(task.deadline);
            return isSameDay(taskDate, day);
        });
    };

    const upcomingDeadlines = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return tasks
            .filter((item) => item.deadline)
            .map((item) => ({
                ...item,
                parsedDate: parseISO(item.deadline as string),
            }))
            .filter((item) => !Number.isNaN(item.parsedDate.getTime()) && item.parsedDate >= today)
            .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
            .slice(0, 6)
            .map((item) => {
                const dayDiff = differenceInCalendarDays(item.parsedDate, today);
                const due = dayDiff === 0
                    ? 'Сегодня'
                    : dayDiff === 1
                        ? 'Завтра'
                        : format(item.parsedDate, 'd MMMM', { locale: ru });

                return {
                    id: item.id,
                    project: item.project || 'Проект',
                    stage: item.stage || (item.source === 'project' ? 'Дедлайн проекта' : 'Дедлайн задачи'),
                    title: item.title,
                    due,
                    iconColor: item.source === 'project'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-blue-100 text-blue-600',
                    isHot: dayDiff <= 1,
                    source: item.source,
                    projectId: item.projectId,
                };
            });
    }, [tasks]);

    const categories = [
        { label: 'Этапы ЖЦП', color: 'bg-blue-500' },
        { label: 'Тендеры и закупки', color: 'bg-amber-500' },
        { label: 'Строительные работы', color: 'bg-green-500' },
        { label: 'Проверки технадзора', color: 'bg-purple-500' },
        { label: 'Личные задачи', color: 'bg-yellow-600' },
    ];

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-10">

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                    {error}
                </div>
            )}

            {/* Top Controls */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 px-4 md:px-0">
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 w-full lg:w-auto">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Календарь</h1>
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-1 rounded-full flex text-sm font-medium shadow-sm w-full md:w-auto">
                        <button
                            onClick={goToMonthView}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-full font-semibold transition-colors ${view === 'month' ? 'bg-[#f4f4f5] dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                            Месяц
                        </button>
                        <button
                            onClick={goToWeekView}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-full font-semibold transition-colors ${view === 'week' ? 'bg-[#f4f4f5] dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                        >
                            Неделя
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
                    <button onClick={prev} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-xl font-bold text-gray-900 dark:text-white min-w-[160px] text-center">{headerDateCapitalized}</span>
                    <button onClick={next} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white dark:bg-gray-800 rounded-[32px] shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden p-2 mx-4 md:mx-0 overflow-x-auto">
                <div className="min-w-[800px]"> {/* Ensure minimum width for scrolling on mobile */}
                    {isLoading && (
                        <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Загрузка дедлайнов...</div>
                    )}

                    {/* Header Row */}
                    <div className="grid grid-cols-7 mb-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                        {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((day, i) => (
                            <div key={day} className={`py-4 text-center text-xs font-bold uppercase tracking-wider ${i >= 5 ? 'text-[#ff6b6b] dark:text-[#ff8a8a]' : 'text-gray-400 dark:text-gray-500'}`}>
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className={`grid grid-cols-7 auto-rows-fr ${view === 'month' ? 'h-[700px]' : 'min-h-[300px]'}`}>
                        {calendarDays.map((day, index) => {
                            const dayTasks = getTasksForDay(day);
                            const isCurrMonth = isSameMonth(day, monthStart);
                            const isWeekendDay = isWeekend(day);
                            const isToday = isSameDay(day, new Date());

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={`border-gray-200 dark:border-gray-700 p-4 relative hover:bg-gray-50/30 dark:hover:bg-gray-700/30 transition-colors flex flex-col items-start
                        ${index >= 7 ? 'border-t' : ''}
                        ${index % 7 !== 0 ? 'border-l' : ''}
                    `}
                                >
                                    <div className="mb-4">
                                        <span className={`text-sm font-semibold block
                        ${isToday ? 'bg-[#fff5d6] dark:bg-yellow-900/40 text-gray-900 dark:text-yellow-100 w-8 h-8 flex items-center justify-center rounded-full' : ''}
                        ${isWeekendDay && !isToday ? 'text-[#ff6b6b] dark:text-[#ff8a8a]' : ''}
                        ${!isWeekendDay && !isToday ? 'text-gray-900 dark:text-gray-200' : ''}
                        ${!isCurrMonth && view === 'month' ? 'opacity-30' : ''}
                        `}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>

                                    <div className="space-y-2 w-full overflow-y-auto max-h-[100px] scrollbar-hide">
                                        {dayTasks.map((task, i) => (
                                            task.type === 'dot' ? (
                                                <div key={task.id} className="flex gap-1 items-center">
                                                    <div className={`w-2 h-2 rounded-full ${task.color}`}></div>
                                                    <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 truncate">{task.title}</span>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    key={task.id}
                                                    onClick={() => {
                                                        if (task.source === 'project' && task.projectId) {
                                                            router.push(`/project-overview/${task.projectId}`);
                                                            return;
                                                        }
                                                        if (task.id.startsWith('task-')) {
                                                            const taskId = task.id.slice(5);
                                                            router.push(`/project/task-${taskId}`);
                                                        }
                                                    }}
                                                    className={`text-[11px] text-left font-semibold px-3 py-2 rounded-xl truncate w-full ${task.color || 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'}`}
                                                >
                                                    {task.title}
                                                </button>
                                            )
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="px-4 md:px-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-10 mb-6">Ближайшие дедлайны ЖЦП</h2>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left: Upcoming Deadlines */}
                    <div className="lg:col-span-8 space-y-4">
                        <div className="space-y-4">
                            {upcomingDeadlines.map((item, i) => (
                                <div key={i} className="bg-white dark:bg-gray-800 rounded-[24px] p-6 border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm hover:shadow-md transition-all group gap-4">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl ${item.iconColor} group-hover:scale-105 transition-transform shrink-0`}>
                                            {item.source === 'project' ? <Briefcase size={24} /> : <Calculator size={24} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1.5">
                                                <span className="text-[11px] font-extrabold text-[#3b82f6] dark:text-[#60a5fa] uppercase tracking-wide">ПРОЕКТ: {item.project}</span>
                                                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2.5 py-0.5 rounded-full font-medium">{item.stage}</span>
                                            </div>
                                            <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{item.title}</h3>
                                        </div>
                                    </div>

                                    <div className="text-left sm:text-right w-full sm:w-auto pl-[76px] sm:pl-0">
                                        <div className={`font-bold text-lg ${item.isHot ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{item.due}</div>
                                        <div className="text-xs text-gray-400 font-medium mt-1">{item.source === 'project' ? 'Проект' : 'Задача'}</div>
                                    </div>
                                </div>
                            ))}

                            {upcomingDeadlines.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    Нет ближайших дедлайнов проектов и задач.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Categories and Action */}
                    <div className="lg:col-span-4">
                        <div className="bg-white dark:bg-gray-800 rounded-[32px] p-8 border border-gray-100 dark:border-gray-700 shadow-sm h-full flex flex-col justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-8">Категории задач</h2>
                                <div className="space-y-5">
                                    {categories.map((cat, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className={`w-3.5 h-3.5 rounded-full ${cat.color} ring-2 ring-white dark:ring-gray-700 shadow-sm`}></div>
                                            <div className="text-base text-gray-600 dark:text-gray-300 font-medium">{cat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    onClick={() => router.push('/tasks/new')}
                                    className="w-full bg-[#fceec9] hover:bg-[#fae6b5] dark:bg-amber-600 dark:hover:bg-amber-500 text-gray-900 dark:text-white rounded-full py-4 px-6 font-bold flex items-center justify-center gap-2 transition-colors shadow-none text-base"
                                >
                                    <Plus size={20} className="text-gray-900 dark:text-white" />
                                    Новая задача
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
