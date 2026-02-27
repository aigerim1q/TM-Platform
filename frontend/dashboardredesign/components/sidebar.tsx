"use client";

import { AlertCircle, CheckCircle2, FileText, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { api, getApiErrorMessage, getCurrentUserId } from '@/lib/api';
import { AI_CONTEXT_UPDATED_EVENT, clearAIProjectContext, type AIProjectContext, loadAIProjectContext, saveAIProjectContext } from '@/lib/ai-context';

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

type ContextFileRecord = {
  id: string;
  fileName: string;
  uploadedAt: string;
  status: 'parsed' | 'error';
  fileFingerprint?: string;
  title?: string;
  description?: string;
  errorMessage?: string;
  context?: AIProjectContext;
};

const CONTEXT_FILES_STORAGE_KEY = 'ai_context_files';
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 180;
const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt'] as const;
const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

function getFileExtension(fileName: string) {
  const normalized = String(fileName || '').trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === normalized.length - 1) {
    return '';
  }
  return normalized.slice(dotIndex + 1);
}

function normalizeFileName(fileName: string) {
  return String(fileName || '').trim().toLowerCase();
}

function buildFallbackFingerprint(file: File) {
  return `fallback:${normalizeFileName(file.name)}:${file.size}:${file.lastModified}`;
}

async function computeFileFingerprint(file: File): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return buildFallbackFingerprint(file);
  }

  try {
    const bytes = await file.arrayBuffer();
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(digest));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  } catch {
    return buildFallbackFingerprint(file);
  }
}

function buildContextFilesStorageKey(userId: string) {
  return `${CONTEXT_FILES_STORAGE_KEY}:${userId || 'anonymous'}`;
}

function loadContextFiles(userId: string): ContextFileRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(buildContextFilesStorageKey(userId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ContextFileRecord[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        ...item,
        fileFingerprint: item.fileFingerprint ? String(item.fileFingerprint) : undefined,
      }));
  } catch {
    return [];
  }
}

