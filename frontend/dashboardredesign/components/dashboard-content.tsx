'use client';

import React from "react"
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Plus, X, Users, UserPlus, ChevronDown, ChevronRight } from 'lucide-react';

interface TaskCardProps {
  id: string;
  project: string;
  time: string;
  timeStatus: 'danger' | 'warning' | 'success';
  title: string;
  description: string;
  responsible?: string;
  onClick?: () => void;
  onResponsibleClick?: (e: React.MouseEvent) => void;
}

function TaskCard({ project, time, timeStatus, title, description, onClick }: TaskCardProps) {
  const isDelayed = timeStatus === 'danger';

  return (
    <div
      onClick={onClick}
      className="bg-[#FBF9F7] dark:bg-card rounded-[2.5rem] p-8 border-2 border-[#E2E2E2] dark:border-white/5 flex flex-col h-full transition-all hover:shadow-lg group cursor-pointer"
    >
      <div className="flex items-center justify-between mb-8">
        <span className="text-[15px] font-medium text-gray-500">
          Проект: {project}
        </span>
        <div className="bg-black rounded-full px-4 py-1.5 flex items-center gap-2 border border-white/10 shadow-xl">
          <Clock size={16} className="text-white opacity-60" />
          <span className="text-[13px] font-bold text-white tracking-wide">
            {time}
          </span>
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDelayed ? 'bg-red-400 opacity-75' : 'bg-green-400 opacity-75'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isDelayed ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]'}`}></span>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1">
        <h3 className="text-[20px] font-bold text-gray-900 dark:text-gray-100 mb-3 leading-tight tracking-tight line-clamp-1 group-hover:text-[#D1B891] transition-colors">
          {title}
        </h3>
        <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
          {description}
        </p>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  id: string;
  name: string;
  days: string;
  image: string;
  onClick?: () => void;
}

