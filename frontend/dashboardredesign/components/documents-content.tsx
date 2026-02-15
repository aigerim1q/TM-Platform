"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, FileText, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, getApiErrorMessage } from "@/lib/api";

type DocumentItem = {
  id: string;
  project_id: string;
  project_name: string;
  url: string;
  type: string;
  name: string;
  size: number;
  created_at: string;
  status: string;
};

function formatTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(size: number) {
  if (size <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function statusLabel(status: string) {
  if (status === "new") return "Новый";
  return status;
}

export default function DocumentsContent() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadDocuments = async () => {
      setError(null);
      setLoading(true);

      try {
        const { data } = await api.get<DocumentItem[]>("/documents");
        if (!cancelled) {
          setDocuments(Array.isArray(data) ? data : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getApiErrorMessage(loadError, "Не удалось загрузить документы"));
          setDocuments([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return documents;

    return documents.filter((doc) =>
      doc.name.toLowerCase().includes(normalized) ||
      doc.project_name.toLowerCase().includes(normalized)
    );
  }, [documents, query]);

  const recentDocuments = filteredDocuments.slice(0, 4);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ЖЦП Документы</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Автоматический реестр файлов из проектов
        </p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Всего документов: <span className="font-semibold">{filteredDocuments.length}</span>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по файлам и проектам"
            className="pl-9"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка документов...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && recentDocuments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Последние файлы</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recentDocuments.map((doc) => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
              >
                <div className="text-xs text-gray-500 dark:text-gray-400">{doc.project_name}</div>
                <div className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">{doc.name}</div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{formatTime(doc.created_at)}</div>
                <div className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {statusLabel(doc.status)}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Архив</h2>

          {filteredDocuments.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              Документы не найдены.
            </div>
          )}

          {filteredDocuments.map((doc) => (
            <a
              key={doc.id}
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                  <FileText className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{doc.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>Проект: {doc.project_name}</span>
                    <span>{formatSize(doc.size)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(doc.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {statusLabel(doc.status)}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