function saveContextFiles(userId: string, files: ContextFileRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(buildContextFilesStorageKey(userId), JSON.stringify(files));
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 MB';
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateContextFile(file: File): string | null {
  const extension = getFileExtension(file.name);
  const acceptedFormatsText = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(', ');

  if (!file.name?.trim()) {
    return `Некорректное имя файла.\nПроверьте файл и попробуйте снова.\nДопустимые форматы: ${acceptedFormatsText}.\nМаксимальный размер: 50 MB.`;
  }

  if (file.name.length > MAX_FILE_NAME_LENGTH) {
    return `Слишком длинное имя файла (более ${MAX_FILE_NAME_LENGTH} символов).\nСократите имя и повторите загрузку.`;
  }

  if (!ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
    return `Неверный формат файла: ${extension ? `.${extension}` : 'без расширения'}.\nДопустимые форматы: ${acceptedFormatsText}.\nМаксимальный размер: 50 MB.`;
  }

  if (file.size <= 0) {
    return 'Файл пустой (0 байт). Загрузите файл с содержимым.';
  }

  if (file.size > MAX_FILE_SIZE) {
    return `Файл слишком большой: ${formatSize(file.size)}.\nМаксимальный размер: 50 MB.\nДопустимые форматы: ${acceptedFormatsText}.`;
  }

  if (file.type && !ACCEPTED_MIME_TYPES.has(file.type)) {
    return `Файл имеет неподдерживаемый MIME-тип: ${file.type}.\nДопустимые форматы: ${acceptedFormatsText}.\nМаксимальный размер: 50 MB.`;
  }

  return null;
}

function startsWithSignature(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

async function validateContextFileSignature(file: File): Promise<string | null> {
  const extension = getFileExtension(file.name);

  const headerChunk = file.slice(0, 16);
  const headerBuffer = await headerChunk.arrayBuffer();
  const header = new Uint8Array(headerBuffer);

  if (extension === 'pdf') {
    const pdfSignature = [0x25, 0x50, 0x44, 0x46]; // %PDF
    if (!startsWithSignature(header, pdfSignature)) {
      return 'Файл имеет расширение .pdf, но не похож на корректный PDF-документ. Проверьте файл и попробуйте снова.';
    }
    return null;
  }

  if (extension === 'docx') {
    const zipLocal = [0x50, 0x4b, 0x03, 0x04];
    const zipEmpty = [0x50, 0x4b, 0x05, 0x06];
    const zipSpanned = [0x50, 0x4b, 0x07, 0x08];
    const isZip = startsWithSignature(header, zipLocal)
      || startsWithSignature(header, zipEmpty)
      || startsWithSignature(header, zipSpanned);
    if (!isZip) {
      return 'Файл имеет расширение .docx, но его сигнатура не соответствует DOCX (ZIP). Возможно, файл переименован или поврежден.';
    }
    return null;
  }

  if (extension === 'txt') {
    const probeChunk = file.slice(0, 2048);
    const probeBuffer = await probeChunk.arrayBuffer();
    const probe = new Uint8Array(probeBuffer);
    const hasNullBytes = probe.some((byte) => byte === 0x00);
    if (hasNullBytes) {
      return 'Файл с расширением .txt содержит бинарные данные. Загрузите обычный текстовый файл.';
    }
  }

  return null;
}

export default function Sidebar() {
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [files, setFiles] = useState<ContextFileRecord[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [notificationModal, setNotificationModal] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const userId = resolvedUserId || 'anonymous';
  const isUserResolved = resolvedUserId !== null;

  useEffect(() => {
    setResolvedUserId(getCurrentUserId() || 'anonymous');
  }, []);

  useEffect(() => {
    if (!isUserResolved) {
      return;
    }

    const syncContext = () => {
      const existing = loadAIProjectContext();
      setSelectedFileName(existing?.sourceFileName || null);
      setFiles(loadContextFiles(userId));
    };

    syncContext();
    window.addEventListener(AI_CONTEXT_UPDATED_EVENT, syncContext as EventListener);
    return () => {
      window.removeEventListener(AI_CONTEXT_UPDATED_EVENT, syncContext as EventListener);
    };
  }, [isUserResolved, userId]);

  const handleSelectContextFile = () => {
    if (!isUserResolved || isImporting) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateContextFile(file);
    if (validationError) {
      const message = validationError;
      setImportError(message);
      setNotificationModal({
        type: 'error',
        title: 'Ошибка загрузки',
        message,
      });
      if (event.target) event.target.value = '';
      return;
    }

    const signatureError = await validateContextFileSignature(file);
    if (signatureError) {
      setImportError(signatureError);
      setNotificationModal({
        type: 'error',
        title: 'Некорректный документ',
        message: `${signatureError}\n\nТребования:\n• Форматы: .pdf, .docx, .txt\n• Размер: до 50 MB`,
      });
      if (event.target) event.target.value = '';
      return;
    }

    const fileFingerprint = await computeFileFingerprint(file);
    const normalizedName = normalizeFileName(file.name);
    const knownFiles = loadContextFiles(userId);
    const duplicate = knownFiles.find((item) => {
      if (item.status !== 'parsed') {
        return false;
      }

      if (item.fileFingerprint && item.fileFingerprint === fileFingerprint) {
        return true;
      }

      // Backward compatibility for old records without fingerprints.
      return !item.fileFingerprint && normalizeFileName(item.fileName) === normalizedName;
    });

    if (duplicate) {
      const message = `Такой файл уже распарсен: ${duplicate.fileName}.\nУдалите текущий файл из списка и только потом парсите заново.`;
      setImportError(message);
      setNotificationModal({
        type: 'error',
        title: 'Дубликат файла',
        message,
      });
      if (event.target) event.target.value = '';
      return;
    }

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
        const nextContext: AIProjectContext = {
          projectTitle: data.summary?.title?.trim() || data.parsedProject?.title?.trim() || 'Новый проект',
          deadline: data.summary?.deadline || data.parsedProject?.deadline,
          stagesCreated: data.summary?.stagesCount ?? data.parsedProject?.phases?.length ?? 0,
          tasksCreated: data.summary?.tasksCount ?? 0,
          sourceFileName: data.sourceFileName || file.name,
          importedAt: new Date().toISOString(),
          parsedProject: data.parsedProject,
          nextTaskCursor: 0,
        };

        saveAIProjectContext(nextContext);

        const record: ContextFileRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: data.sourceFileName || file.name,
          uploadedAt: new Date().toISOString(),
          status: 'parsed',
          fileFingerprint,
          title: nextContext.projectTitle,
          description: String(data.parsedProject?.description || '').trim() || 'Краткое описание не найдено в документе.',
          context: nextContext,
        };

        const nextFiles = [record, ...loadContextFiles(userId)];
        saveContextFiles(userId, nextFiles);
        setFiles(nextFiles);
        const successMessage = 'Документ успешно распарсен. Контекст готов к использованию в чате.';
        setImportSuccess(successMessage);
        setNotificationModal({
          type: 'success',
          title: 'Документ обработан',
          message: successMessage,
        });
        return;
      }

      const failedRecord: ContextFileRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        status: 'error',
        fileFingerprint,
        errorMessage: 'Парсер не вернул валидный контекст',
      };
      const nextFiles = [failedRecord, ...loadContextFiles(userId)];
      saveContextFiles(userId, nextFiles);
      setFiles(nextFiles);
      const message = 'Парсер не вернул валидный контекст';
      setImportError(message);
      setNotificationModal({
        type: 'error',
        title: 'Ошибка парсинга',
        message,
      });
    } catch (error) {
      const parsedError = getApiErrorMessage(error, 'Не удалось импортировать ЖЦП документ');
      const failedRecord: ContextFileRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        status: 'error',
        fileFingerprint,
        errorMessage: parsedError,
      };
      const nextFiles = [failedRecord, ...loadContextFiles(userId)];
      saveContextFiles(userId, nextFiles);
      setFiles(nextFiles);
      setImportError(parsedError);
      setNotificationModal({
        type: 'error',
        title: 'Ошибка парсинга',
        message: parsedError,
      });
    } finally {
      setIsImporting(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleSelectFile = async (record: ContextFileRecord) => {
    if (record.status !== 'parsed' || !record.context) {
      const message = record.errorMessage || 'Этот файл не был распарсен';
      setImportError(message);
      setNotificationModal({
        type: 'error',
        title: 'Контекст недоступен',
        message,
      });
      return;
    }

    setImportError(null);
    setImportSuccess(null);

    setSelectedFileName(record.fileName);
    saveAIProjectContext(record.context);
  };

  const handleDeleteFile = (record: ContextFileRecord) => {
    const nextFiles = files.filter((item) => item.id !== record.id);
    saveContextFiles(userId, nextFiles);
    setFiles(nextFiles);

    const isDeletingActive = selectedFileName === record.fileName;
    if (isDeletingActive) {
      setSelectedFileName(null);
      clearAIProjectContext();
    }

    setImportSuccess('Файл удален из загруженных контекстов.');
    setImportError(null);
  };

  return (
    <>
    <aside className="w-72 h-full border-r border-gray-200 dark:border-white/5 bg-white dark:bg-[#110027] p-6 transition-colors duration-300">
      <div className="h-full overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
            КОНТЕКСТ
          </h3>
          <span className="text-xs text-gray-500">{isUserResolved ? files.length : '…'}</span>
        </div>

        <div className="mt-4 rounded-lg bg-gray-50 dark:bg-white/5 p-4 text-center transition-colors">
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
            {!isUserResolved
              ? 'Загрузка контекста...'
              : selectedFileName
              ? `Активный файл: ${selectedFileName}`
              : 'Выберите или загрузите документ для контекста'}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={handleSelectContextFile}
          disabled={isImporting || !isUserResolved}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-transparent py-2 text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          {isImporting ? 'Импорт...' : 'Добавить контекст'}
        </button>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Загруженные контексты
        </p>

        <div className="mt-2 space-y-2">
          {!isUserResolved && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Загрузка...</p>
          )}

          {isUserResolved && files.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Загруженных файлов пока нет.</p>
          )}

          {isUserResolved && files.map((item) => {
            const isActive = selectedFileName === item.fileName;
            return (
              <div
                key={item.id}
                className={`w-full rounded-lg border px-3 py-2 transition-colors ${
                  isActive
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                    : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleSelectFile(item);
                    }}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-300" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-gray-800 dark:text-white">{item.fileName}</p>
                      {item.title && item.status === 'parsed' && (
                        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{item.title}</p>
                      )}
                      <p className={`text-[11px] ${item.status === 'parsed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {item.status === 'parsed' ? 'Распарсен' : 'Ошибка парсинга'}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteFile(item)}
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-300"
                    aria-label={`Удалить файл ${item.fileName}`}
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
    {notificationModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setNotificationModal(null)}
        />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#1A0A38]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-full p-1.5 ${notificationModal.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'}`}>
                {notificationModal.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{notificationModal.title}</h4>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{notificationModal.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotificationModal(null)}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
              aria-label="Закрыть уведомление"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