function ProjectCard({ id, name, days, image, onClick }: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className="relative rounded-[2.5rem] overflow-hidden aspect-[16/10] cursor-pointer hover:shadow-2xl transition-all duration-300 group"
    >
      <img
        src={image || "/placeholder.svg"}
        alt={name}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      />

      {/* Top Glassmorphism Bar */}
      <div className="absolute top-0 left-0 right-0 p-4">
        <div className="flex items-center justify-between px-6 py-3 rounded-full bg-black/30 backdrop-blur-md border border-white/10 shadow-lg">
          <span className="text-white font-bold text-lg tracking-tight">Проект: {name}</span>

          <div className="flex items-center gap-2 bg-black/60 rounded-full px-4 py-1.5 border border-white/5">
            <Clock size={16} className="text-white/80" />
            <span className="text-sm font-medium text-white">{days}</span>
            <div className="relative flex items-center justify-center ml-1">
              <span className={`h-3 w-3 rounded-full ${name === 'Shyraq' ? 'bg-yellow-400' : 'bg-green-500'} relative z-10`} />
              <span className={`absolute inset-0 h-3 w-3 rounded-full ${name === 'Shyraq' ? 'bg-yellow-400 animate-pulse blur-[4px]' : 'bg-green-500 animate-pulse blur-[4px]'}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  color: 'green' | 'red' | 'yellow';
  title: string;
  count: number;
}

function SectionHeader({ color, title, count }: SectionHeaderProps) {
  const dotColors = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-amber-400',
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 dark:bg-card/50 px-4 py-2 dark:border dark:border-white/10">
      <span className={`h-3 w-3 rounded-full ${dotColors[color]}`} />
      <span className="font-medium text-gray-800 dark:text-white text-sm">{title}: {count}</span>
    </div>
  );
}

function AddButton({ text, onClick }: { text: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white dark:bg-card/50 dark:px-4 dark:py-2 dark:rounded-full dark:border dark:border-white/10 font-medium text-sm transition-all"
    >
      <Plus size={16} />
      {text}
    </button>
  );
}

// AddTaskModal removed — replaced by dedicated page at /tasks/new

interface ResponsibleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ResponsibleModal({ isOpen, onClose }: ResponsibleModalProps) {
  const [selectedResponsible, setSelectedResponsible] = useState('');

  if (!isOpen) return null;

  const responsiblePeople = [
    {
      id: 1,
      name: 'Омар Ахмет',
      role: 'Архитектор',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      isYou: true,
    },
    {
      id: 2,
      name: 'Зейнулла Рышман',
      role: 'Архитектор',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      isYou: false,
    },
    {
      id: 3,
      name: 'Айдын Рахимбаев',
      role: 'Аудитор',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
      isYou: false,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-amber-50 dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users size={24} className="text-gray-700 dark:text-gray-200" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ответственные</h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
              <UserPlus size={18} />
              <span className="text-sm">Делегировать</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-amber-100 dark:hover:bg-white/10 transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* People List */}
        <div className="space-y-4 mb-6">
          {responsiblePeople.map((person) => (
            <div key={person.id} className="flex items-center gap-3">
              <img
                src={person.avatar || "/placeholder.svg"}
                alt={person.name}
                className="w-14 h-14 rounded-full object-cover"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{person.name}</span>
                  {person.isYou && (
                    <span className="text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-2 py-0.5 rounded-full">
                      это вы
                    </span>
                  )}
                </div>
                <span className="text-sm text-amber-700 dark:text-amber-400">{person.role}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Delegation */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Быстрое делегирование
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Выбрать ответственного
            </span>
          </div>
          <div className="relative">
            <select
              value={selectedResponsible}
              onChange={(e) => setSelectedResponsible(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl appearance-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-gray-700 dark:text-white transition-colors"
            >
              <option value="">Выбрать ответст...</option>
              <option value="omar">Омар Ахмет</option>
              <option value="zeinulla">Зейнулла Рышман</option>
              <option value="aidyn">Айдын Рахимбаев</option>
            </select>
            <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Add Button */}
        <button className="w-full flex items-center justify-center gap-2 bg-amber-200 hover:bg-amber-300 dark:bg-amber-600 dark:hover:bg-amber-500 text-amber-900 dark:text-white font-semibold py-3 rounded-xl transition-colors">
          <UserPlus size={20} />
          Добавить ответственных
        </button>
      </div>
    </div>
  );
}

export default function DashboardContent() {
  const router = useRouter();
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
  const [myTasks, setMyTasks] = useState([
    {
      id: 'task-1',
      project: 'Shyraq',
      time: '-9 часов',
      timeStatus: 'danger' as const,
      title: 'Возведение колонн на 1 э...',
      description: 'Интерьеры подъездов и этажей Перед началом работ нужно провести подготовку...',
      responsible: 'Омар Ахмет, Зейнулла Рышман, Серик Рах...',
    },
    {
      id: 'task-2',
      project: 'Ansau',
      time: '2 дня',
      timeStatus: 'success' as const,
      title: 'Нужно сделать новую пла...',
      description: 'На объекте Ansau срочно требуется новая планировку 5-го этажа, чтобы совпадала с новым ....',
      responsible: 'Омар Ахмет, Зейнулла Рышман, Серик Рах...',
    },
    {
      id: 'task-3',
      project: 'Dariya',
      time: '20 дней',
      timeStatus: 'success' as const,
      title: 'Нужно сделать новую пла...',
      description: 'На объекте Dariya срочно требуется новая планировку 5-го этажа, чтобы совпадала с новым ....',
      responsible: 'Омар Ахмет, Зейнулла Рышман, Серик Рах...',
    },
  ]);

  const urgentTasks = [
    {
      id: 'urgent-1',
      project: 'Shyraq',
      time: '18 часов',
      timeStatus: 'success' as const,
      title: 'Нужно привезти 10 плиток',
      description: 'На объекте Shyraq срочно требуется новая плитка, 5x3 метра, 2 штуки для наличников вокруг л....',
      responsible: 'Омар Ахмет, Зейнулла Рышман, Серик Рах...',
    },
  ];

  const projects = [
    {
      id: 'shyraq',
      name: 'Shyraq',
      days: '25 дней',
      image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1000&auto=format&fit=crop',
    },
    {
      id: 'ansau',
      name: 'Ansau',
      days: '55 дней',
      image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1000&auto=format&fit=crop',
    },
    {
      id: 'dariya',
      name: 'Dariya',
      days: '55 дней',
      image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop',
    },
  ];

  const subordinateTasks = [
    {
      id: 'sub-task-1',
      project: 'Shyraq',
      time: '-9 часов',
      timeStatus: 'danger' as const,
      title: 'Нужно сделать новую пла...',
      description: 'На объекте Shyraq срочно требуется новая планировку 5-го этажа, чтобы совпадала с новым ....',
      responsible: 'Омар Ахмет, Зейнулла Рышман, Серик Рах...',
    },
    {
      id: 'sub-task-2',
      project: 'Ansau',
      time: '2 дня',
      timeStatus: 'success' as const,
      title: 'Нужно сделать новую пла...',
      description: 'На объекте Ansau срочно требуется новая планировку 5-го этажа, чтобы совпадала с новым ....',
      responsible: 'Омар Ахмет, Зейнулла Рышман, Серик Рах...',
    },
    {
      id: 'sub-task-3',
      project: 'Dariya',
      time: '20 дней',
      timeStatus: 'success' as const,
      title: 'Нужно сделать новую пла...',
      description: 'На объекте Dariya срочно требуется новая планировку 5-го этажа, чтобы совпадала с новым ....',
      responsible: 'Омар Ахмет, Зейнулла Рышман, Серик Рах...',
    },
  ];

  // Task creation moved to dedicated page at /tasks/new

  const handleTaskClick = (taskId: string) => {
    router.push(`/project/${taskId}`);
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/project-overview/${projectId}`);
  };

  const handleResponsibleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResponsibleModalOpen(true);
  };

  return (
    <main className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8">
      {/* Task creation modal removed — use /tasks/new page */}

      {/* Responsible Modal */}
      <ResponsibleModal
        isOpen={isResponsibleModalOpen}
        onClose={() => setIsResponsibleModalOpen(false)}
      />

      {/* Urgent Tasks Section */}
      <div className="mb-8">
        <SectionHeader color="green" title="Срочные задачи" count={1} />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {urgentTasks.map((task) => (
            <TaskCard
              key={task.id}
              {...task}
              onClick={() => handleTaskClick(task.id)}
              onResponsibleClick={handleResponsibleClick}
            />
          ))}
        </div>
      </div>

      {/* My Tasks Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader color="red" title="Мои задачи" count={10} />
          <AddButton text="Добавить задачу" onClick={() => router.push('/tasks/new')} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myTasks.map((task) => (
            <TaskCard
              key={task.id}
              {...task}
              onClick={() => handleTaskClick(task.id)}
              onResponsibleClick={handleResponsibleClick}
            />
          ))}
        </div>
      </div>

      {/* Projects Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader color="yellow" title="Проекты" count={3} />
          <AddButton text="Добавить проект" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              {...project}
              onClick={() => handleProjectClick(project.id)}
            />
          ))}
        </div>
      </div>

      {/* Subordinate Tasks Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader color="red" title="Задачи подчинённых" count={subordinateTasks.length} />
          <AddButton text="Добавить проект" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subordinateTasks.map((task) => (
            <TaskCard
              key={task.id}
              {...task}
              onClick={() => handleTaskClick(task.id)}
              onResponsibleClick={handleResponsibleClick}
            />
          ))}
        </div>
      </div>

      {/* Subordinate Projects Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader color="yellow" title="Проекты подчиненных" count={3} />
          <AddButton text="Добавить проект" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              {...project}
              onClick={() => handleProjectClick(project.id)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
