'use client';

import { AlertCircle, FileText, Loader2, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { api, getApiErrorMessage, getCurrentUserId } from '@/lib/api';

type ParseContextResponse = {
  parsedProject?: {
    title?: string;
    description?: string;
    deadline?: string;
    phases?: Array<{ name?: string }>;
  };
  summary?: {
    title?: string;
  };
};

type LifecycleDocument = {
  id: string;
  fileName: string;
  uploadedAt: string;
  status: 'parsed' | 'error';
  title?: string;
  shortDescription?: string;
  errorMessage?: string;
};

type ApiDocumentItem = {
  id: string;
  name: string;
  project_name: string;
  created_at: string;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt'];

function getFileExtension(fileName: string) {
  const normalized = String(fileName || '').trim().toLowerCase();
  const idx = normalized.lastIndexOf('.');
  if (idx < 0 || idx === normalized.length - 1) {
    return '';
  }
  return normalized.slice(idx + 1);
}

function buildStorageKey(userId: string) {
  return `zhcp_lifecycle_docs:${userId || 'anonymous'}`;
}

function loadStoredDocs(userId: string): LifecycleDocument[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = localStorage.getItem(buildStorageKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as LifecycleDocument[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: String(item.id || ''),
        fileName: String(item.fileName || 'Документ'),
        uploadedAt: String(item.uploadedAt || new Date().toISOString()),
        status: item.status === 'parsed' ? 'parsed' : 'error',
        title: item.title ? String(item.title) : undefined,
        shortDescription: item.shortDescription ? String(item.shortDescription) : undefined,
        errorMessage: item.errorMessage ? String(item.errorMessage) : undefined,
      }))
      .filter((item) => Boolean(item.id));
  } catch {
    return [];
  }
}

function saveStoredDocs(userId: string, docs: LifecycleDocument[]) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(buildStorageKey(userId), JSON.stringify(docs));
}

function toShortDescription(parsedDescription?: string, phasesCount?: number) {
  const clean = String(parsedDescription || '').trim();
  if (clean) {
    return clean;
  }

  if (typeof phasesCount === 'number' && phasesCount > 0) {
    return `Документ распознан. Выявлено этапов: ${phasesCount}.`;
  }

  return 'Документ успешно распознан. Краткое описание отсутствует в исходном файле.';
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MainContent() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<LifecycleDocument[]>([]);
  const [apiDocuments, setApiDocuments] = useState<ApiDocumentItem[]>([]);
  const [isLoadingApiDocuments, setIsLoadingApiDocuments] = useState(true);
  const [apiDocumentsError, setApiDocumentsError] = useState<string | null>(null);
  const [activeDocID, setActiveDocID] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState<string | null>(null);

  const userId = getCurrentUserId() || 'anonymous';

  useEffect(() => {
    setDocuments(loadStoredDocs(userId));
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const loadApiDocuments = async () => {
      setIsLoadingApiDocuments(true);
      setApiDocumentsError(null);

      try {
        const { data } = await api.get<ApiDocumentItem[]>('/documents');
        if (!cancelled) {
          setApiDocuments(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (!cancelled) {
          setApiDocumentsError(getApiErrorMessage(error, 'Не удалось загрузить документы из API'));
          setApiDocuments([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingApiDocuments(false);
        }
      }
    };

    void loadApiDocuments();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeDocument = useMemo(
    () => documents.find((item) => item.id === activeDocID) || null,
    [activeDocID, documents],
  );

  const persistDocuments = (next: LifecycleDocument[]) => {
    setDocuments(next);
    saveStoredDocs(userId, next);
  };

  const handlePickFile = () => {
    if (isParsing) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) {
      return;
    }

    setParseError(null);
    setParseSuccess(null);

    const ext = getFileExtension(picked.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setParseError('Неверный формат. Допустимы только: .pdf, .docx, .txt');
      event.target.value = '';
      return;
    }

    if (picked.size > MAX_FILE_SIZE) {
      setParseError('Файл слишком большой. Максимальный размер: 50 MB');
      event.target.value = '';
      return;
    }

    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.append('file', picked);

      const { data } = await api.post<ParseContextResponse>('/zhcp/parse-context', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!data?.parsedProject) {
        throw new Error('Парсер не вернул структуру проекта');
      }

      const title = String(data.summary?.title || data.parsedProject.title || picked.name).trim() || picked.name;
      const shortDescription = toShortDescription(data.parsedProject.description, data.parsedProject.phases?.length);

      const newRecord: LifecycleDocument = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        fileName: picked.name,
        uploadedAt: new Date().toISOString(),
        status: 'parsed',
        title,
        shortDescription,
      };

      const next = [newRecord, ...documents];
      persistDocuments(next);
      setActiveDocID(newRecord.id);
      setParseSuccess('Документ успешно распарсен. Описание доступно по клику в списке.');
    } catch (error) {
      const parsedError = getApiErrorMessage(error, 'Не удалось распарсить документ');
      const failedRecord: LifecycleDocument = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        fileName: picked.name,
        uploadedAt: new Date().toISOString(),
        status: 'error',
        errorMessage: parsedError,
      };

      const next = [failedRecord, ...documents];
      persistDocuments(next);
      setActiveDocID(failedRecord.id);
      setParseError(parsedError);
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">ЖЦП документы</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Загрузите документ, система сначала выполнит парсинг, после чего будет доступен заголовок и краткое описание.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          disabled={isParsing}
          onClick={handlePickFile}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {isParsing ? 'Парсинг документа...' : 'Загрузить документ для парсинга'}
        </button>

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Допустимые форматы: .pdf, .docx, .txt. Максимум: 50 MB.
        </p>

        {parseError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {parseError}
          </div>
        )}

        {parseSuccess && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {parseSuccess}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Документы пользователя ({documents.length})
          </h2>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Хранятся локально по userId: {userId}
          </p>

          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Пока нет загруженных документов.
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => {
                const isActive = activeDocID === doc.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setActiveDocID(doc.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20'
                        : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{doc.fileName}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(doc.uploadedAt)}</p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          doc.status === 'parsed'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}
                      >
                        {doc.status === 'parsed' ? 'Распарсен' : 'Ошибка парсинга'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Документы из API ({apiDocuments.length})
            </h3>

            {isLoadingApiDocuments && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Загрузка...</p>
            )}

            {!isLoadingApiDocuments && apiDocumentsError && (
              <p className="text-xs text-red-600 dark:text-red-400">{apiDocumentsError}</p>
            )}

            {!isLoadingApiDocuments && !apiDocumentsError && apiDocuments.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Список API пока пуст.</p>
            )}

            {!isLoadingApiDocuments && !apiDocumentsError && apiDocuments.length > 0 && (
              <div className="space-y-2">
                {apiDocuments.slice(0, 5).map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-700"
                  >
                    <p className="truncate font-medium text-gray-900 dark:text-white">{doc.name}</p>
                    <p className="mt-0.5 text-gray-500 dark:text-gray-400">{doc.project_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Краткая информация по документу
          </h2>

          {!activeDocument && (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Выберите документ в списке слева.
            </div>
          )}

          {activeDocument && activeDocument.status === 'parsed' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <FileText className="h-4 w-4" />
                {activeDocument.title || activeDocument.fileName}
              </div>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {activeDocument.shortDescription || 'Описание отсутствует.'}
              </p>
            </div>
          )}

          {activeDocument && activeDocument.status === 'error' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" />
                Документ не распарсился
              </div>
              <p>{activeDocument.errorMessage || 'Не удалось обработать документ.'}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
