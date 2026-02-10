'use client';

import { ChevronRight, CheckCircle2, Zap, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MainContent() {
  const router = useRouter();
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const cards = [
    {
      id: 'construction',
      title: 'Полный цикл ЖК',
      description:
        'Стандартный шаблон для возведения жилых комплексов. Включает этапы от котлована до сдачи в эксплуатацию и благоустройства.',
      tag: 'Строительство',
      tagColor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300',
      items: ['24 этапа работ', 'Авто-генерация сметы', 'Контроль подрядчиков'],
      used: 'Использовано 120 раз.',
      icon: '🔨',
    },
    {
      id: 'renovation',
      title: 'Капитальный ремонт',
      description:
        'Оптимизирован для ремонтных работ в существующих зданиях. Фокус на демонтаже, отделке и инженерных сетях.',
      tag: 'Реновация',
      tagColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
      items: ['15 этапов работ', 'Учет материалов'],
      used: 'Использовано 85 раз.',
      icon: '🔧',
    },
    {
      id: 'architecture',
      title: 'Архитектурный проект',
      description:
        'Фокус на создании чертежей, получении разрешений и согласовании документации. Идеально для пред-строительного этапа.',
      tag: 'Проектирование',
      tagColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300',
      items: ['Согласование с гос. органами', 'BIM интеграция'],
      used: 'Использовано 40 раз.',
      icon: '📋',
    },
  ];

  return (
    <main className="w-full flex flex-col items-center px-4 py-12">
      {/* AI Assistant Badge */}
      <div className="mb-8 flex items-center gap-2 rounded-full bg-purple-100 dark:bg-purple-900/20 px-4 py-2">
        <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">AI ASSISTANT</span>
      </div>

      {/* Main Heading */}
      <h1 className="mb-3 text-center text-4xl font-bold text-gray-900 dark:text-white">
        Выберите жизненный цикл проекта
      </h1>
      <p className="mb-8 max-w-3xl text-center text-gray-600 dark:text-gray-300">
        Наш ИИ поможет вам настроить структуру задачи. Выберите шаблон, который лучше всего соответствует вашим текущим задачам.
      </p>

      {/* Recommended Badge */}
      <div className="mb-8 flex items-center gap-2 rounded-full bg-gray-900 dark:bg-white px-4 py-2">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-sm font-medium text-white dark:text-black">Рекомендуемые шаблоны</span>
      </div>

      {/* Cards Grid */}
      <div className="mb-12 grid w-full max-w-7xl grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setSelectedCard(card.id)}
            className={`relative flex min-h-[320px] flex-col overflow-hidden rounded-xl border-2 p-8 text-left transition-all duration-300 
              ${selectedCard === card.id
                ? 'bg-white dark:bg-gray-800 border-purple-500 dark:border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.15)] dark:shadow-[0_0_20px_rgba(168,85,247,0.3)] -translate-y-1'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] dark:hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:-translate-y-1'
              }
            `}
          >
            {/* Checkmark */}
            {selectedCard === card.id && (
              <div className="absolute left-4 top-4">
                <CheckCircle2 className="h-7 w-7 text-purple-600" />
              </div>
            )}

            {/* Tag */}
            <div className={`mb-5 w-fit rounded-full px-4 py-1.5 text-sm font-semibold ${card.tagColor}`}>
              {card.tag}
            </div>

            {/* Title */}
            <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">{card.title}</h3>

            {/* Description */}
            <p className="mb-5 flex-1 text-base leading-relaxed text-gray-600 dark:text-gray-300">
              {card.description}
            </p>

            {/* Items */}
            <div className="mb-5 space-y-3">
              {card.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-base text-gray-600 dark:text-gray-300">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  {item}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-5">
              <span className="text-sm text-gray-500 dark:text-gray-400">{card.used}</span>
              <ChevronRight className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
          </button>
        ))}
      </div>

      {/* Bottom */}
      <div className="w-full max-w-7xl px-4">
        {/* Action Buttons Row */}
        <div className="mb-12 flex flex-col md:flex-row items-center justify-center gap-6">
          {/* Continue Button */}
          <button
            type="button"
            onClick={() => selectedCard && router.push('/chat?mode=template')}
            disabled={!selectedCard}
            className="w-full md:w-auto rounded-full bg-amber-100 px-10 py-4 text-base font-semibold text-amber-900 transition-opacity hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 order-1 md:order-none"
          >
            Продолжить →
          </button>

          {/* Selected Info */}
          <div className="w-full md:w-auto flex items-center justify-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-8 py-4 order-2 md:order-none">
            <span className="text-base text-gray-600 dark:text-gray-300">Выбран:</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              {selectedCard
                ? cards.find((c) => c.id === selectedCard)?.title
                : '?'}
            </span>
          </div>
        </div>

        {/* Specific Tasks */}
        <div className="mb-8">
          <div className="mb-6 w-fit rounded-full bg-green-100 dark:bg-green-900/20 px-5 py-2.5 flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-base font-semibold text-green-600 dark:text-green-400">
              Специфические задачи
            </span>
          </div>

          <div className="space-y-4">
            {[
              {
                icon: Pencil,
                title: 'Ландшафтный дизайн',
                desc: 'Планировка территории, озеленение, дорожки',
                dots: 3,
              },
              {
                icon: Zap,
                title: 'Электросети',
                desc: 'Монтаж проводки, щитков, подключение к сети',
                dots: 3,
              },
              {
                icon: Pencil,
                title: 'Свой шаблон с нуля',
                desc: 'Опишите задачу, AI составит план',
                hasAI: true,
              },
            ].map((task, idx) => {
              const Icon = task.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 transition-all duration-300 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-[0_0_15px_rgba(168,85,247,0.1)] dark:hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="flex items-center gap-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                      <Icon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{task.title}</h4>
                      <p className="text-base text-gray-600 dark:text-gray-400">{task.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    {task.hasAI ? (
                      <button
                        type="button"
                        onClick={() => router.push('/chat?mode=ordinary')}
                        className="rounded-full bg-purple-600 px-5 py-2 text-base font-semibold text-white hover:bg-purple-700"
                      >
                        AI Генератор
                      </button>
                    ) : (
                      <div className="flex gap-1.5">
                        {[...Array(task.dots)].map((_, i) => (
                          <div key={i} className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                        ))}
                      </div>
                    )}
                    <ChevronRight className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
