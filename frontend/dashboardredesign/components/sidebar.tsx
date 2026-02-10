import { Plus, Lightbulb } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-gray-200 dark:border-white/5 bg-white dark:bg-[#110027] p-6 transition-colors duration-300">
      {/* Context Section */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
            КОНТЕКСТ
          </h3>
          <span className="text-xs text-gray-500">0</span>
        </div>

        {/* Empty State */}
        <div className="mt-6 rounded-lg bg-gray-50 dark:bg-white/5 p-6 text-center transition-colors">
          <div className="mb-3 flex justify-center">
            <div className="rounded bg-gray-200 dark:bg-white/10 p-2 transition-colors">
              <svg
                className="h-5 w-5 text-gray-400 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Добавьте проекты или файлы, чтобы AI лучше понимал задачу
          </p>
        </div>

        {/* Add Context Button */}
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-transparent py-2 text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          <Plus size={16} />
          Добавить контекст
        </button>
      </div>

      {/* Tip Section */}
      <div className="mt-8 border-t border-gray-200 dark:border-white/5 pt-6 transition-colors">
        <div className="flex gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <Lightbulb size={18} className="text-blue-500" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white">Подсказка</h4>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Вы можете выбрать конкретный проект в качестве контекста, чтобы ответы были точнее.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
