"use client";

import { Plus, Lightbulb } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AI_CONTEXT_UPDATED_EVENT, loadAIProjectContext, saveAIProjectContext } from '@/lib/ai-context';

type ImportResponse = {
  parsedProject?: {
    title?: string;
    description?: string;
    deadline?: string;
    phases?: Array<{
      name?: string;
      tasks?: Array<{ name?: string }>;
    }>;
  };
  sourceFileName?: string;
  summary?: {
    title?: string;
    stagesCount?: number;
    tasksCount?: number;
    deadline?: string;
  };
};

export default function Sidebar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    const syncContext = () => {
      const existing = loadAIProjectContext();
      setSelectedFileName(existing?.sourceFileName || null);
    };

    syncContext();
    window.addEventListener(AI_CONTEXT_UPDATED_EVENT, syncContext as EventListener);
    return () => {
      window.removeEventListener(AI_CONTEXT_UPDATED_EVENT, syncContext as EventListener);
    };
  }, []);

  const handleSelectContextFile = () => {
    if (isImporting) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setImportError(null);
    setImportSuccess(null);
    setIsImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post<ImportResponse>("/zhcp/parse-context", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (data?.parsedProject) {
        saveAIProjectContext({
          projectTitle: data.summary?.title?.trim() || data.parsedProject?.title?.trim() || 'Новый проект',
          deadline: data.summary?.deadline || data.parsedProject?.deadline,
          stagesCreated: data.summary?.stagesCount ?? data.parsedProject?.phases?.length ?? 0,
          tasksCreated: data.summary?.tasksCount ?? 0,
          sourceFileName: data.sourceFileName || file.name,
          importedAt: new Date().toISOString(),
          parsedProject: data.parsedProject,
          nextTaskCursor: 0,
        });
        setImportSuccess('Документ распарсен. Теперь в чате можно командами создать проект или задачи.');
        return;
      }

      setImportError('Парсер не вернул ID проекта');
    } catch (error) {
      setImportError(getApiErrorMessage(error, 'Не удалось импортировать ЖЦП документ'));
    } finally {
      setIsImporting(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return (
    <aside className="w-64 border-r border-gray-200 dark:border-white/5 bg-white dark:bg-[#110027] p-6 transition-colors duration-300">
      {/* Context Section */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
            КОНТЕКСТ
          </h3>
          <span className="text-xs text-gray-500">{selectedFileName ? '1' : '0'}</span>
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
            {selectedFileName
              ? `Файл: ${selectedFileName}`
              : 'Добавьте проекты или файлы, чтобы AI лучше понимал задачу'}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Add Context Button */}
        <button
          type="button"
          onClick={handleSelectContextFile}
          disabled={isImporting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-transparent py-2 text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          {isImporting ? 'Импорт...' : 'Добавить контекст'}
        </button>

        {importError && (
          <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{importError}</p>
        )}
        {importSuccess && (
          <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">{importSuccess}</p>
        )}
      </div>

      {/* Tip Section */}
      <div className="mt-8 border-t border-gray-200 dark:border-white/5 pt-6 transition-colors">
        <div className="flex gap-3">
          <div className="mt-0.5 shrink-0">
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
