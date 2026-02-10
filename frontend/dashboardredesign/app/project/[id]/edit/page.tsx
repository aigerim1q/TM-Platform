'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Trash2, Plus, Calendar } from 'lucide-react';
import Header from '@/components/header';

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [deadline, setDeadline] = useState('09/15/2026');
  const [financialModel, setFinancialModel] = useState('fixed-price');
  const [stages, setStages] = useState([
    { id: 1, name: 'Подготовительный этап и мобилизация ресурсов', days: 14 },
    { id: 2, name: 'Разработка и утверждение проектно-сметной документации', days: 45 },
    { id: 3, name: 'Закупка материалов и оборудования', days: 30 },
    { id: 4, name: 'Строительно-монтажные работы (СМР)', days: 180 },
    { id: 5, name: 'Пусконаладочные работы и тестирование систем', days: 21 },
    { id: 6, name: 'Ввод в эксплуатацию и передача заказчику', days: 10 },
  ]);

  const projectNames = {
    shyraq: 'Shyraq',
    ansau: 'Ansau',
    dariya: 'Dariya',
  };

  const projectName = projectNames[projectId as keyof typeof projectNames] || 'Project';

  const handleDeleteStage = (id: number) => {
    setStages(stages.filter((stage) => stage.id !== id));
  };

  const handleUpdateStage = (id: number, field: string, value: string | number) => {
    setStages(
      stages.map((stage) =>
        stage.id === id ? { ...stage, [field]: value } : stage
      )
    );
  };

  const handleAddStage = () => {
    const newId = Math.max(...stages.map((s) => s.id), 0) + 1;
    setStages([...stages, { id: newId, name: 'Новый этап', days: 0 }]);
  };

  const handleSave = () => {
    console.log('Saving changes:', { deadline, financialModel, stages });
    router.back();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      {/* Header - centered */}
      <div className="flex justify-center pt-6">
        <Header />
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 rounded-full bg-gray-300 dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
        >
          ← Назад
        </button>

        {/* Project Header */}
        <div className="flex gap-6 mb-8">
          <div className="w-40 h-40 rounded-2xl overflow-hidden flex-shrink-0">
            <img
              src={`https://images.unsplash.com/photo-${projectId === 'shyraq' ? '1486325212027' : projectId === 'ansau' ? '1486406146926' : '1486312338219'}?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80`}
              alt={projectName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="text-sm text-amber-600 mb-1">⚙ Режим редактирования</div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Редактирование ЖЦП: {projectName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Настройте структуру жизненного цикла проекта вручную. Измените параметры, добавьте или удалите этапы.
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-8">
          {/* Left Column */}
          <div className="flex-1">
            {/* Basic Parameters */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 mb-6 border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 dark:text-white">≡</div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Основные параметры</h2>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Deadline Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                    Срок завершения (дедлайн)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:border-amber-500 text-gray-900 dark:text-white"
                    />
                    <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                      <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Financial Model */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                    Финансовая модель
                  </label>
                  <select
                    value={financialModel}
                    onChange={(e) => setFinancialModel(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:border-amber-500 text-gray-900 dark:text-white"
                  >
                    <option value="fixed-price">Смета (Fixed Price)</option>
                    <option value="time-material">Время и материалы</option>
                    <option value="hourly">Почасовая ставка</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Project Stages */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                ЭТАПЫ ПРОЕКТА (ЖЦП)
              </h2>

              <div className="space-y-3">
                {stages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="w-8 text-center font-semibold text-gray-900 dark:text-white">
                      {idx + 1}
                    </div>
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) =>
                        handleUpdateStage(stage.id, 'name', e.target.value)
                      }
                      className="flex-1 text-sm text-gray-900 dark:text-white border-0 bg-transparent focus:outline-none focus:ring-0"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={stage.days}
                        onChange={(e) =>
                          handleUpdateStage(
                            stage.id,
                            'days',
                            parseInt(e.target.value)
                          )
                        }
                        className="w-16 text-sm text-gray-900 dark:text-white bg-transparent border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-xs text-gray-500">дн</span>
                    </div>
                    <button
                      onClick={() => handleDeleteStage(stage.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}

                {/* Add New Stage */}
                <button
                  onClick={handleAddStage}
                  className="w-full py-3 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Добавить новый этап
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={handleSave}
                className="flex-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-6 py-3 text-sm font-semibold text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors flex items-center justify-center gap-2"
              >
                <span>✓</span> Сохранить изменения
              </button>
              <button
                onClick={() => router.back()}
                className="px-6 py-3 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>

          {/* Right Column */}
          <div className="w-80">
            {/* Recommended Team */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 mb-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
                Рекомендованные ответственные
              </h3>
              <div className="space-y-3">
                {[
                  { name: 'Омар Ахмет', role: 'Лидер проекта' },
                  { name: 'Расул Даулетов', role: 'Технический директор' },
                  { name: 'Айдын Рахимбаев', role: 'Главный инженер' },
                ].map((member, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {member.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Control Metrics */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
                Контроль точности
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Точность распланирования</p>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">98%</p>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: '98%' }}
                    ></div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Все этапы были согласованы с внутренними регламентом качества.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
