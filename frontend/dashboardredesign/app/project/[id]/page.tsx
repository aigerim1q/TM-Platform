'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronRight, Clock, Users, AlertCircle, Send, Flag, Share2, Copy, X, Search, UserPlus, Calendar, ChevronDown, Paperclip, Star } from 'lucide-react';
import Header from '@/components/header';
import ResponsiblePersonsModal from '@/components/responsible-persons-modal';

export default function TaskDetail() {
  const router = useRouter();
  const params = useParams();
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [delegateDueDate, setDelegateDueDate] = useState('');
  const [delegatePriority, setDelegatePriority] = useState('Высокий');
  const [delegateComment, setDelegateComment] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);

  const historyItems = [
    {
      id: 1,
      type: 'expense',
      user: 'Вы',
      action: 'добавили новый расход',
      detail: 'Арматура A500C',
      time: '2 минуты назад',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    },
    {
      id: 2,
      type: 'deadline',
      user: 'Евгений С.',
      action: 'обновил дедлайн задачи',
      oldDate: '24.11.2025',
      newDate: '26.01.2026',
      time: '15 минут назад',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    },
    {
      id: 3,
      type: 'delegate',
      user: '',
      action: 'Автоматически делегирована задача',
      detail: '"Подготовка опалубки" перешла к следующему этапу согласно графику',
      time: '1 час назад',
      avatar: 'system',
    },
    {
      id: 4,
      type: 'status',
      user: 'Серик Р.',
      action: 'изменил статус',
      oldStatus: 'Ожидание',
      newStatus: 'В работе',
      time: '3 часа назад',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    },
    {
      id: 5,
      type: 'file',
      user: 'Омар А.',
      action: 'прикрепил файл',
      fileName: 'smetka_v3',
      time: 'Вчера, 18:30',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    },
    {
      id: 6,
      type: 'created',
      user: '',
      action: 'Задача создано в системе',
      time: '22.12.2025',
      avatar: 'system',
    },
  ];

  const teamMembers = [
    { id: '1', name: 'Алия К.', role: 'Инженер ПТО', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face', status: 'available', statusText: 'Свободна: 4ч сегодня', recommended: true, match: 98 },
    { id: '2', name: 'Данияр С.', role: 'Снабжение', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face', status: 'busy', statusText: 'Занят до 16:00', recommended: false, match: 0 },
    { id: '3', name: 'Ержан Б.', role: 'Прораб', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face', status: 'offline', statusText: 'Оффлайн', recommended: false, match: 0 },
  ];

  const filteredMembers = teamMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      name: 'Серик Рах',
      role: 'Прораб',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    },
  ];

  const taskData = {
    title: 'Возведение колонн на 1 этаже несущих конструкции',
    deadline: '26.11.2025 23:59 (-9 часов)',
    startDate: 'Дата начала: 15.11.2025 12:00',
    responsible: ['Омар Ахмет', 'Зейнулла Ршыман', 'Серик Рах...'],
    issue: 'Причина просрочки: Айды Рахимбаев болел 5 дней',
    preparation: [
      'Проверка геодезической разбивки осей и отметок',
      'Подготовка и выравнивание опубликованных для колонн',
      'Проверка качества арматурных каркасов (диаметр, шаг, фиксация)',
      'Затем переидем к задачам:',
    ],
    stages: [
      {
        title: 'Пересмотреть и доработать чертежи',
        description: 'Пересмотреть расположение всех существующих квартир\nПереработать конфигурацию несущих стен',
        status: 'Выполнено',
      },
      {
        title: 'С новой конфигурацией добавить...',
        description: 'Добавить больше квартир за счет оптимизации пространства и корректировки нежиных зон...',
        status: 'Выполнено',
      },
      {
        title: 'Провести проверку новой планировки',
        description: 'Проверить соответствие новой планировки требованиям пожарной безопасности',
        status: 'Ошибка',
        days: '-9 часов',
      },
    ],
    comments: [
      {
        author: 'Зейнулла Ршыман',
        time: '1 ч.з.',
        text: 'А почему она может быть крива?\nМы же проверили уровни на прошлой неделе.',
      },
      {
        author: 'Айды Р',
        role: 'изменил статус на',
        status: 'в работе',
        time: '',
      },
      {
        author: 'Там была проблема с виниграми. Используемые ножи заменены сегодня.',
        text: 'Там была проблема с виниграми. Используемые ножи заменены сегодня.',
        time: 'Прошедшая запись',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-white dark:bg-background pb-20">
      {/* Header */}
      <Header />

      <main className="max-w-7xl mx-auto px-6 pt-24">
        {/* Top Navigation */}
        <div className="flex flex-col md:flex-row items-center gap-3 mb-10">
          <button
            onClick={() => router.push('/')}
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

        {/* Title Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <Flag size={18} className="fill-current" />
            <span className="text-sm font-bold uppercase tracking-wider">Приоритетная задача</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight max-w-4xl">{taskData.title}</h1>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Deadline Card */}
          <div className="bg-[#FFF4F4] dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="bg-red-500/10 p-2.5 rounded-2xl text-red-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-red-900 uppercase tracking-wide mb-1 opacity-60">Дедлайн</p>
                <p className="text-base text-red-950 font-bold">{taskData.deadline}</p>
                <p className="text-sm text-red-800/60 mt-0.5">{taskData.startDate}</p>
              </div>
            </div>
          </div>

          {/* Responsible Card */}
          <div
            onClick={() => setIsResponsibleModalOpen(true)}
            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="bg-gray-100 dark:bg-gray-700 p-2.5 rounded-2xl text-gray-600 dark:text-gray-300">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Ответственные</p>
                <p className="text-base text-gray-900 font-bold leading-tight">{taskData.responsible.join(', ')}</p>
                <button className="text-amber-600 text-[11px] font-bold mt-2 flex items-center gap-1 hover:underline">
                  УПРАВЛЯТЬ <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div className="bg-[#111111] rounded-[32px] p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-red-500/20 transition-all" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="bg-white/10 p-2.5 rounded-2xl text-white">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wide mb-1">Проблема / Статус</p>
                <p className="text-sm text-white font-medium leading-relaxed">{taskData.issue}</p>
                <button className="text-amber-400 text-[11px] font-bold mt-2 flex items-center gap-1 hover:underline">
                  ПОДРОБНЕЕ <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2">
            {/* Preparation Section */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Подготовка</h2>
              <ul className="space-y-2">
                {taskData.preparation.map((item, idx) => (
                  <li key={idx} className={`text-sm ${idx === 1 ? 'bg-yellow-200 dark:bg-yellow-900/50 px-3 py-2 rounded' : ''} text-gray-700 dark:text-gray-300`}>
                    • {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Stages Section */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Этапы выполнения</h2>
              <div className="space-y-4">
                {taskData.stages.map((stage, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${stage.status === 'Выполнено' ? 'bg-green-100' : 'bg-orange-100'
                        }`}>
                        <div className={`w-4 h-4 rounded-full ${stage.status === 'Выполнено' ? 'bg-green-500' : 'bg-orange-500'
                          }`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{stage.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{stage.description}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${stage.status === 'Выполнено' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                          {stage.status}
                        </span>
                        {stage.days && <span className="text-xs text-red-600 font-semibold whitespace-nowrap">{stage.days}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Stage Button */}
              <button className="w-full mt-6 py-2 px-4 border-2 border-yellow-600 text-yellow-600 rounded-full font-semibold hover:bg-yellow-50 transition-colors">
                + Добавить этап проекта
              </button>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1">
            {/* Action Buttons */}
            <div className="bg-yellow-600 rounded-2xl p-4 text-white font-semibold text-center cursor-pointer hover:bg-yellow-700 transition-colors mb-4">
              ✓ Завершить задачу
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button className="py-3 px-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Отложить
              </button>
              <button
                onClick={() => setIsDelegateModalOpen(true)}
                className="py-3 px-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Делегировать
              </button>
            </div>

            {/* Comments Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800">
              <div className="flex gap-6 mb-6">
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`font-semibold text-base pb-1 transition-all ${activeTab === 'comments'
                    ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  Комментарии
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`font-semibold text-base pb-1 transition-all ${activeTab === 'history'
                    ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  История
                </button>
              </div>

              {activeTab === 'comments' ? (
                <>
                  <div className="space-y-4 mb-6">
                    {/* Date Separator */}
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px bg-gray-300"></div>
                      <span className="text-gray-400 text-sm font-medium">Сегодня</span>
                      <div className="flex-1 h-px bg-gray-300"></div>
                    </div>

                    {/* First Comment */}
                    <div>
                      <div className="flex items-start gap-3 mb-2">
                        <img
                          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
                          alt="avatar"
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-white">Зейнулла Ршыман</p>
                            <p className="text-gray-500 text-xs">14:32</p>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">А почему она может быть крива?<br />Мы же проверили уровни на<br />прошлой неделе.</p>
                        </div>
                      </div>
                    </div>

                    {/* Status Change Separator */}
                    <div className="flex items-center gap-3 py-3 mt-4">
                      <div className="flex-1 h-px bg-gray-300"></div>
                      <span className="text-gray-400 text-sm font-medium">Статус изменен</span>
                      <div className="flex-1 h-px bg-gray-300"></div>
                    </div>

                    {/* Status Update */}
                    <div className="flex items-center gap-2 mb-4">
                      <img
                        src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face"
                        alt="avatar"
                        className="w-6 h-6 rounded-full"
                      />
                      <p className="text-gray-600 text-sm">Айдын Р. изменил статус на <span className="text-yellow-600 font-semibold">В работе</span></p>
                    </div>

                    {/* Your Comment */}
                    <div className="mt-4">
                      <div className="flex items-end justify-end gap-2 mb-1">
                        <p className="text-gray-500 text-xs">14:45</p>
                        <span className="text-gray-600 dark:text-gray-400 text-xs font-semibold">Вы</span>
                        <img
                          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
                          alt="avatar"
                          className="w-8 h-8 rounded-full"
                        />
                      </div>
                      <div className="bg-yellow-500 text-white rounded-2xl p-4 max-w-xs ml-auto">
                        <p className="text-sm">Там была проблема с фиксаторами. Исправили, но нужен доп. контроль сегодня.</p>
                      </div>
                      <p className="text-gray-500 text-xs text-right mt-2">Просмотрено</p>
                    </div>
                  </div>

                  {/* Comment Input */}
                  <div className="mt-8">
                    <div className="flex gap-3 items-end mb-3">
                      <input
                        type="text"
                        placeholder="Напишать комментарий..."
                        className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-400 text-gray-900 dark:text-white"
                      />
                      <button className="bg-yellow-500 text-white w-10 h-10 rounded-full hover:bg-yellow-600 transition-colors flex items-center justify-center">
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex gap-4 px-4">
                      <button className="text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-1">
                        📎 Файл
                      </button>
                      <button className="text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-1">
                        📷 Фото
                      </button>
                      <button className="text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center gap-1">
                        @ Упомянуть
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* History Tab Content */
                <div className="space-y-1">
                  {historyItems.map((item, idx) => (
                    <div key={item.id} className="flex items-start gap-3 py-3">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        {item.type === 'delegate' ? (
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <Star className="w-4 h-4 text-amber-600" />
                          </div>
                        ) : item.type === 'created' ? (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <span className="text-red-600 font-bold text-sm">Q</span>
                          </div>
                        ) : (
                          <img
                            src={item.avatar}
                            alt="avatar"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        )}
                        {idx < historyItems.length - 1 && (
                          <div className="w-px h-full min-h-8 bg-gray-200 mt-2" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {item.type === 'expense' && (
                          <>
                            <p className="text-sm text-gray-900 dark:text-white">
                              <span className="font-semibold">{item.user}</span> {item.action}{' '}
                              <span className="text-amber-700 dark:text-amber-500">{item.detail}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                          </>
                        )}

                        {item.type === 'deadline' && (
                          <>
                            <p className="text-sm text-gray-900">
                              <span className="font-semibold">{item.user}</span> {item.action}
                            </p>
                            <p className="text-sm mt-1">
                              <span className="text-gray-500">{item.oldDate}</span>
                              <span className="text-gray-400 mx-2">→</span>
                              <span className="text-amber-600">{item.newDate}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                          </>
                        )}

                        {item.type === 'delegate' && (
                          <>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.action}</p>
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 mt-1">
                              <p className="text-xs text-gray-600 dark:text-gray-400 italic">{item.detail}</p>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                          </>
                        )}

                        {item.type === 'status' && (
                          <>
                            <p className="text-sm text-gray-900">
                              <span className="font-semibold">{item.user}</span> {item.action}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-2 py-1 rounded">{item.oldStatus}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-xs text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded">{item.newStatus}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                          </>
                        )}

                        {item.type === 'file' && (
                          <>
                            <p className="text-sm text-gray-900 dark:text-white">
                              <span className="font-semibold">{item.user}</span> {item.action}{' '}
                              <span className="text-blue-600 dark:text-blue-400">{item.fileName}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                          </>
                        )}

                        {item.type === 'created' && (
                          <>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.action}</p>
                            <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Show all history button */}
                  <button className="w-full mt-4 py-3 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4" />
                    Показать всю историю
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delegate Modal */}
        {isDelegateModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setIsDelegateModalOpen(false)}
          >
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Modal content */}
            <div
              className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Делегировать задачу</h2>
                </div>
                <button
                  onClick={() => setIsDelegateModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Modal body - Two columns */}
              <div className="flex gap-8 px-6 pb-6">
                {/* Left column - Selected task */}
                <div className="w-64 flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Выбранная задача</p>

                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Проект: Shyraq</span>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight mb-3">Нужно привести 10 плиток</p>
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Создано: Сегодня</span>
                    </div>
                  </div>

                  {/* Due date */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Срок выполнения</p>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="mm/dd/yyyy"
                        value={delegateDueDate}
                        onChange={(e) => setDelegateDueDate(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-400 text-gray-900 dark:text-white"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Приоритет</p>
                    <div className="relative">
                      <select
                        value={delegatePriority}
                        onChange={(e) => setDelegatePriority(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none cursor-pointer text-gray-900 dark:text-white"
                      >
                        <option value="Высокий">Высокий</option>
                        <option value="Средний">Средний</option>
                        <option value="Низкий">Низкий</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Комментарий к задаче</p>
                    <textarea
                      placeholder="Добавьте инструкции..."
                      value={delegateComment}
                      onChange={(e) => setDelegateComment(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-400 resize-none h-20 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Right column - Select executor */}
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900 dark:text-white mb-3">Выберите исполнителя</p>

                  {/* Search input */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Поиск сотрудника..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 placeholder-gray-400 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Team members list */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        onClick={() => setSelectedPerson(member.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${selectedPerson === member.id
                          ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
                          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                      >
                        {/* Radio button */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedPerson === member.id ? 'border-green-500' : 'border-gray-300'
                          }`}>
                          {selectedPerson === member.id && (
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          )}
                        </div>

                        {/* Avatar with status */}
                        <div className="relative">
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          {member.status === 'available' && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </div>

                        {/* Name and status */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{member.name}</p>
                            {member.recommended && (
                              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                                Рекомендовано
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{member.statusText}</p>
                        </div>

                        {/* Match percentage and role */}
                        <div className="text-right flex-shrink-0">
                          {member.match > 0 && (
                            <p className="text-sm font-semibold text-green-600">{member.match}% совпадение</p>
                          )}
                          <p className="text-xs text-gray-400">{member.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setIsDelegateModalOpen(false)}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    if (selectedPerson) {
                      setIsDelegateModalOpen(false);
                      setSelectedPerson(null);
                      setSearchQuery('');
                      setDelegateComment('');
                      setDelegateDueDate('');
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white font-semibold rounded-full hover:bg-amber-700 transition-colors"
                >
                  Делегировать
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Responsible Persons Modal */}
        <ResponsiblePersonsModal
          isOpen={isResponsibleModalOpen}
          onClose={() => setIsResponsibleModalOpen(false)}
          persons={responsiblePersons}
        />
      </main>
    </div>
  );
}
