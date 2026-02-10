'use client';

import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Heart, MessageCircle, Share2, Flag, AlertCircle, Users, Download } from 'lucide-react';
import { useState } from 'react';
import Header from '@/components/header';

export default function ReportsPage() {
  const router = useRouter();
  const params = useParams();
  const [activeTab, setActiveTab] = useState('reports');

  const reportData = {
    title: 'Возведение колонн на 1 этаже несущих конструкции',
    author: 'Омар Ахмет',
    time: '14:20',
    date: '13 фев 2026',
    description: 'Завершили важный этап: заливка фундаментной плиты сектора Б выполнена в полном объеме. Использовано 450м³ бетона марки М400. Все температурные датчики установлены, процесс затвердевания отслеживается согласно регламенту зимнего бетонирования.',
    images: [
      'https://images.unsplash.com/photo-1486325212027-8081e485255e?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=350',
    ],
    likes: 24,
    comments: 7,
    attachments: {
      projectDate: '13 фев 2026',
      daysLeft: 14,
      progress: 75,
    },
    responsible: [
      { name: 'Омар Ахмет', role: 'Руководитель' },
      { name: 'Зейнулла Ршыман', role: 'Инженер' },
      { name: 'Айдын Рахимбаев', role: 'Главный инженер' },
    ],
    warnings: 'Превышение отсрочки: автор > 15мкс',
    recentChanges: 'Исторгу измененный',
  };

  const comments = [
    {
      author: 'Омар Ахмет',
      role: 'Руководитель',
      text: 'Отличная работа команды!',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-background pb-20">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-24">
        {/* Top Navigation - Spread Layout */}
        <div className="flex flex-col lg:flex-row items-center justify-between mb-8 gap-4 lg:gap-0">
          {/* Left Side Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <button
              onClick={() => router.push('/')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-semibold"
            >
              ← Назад
            </button>

            <div className="flex w-full sm:w-auto gap-4 overflow-x-auto pb-2 sm:pb-0 justify-center">
              <button
                onClick={() => router.push(`/project/${params.id}`)}
                className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-8 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
              >
                Проект
              </button>

              <button className="bg-black dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap">
                Отчеты
              </button>
            </div>
          </div>

          {/* Center Button */}
          <button
            onClick={() => router.push('/documents')}
            className="w-full sm:w-auto bg-amber-100 text-amber-900 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-amber-200 transition-colors"
          >
            Документы
          </button>

          {/* Right Side Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <button className="w-full sm:w-auto bg-black dark:bg-white text-white dark:text-black px-8 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-200">
              Отправить
            </button>

            <button className="w-full sm:w-auto bg-yellow-200 text-gray-900 px-8 py-2.5 rounded-full text-sm font-semibold hover:bg-yellow-300">
              Пометить как срочное!
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Report */}
          <div className="lg:col-span-2">
            {/* Report Header */}
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">{reportData.title}</h1>

              <div className="flex items-start gap-4 mb-6">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                  alt={reportData.author}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{reportData.author}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Строительный персонал</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <span>{reportData.time}</span>
                    <span>●</span>
                    <span>{reportData.date}</span>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Report Description */}
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              {reportData.description}
            </p>

            {/* Report Image */}
            {reportData.images.map((image, idx) => (
              <div key={idx} className="mb-6 rounded-2xl overflow-hidden">
                <img
                  src={image || "/placeholder.svg"}
                  alt="Report content"
                  className="w-full h-64 md:h-96 object-cover"
                />
              </div>
            ))}

            {/* Engagement Section */}
            <div className="flex items-center gap-8 py-4 border-t border-b border-gray-200 dark:border-gray-800 mb-8 overflow-x-auto">
              <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors">
                <Heart className="w-5 h-5" />
                <span className="text-sm">{reportData.likes}</span>
              </button>
              <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors">
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm">{reportData.comments}</span>
              </button>
              <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-green-500 transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
              <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-yellow-500 transition-colors">
                <Flag className="w-5 h-5" />
              </button>
            </div>

            {/* Comments Section */}
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Комментарии ({reportData.comments})</h3>

              {comments.map((comment, idx) => (
                <div key={idx} className="flex gap-4 mb-6">
                  <img
                    src={comment.avatar || "/placeholder.svg"}
                    alt={comment.author}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">{comment.author}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{comment.role}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{comment.text}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Comment Input */}
              <div className="mt-6">
                <textarea
                  placeholder="Добавить комментарий..."
                  className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl p-4 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            {/* Attachment Info Card */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Прикрепленный проект</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mb-6">{reportData.attachments.projectDate}</p>

              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Останок дней</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{reportData.attachments.daysLeft}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Прогресс</p>
                <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-yellow-400 h-2 rounded-full"
                    style={{ width: `${reportData.attachments.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{reportData.attachments.progress}%</p>
              </div>
            </div>

            {/* Responsible Section */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Ответственные
                </h3>
                <button className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="space-y-3">
                {reportData.responsible.map((person, idx) => {
                  const avatars = [
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop',
                    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=256&h=256&fit=crop',
                    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop'
                  ];
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <img
                        src={avatars[idx % avatars.length]}
                        alt={person.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{person.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{person.role}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="w-full mt-4 py-2 px-4 border-2 border-gray-300 dark:border-gray-700 rounded-full text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                +Добавить ответственных
              </button>
            </div>

            {/* Warnings Section */}
            {reportData.warnings && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 flex gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-900 mb-1">Прочие отсрочки</p>
                  <p className="text-xs text-orange-800">{reportData.warnings}</p>
                </div>
              </div>
            )}

            {/* Create Report Card */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">📝</span>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Создать отчет</h3>
              </div>

              {/* Description Section */}
              <div className="mb-8">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 tracking-wide">ОПИСАНИЕ РАБОТЫ</label>
                <textarea
                  placeholder="Что было сделано сегодня?"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-32 text-gray-900 dark:text-white"
                />
              </div>

              {/* Media Files Section */}
              <div className="mb-8">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-4 tracking-wide">МЕДИА ФАЙЛЫ</label>

                <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-12 text-center">
                  <div className="flex justify-center gap-4 mb-4">
                    <div className="text-4xl">📷</div>
                    <div className="text-4xl">📄</div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Перетащите сюда фото или чертежи</p>
                  <p className="text-xs text-gray-400">JPG, PNG, PDF до 25 МБ</p>
                </div>
              </div>

              {/* Publish Button */}
              <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors">
                Опубликовать
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
