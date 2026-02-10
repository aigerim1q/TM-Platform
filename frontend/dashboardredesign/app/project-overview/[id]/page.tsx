'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import { Clock, Users, AlertCircle, Plus, ChevronRight } from 'lucide-react';
import Header from '@/components/header';
import ResponsiblePersonsModal from '@/components/responsible-persons-modal';

export default function ProjectOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);

  const projectImages: { [key: string]: string } = {
    'shyraq': 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1000&auto=format&fit=crop',
    'ansau': 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1000&auto=format&fit=crop',
    'dariya': 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop',
  };

  const projectId = params.id as string;
  const projectImage = projectImages[projectId] || '/images/building-1.jpg';
  const projectName = projectId.charAt(0).toUpperCase() + projectId.slice(1);

  const projectData = {
    title: `Проект: ${projectName}`,
    image: projectImage,
    deadline: '12.12.2025 23:59 (25 дней)',
    responsible: 'Омар Ахмет, Зейнулла Рышман, Серик Рах...',
    hasWarning: true,
    warningText: 'Причины отсрочки по всем дедлайнам',
  };

  const responsiblePersons = [
    {
      id: '1',
      name: 'Омар Ахмет',
      role: 'Архитектор',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    },
    {
      id: '2',
      name: 'Зейнулла Рышман',
      role: 'Архитектор',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    },
    {
      id: '3',
      name: 'Айдын Рахимбаев',
      role: 'Аудитор',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    },
  ];

  const phases = [
    {
      id: 1,
      title: 'I. Предпроектная подготовка',
      tasks: [
        {
          project: `Проект: ${projectName}`,
          title: '1. Инициирование проекта',
          description: 'Определение целей и ограничений проекта. Анализ потребностей рынка...',
          status: 'Выполнено',
          statusColor: 'green',
        },
        {
          project: `Проект: ${projectName}`,
          title: '2. Финансово-экономический...',
          description: 'Прогноз стоимости строительства. Расчет рентабельности проекта (ROI)...',
          status: 'Задержка: 5...',
          statusColor: 'red',
        },
      ],
    },
    {
      id: 2,
      title: 'II. Проектирование (архитектура, инженерия, дизайн)',
      tasks: [
        {
          project: `Проект: ${projectName}`,
          title: '1. Архитектурная концепция',
          description: 'Конструктивный проект здания. Общие планы этажей. Количество квартир и их типы...',
          status: 'Выполнено',
          statusColor: 'green',
        },
        {
          project: `Проект: ${projectName}`,
          title: '2. Инженерные разделы',
          description: 'Конструктивные (фундамент, колонны, электроснабжение...',
          status: 'Выполнено',
          statusColor: 'green',
        },
        {
          project: `Проект: ${projectName}`,
          title: '3. Дизайн интерьера и фас...',
          description: 'Внешний вид здания с соседства. Интерьеры квартир и этажей проекта...',
          status: 'Выполнено',
          statusColor: 'green',
        },
      ],
    },
    {
      id: 3,
      title: 'III. Строительный этап',
      tasks: [
        {
          project: `Проект: ${projectName}`,
          title: '1. Подготовка площадки',
          description: 'Освещение участка. Установка бытовок и складов. Организация временного...',
          status: 'Выполнено',
          statusColor: 'green',
        },
        {
          project: `Проект: ${projectName}`,
          title: '2. Фундаментные работы',
          description: 'Геодезическая разбивка. Рытьё котлована. Подготовка основания...',
          status: 'Выполнено',
          statusColor: 'green',
        },
        {
          project: `Проект: ${projectName}`,
          title: '3. Возведение колонн на 1 э...',
          description: 'Перед началом работ нужно провести подготовку...',
          status: '9 часов',
          statusColor: 'orange',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-background pb-20">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-24">
        {/* Navigation Buttons - All in one line */}
        <div className="flex flex-col md:flex-row items-center gap-3 mb-12">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-semibold shadow-sm"
          >
            ← Назад
          </button>

          <div className="flex w-full md:w-auto gap-3 overflow-x-auto pb-2 md:pb-0">
            <button className="flex-1 md:flex-none bg-black dark:bg-white text-white dark:text-black px-8 py-2 rounded-full text-sm font-semibold shadow-md whitespace-nowrap">
              Проект
            </button>
            <button
              onClick={() => router.push(`/project/${params.id}/reports`)}
              className="flex-1 md:flex-none bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-8 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
            >
              Отчеты
            </button>
          </div>
        </div>

        {/* Project Header - Matching Screenshot */}
        <div className="mb-10">
          <div className="w-[340px] h-[190px] overflow-hidden rounded-[40px] mb-8 shadow-sm ring-1 ring-black/5">
            <img
              src={projectImage}
              alt="Project"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-[36px] font-bold text-gray-900 dark:text-white tracking-tight mb-10">
            {projectData.title}
          </h1>
        </div>

        {/* Project Info Cards - Matching Screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {/* Deadline Card */}
          <div className="bg-[#E9DFBD] dark:bg-[#4a4225] rounded-[40px] p-7 flex items-center gap-4 shadow-sm">
            <div className="text-gray-900 dark:text-amber-100 shrink-0">
              <Clock className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <p className="text-[15px] font-bold text-gray-900 dark:text-amber-50 leading-tight">
                Дедлайн: {projectData.deadline}
              </p>
              <p className="text-[15px] font-bold text-gray-900 dark:text-amber-50 leading-tight">
                Дата начала: 9.06.2025 12:00
              </p>
            </div>
          </div>

          {/* Responsibility Card */}
          <div
            onClick={() => setIsResponsibleModalOpen(true)}
            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[40px] p-7 flex items-center gap-4 shadow-sm relative group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="text-gray-900 dark:text-white shrink-0">
              <Users className="w-9 h-9" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-gray-900 dark:text-white truncate">
                Ответственные: {projectData.responsible}
              </p>
            </div>
            <div className="p-1 rounded-full text-gray-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-45">
                <path d="M7 17l10-10M17 17V7H7" />
              </svg>
            </div>
          </div>

          {/* Warning Card */}
          <div className="bg-black dark:bg-red-900/40 dark:border dark:border-red-800 rounded-[40px] p-7 flex items-center gap-4 shadow-lg relative group cursor-pointer hover:bg-black/90 dark:hover:bg-red-900/60 transition-colors">
            <div className="w-5 h-5 rounded-full bg-red-600 shrink-0 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-white leading-snug">
                {projectData.warningText}
              </p>
            </div>
            <div className="p-1 rounded-full text-white/40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-45">
                <path d="M7 17l10-10M17 17V7H7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Phases */}
        {phases.map((phase) => (
          <div key={phase.id} className="mb-12">
            {/* Phase Header */}
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="bg-black dark:bg-white text-white dark:text-black rounded-full px-3 py-1 text-xs font-bold">
                {phase.id}
              </div>
              {phase.title}
            </h2>

            {/* Phase Tasks */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {phase.tasks.map((task, taskIdx) => (
                <div key={taskIdx} className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:shadow-md transition-shadow">
                  {/* Project name and status */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-600 dark:text-gray-400">{task.project}</span>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${task.statusColor === 'green'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : task.statusColor === 'red'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        }`}
                    >
                      {task.status === 'Выполнено' && 'Выполнено'}
                      {task.status.includes('Задержка') && task.status}
                      {task.status.includes('часов') && task.status}
                    </div>
                  </div>

                  {/* Task title */}
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">{task.title}</h3>

                  {/* Task description */}
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{task.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Budget Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Бюджет проекта</h3>
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">ОСВОЕНО СРЕДСТВ</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                1,500,900,000 <span className="text-lg text-gray-600 dark:text-gray-400">₸</span>
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">2,400,800,000 ₸</p>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '62.5%' }}></div>
          </div>
        </div>

        {/* Add Phase Button */}
        <div className="flex justify-center">
          <button className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-full font-semibold transition-colors flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Добавить этап проекта
          </button>
        </div>
      </main>

      {/* Responsible Persons Modal */}
      <ResponsiblePersonsModal
        isOpen={isResponsibleModalOpen}
        onClose={() => setIsResponsibleModalOpen(false)}
        persons={responsiblePersons}
      />
    </div>
  );
}
