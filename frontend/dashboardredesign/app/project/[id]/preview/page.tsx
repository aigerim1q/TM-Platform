'use client';

import { useRouter, useParams } from 'next/navigation';
import { CheckCircle2, Edit2 } from 'lucide-react';
import Header from '@/components/header';

export default function ProjectPreview() {
  const router = useRouter();
  const params = useParams();

  const projectData = {
    shyraq: {
      name: 'Shyraq',
      image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&h=200',
      description: 'Искусственный интеллект проанализировал ваш документ и сформировал структуру жилищного цикла проекта. Проверьте данные ниже.',
      document: {
        name: 'Техническое_задание_Shyraq.pdf',
        size: '2.4 MB',
      },
      deadline: '15 сентября 2025',
      model: 'Смета (Fixed Price)',
      stages: [
        { number: 1, title: 'Подготовительный этап и мобилизация ресурсов', duration: '14 дней' },
        { number: 2, title: 'Разработка и утверждение проектно-сметной документации', duration: '45 дней' },
        { number: 3, title: 'Закупка материалов и оборудования', duration: '30 дней' },
        { number: 4, title: 'Строительно-монтажные работы (СМР)', duration: '180 дней' },
        { number: 5, title: 'Пусконаладочные работы и тестирование систем', duration: '21 день' },
        { number: 6, title: 'Ввод в эксплуатацию и передача заказчику', duration: '10 дней' },
      ],
      team: [
        { name: 'Омар Ахмет', role: 'РУКОВОДИТЕЛЬ ПРОЕКТА', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop' },
        { name: 'Расул Даулетов', role: 'ТЕХНИЧЕСКИЙ ДИРЕКТОР', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop' },
        { name: 'Айдын Рахимбаев', role: 'ГЛАВНЫЙ ИНЖЕНЕР', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop' },
      ],
    },
    ansau: {
      name: 'Ansau',
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&h=200',
      description: 'Проект успешно загружен и обработан AI системой.',
      document: { name: 'Документация_Ansau.pdf', size: '1.8 MB' },
      deadline: '20 октября 2025',
      model: 'Смета (Fixed Price)',
      stages: [
        { number: 1, title: 'Подготовка площадки', duration: '10 дней' },
        { number: 2, title: 'Проектирование', duration: '30 дней' },
        { number: 3, title: 'Согласование', duration: '15 дней' },
        { number: 4, title: 'Строительство', duration: '120 дней' },
        { number: 5, title: 'Отделочные работы', duration: '45 дней' },
        { number: 6, title: 'Сдача объекта', duration: '5 дней' },
      ],
      team: [
        { name: 'Айтурган Сатпаева', role: 'РУКОВОДИТЕЛЬ ПРОЕКТА', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop' },
        { name: 'Мария Иванова', role: 'АРХИТЕКТОР', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop' },
        { name: 'Максим Петров', role: 'ИНЖЕНЕР', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop' },
      ],
    },
    dariya: {
      name: 'Dariya',
      image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&h=200',
      description: 'Проект успешно загружен и проанализирован AI системой.',
      document: { name: 'Спецификация_Dariya.pdf', size: '3.2 MB' },
      deadline: '25 ноября 2025',
      model: 'Смета (Fixed Price)',
      stages: [
        { number: 1, title: 'Инициирование', duration: '7 дней' },
        { number: 2, title: 'Планирование', duration: '20 дней' },
        { number: 3, title: 'Проектирование', duration: '40 дней' },
        { number: 4, title: 'Строительство', duration: '100 дней' },
        { number: 5, title: 'Тестирование', duration: '15 дней' },
        { number: 6, title: 'Запуск', duration: '7 дней' },
      ],
      team: [
        { name: 'Дарья Смирнова', role: 'РУКОВОДИТЕЛЬ ПРОЕКТА', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop' },
        { name: 'Артем Морозов', role: 'АНАЛИТИК', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop' },
        { name: 'Елена Волкова', role: 'КООРДИНАТОР', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop' },
      ],
    },
  };

  const project = projectData[params.id] || projectData.shyraq;

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      {/* Header - centered */}
      <div className="flex justify-center pt-6">
        <Header />
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Back Button */}
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-yellow-100 text-gray-900 hover:bg-yellow-200 transition-colors text-sm font-semibold">
          ← Назад
        </button>

        {/* Project Header */}
        <div className="flex gap-6 mb-8">
          <img src={project.image || "/placeholder.svg"} alt={project.name} className="w-40 h-40 rounded-2xl object-cover" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">AI Обработка завершена</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Проект: {project.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{project.description}</p>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="col-span-2 space-y-6">
            {/* Document Card */}
            <div className="border-2 border-purple-300 dark:border-purple-800 rounded-3xl p-6 bg-purple-50 dark:bg-purple-900/20">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-1">AI успешно обработал ваш документ</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <span className="text-red-500">📄</span>
                    <span>{project.document.name}</span>
                    <span className="text-gray-500">{project.document.size}</span>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600 text-sm">⟲ Заменить файл</button>
              </div>
            </div>

            {/* Parameters */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 2a1 1 0 000 2h2V2H9zm0 1h2v13H9V3zm4-1a1 1 0 000 2h2V2h-2zm0 1h2v13h-2V3zm4-1a1 1 0 100 2h2V2h-2zm0 1h2v13h-2V3z" /></svg>
                  Параметры из документа
                </h3>
                <span className="text-xs font-semibold text-gray-500 uppercase">Автозаполнение</span>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">Срок завершения (дедлайн)</span>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">{project.deadline}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Примерно за 360 дней</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">Финансовая модель</span>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-2">{project.model}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Определено по 12 проектов</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">ЭТАПЫ ПРОЕКТА (ЖЦП)</p>
              <p className="text-right text-xs text-gray-500 dark:text-gray-400 mb-4">Надаю этапов: 6</p>

              {/* Stages List */}
              <div className="space-y-3">
                {project.stages.map((stage) => (
                  <div key={stage.number} className="flex items-center gap-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 group">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 min-w-6">{stage.number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{stage.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Срок: {stage.duration}</p>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Stage Button */}
              <button className="w-full mt-4 text-center text-gray-400 hover:text-gray-600 text-sm py-2 border border-dashed border-gray-300 rounded-lg transition-colors">
                + Добавить новый этап
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8">
              <button className="flex-1 bg-yellow-200 hover:bg-yellow-300 text-gray-900 font-semibold py-3 rounded-2xl transition-colors">
                Подтвердить и продолжить ✓
              </button>
              <button
                onClick={() => router.push(`/project/${params.id}/edit`)}
                className="flex-1 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white font-semibold py-3 rounded-2xl transition-colors"
              >
                Редактировать
              </button>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Team Recommendations */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                Рекомендуемые ответственные
                <span className="text-blue-500">✓</span>
              </h3>
              <div className="space-y-3">
                {project.team.map((member, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <img src={member.avatar || "/placeholder.svg"} alt={member.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{member.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-4">AI подобрал сотрудников на основе опыта в аналогичных проектах и текущей загрузки.</p>
            </div>

            {/* Control Accuracy */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                💖 Контроль точности
              </h3>
              <p className="text-sm text-gray-600 mb-3">Точность распознавания</p>
              <div className="w-full bg-gray-300 rounded-full h-2 mb-4">
                <div className="bg-yellow-400 h-2 rounded-full" style={{ width: '98%' }}></div>
              </div>
              <p className="text-xs text-gray-500 text-center">98%</p>
              <p className="text-xs text-gray-600 mt-4">Все этапы были согласованы с внутренним регламентом качества.</p>
              <button className="w-full mt-4 bg-yellow-200 hover:bg-yellow-300 text-gray-900 font-semibold py-2 rounded-full text-sm transition-colors">
                ⬇ Скачать структуру ЖЦП
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
