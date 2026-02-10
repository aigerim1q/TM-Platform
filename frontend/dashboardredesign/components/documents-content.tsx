"use client";

import { Upload, SlidersHorizontal, Search, Download, Clock, AlertCircle, MoreVertical, FileText, FileSpreadsheet, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const recentDocuments = [
  {
    id: 1,
    project: "Shyraq",
    time: "10 мин",
    title: "Акт выполненных работ №42",
    description: "Документ подтверждающий завершение этапа заливки...",
    avatars: [
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=32&h=32&fit=crop",
    ],
    urgent: false,
  },
  {
    id: 2,
    project: "Ansau",
    time: "1 час",
    title: "Смета на материалы Q3",
    description: "Обновление смета с учетом коррекции цен на арматуру и...",
    avatars: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=32&h=32&fit=crop",
    ],
    urgent: false,
  },
  {
    id: 3,
    project: "Dariya",
    time: "3 часа",
    title: "Чертеж вентиляции",
    description: "Корректировка схемы вентиляционных шахт на 5-м...",
    avatars: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop",
    ],
    urgent: false,
  },
  {
    id: 4,
    project: "",
    time: "5 часов",
    title: "Замечания технодзора",
    description: "Список выявленных нарушений при монтаже оконных блоков...",
    avatars: [],
    urgent: true,
  },
];

const archivedDocuments = [
  {
    id: 1,
    icon: "pdf",
    title: "Техническое задание на разработку ЛП",
    fileType: "PDF, 4.2 MB",
    project: "Shyraq",
    uploader: "Евгений С.",
    date: "12 Окт 2025",
    status: "approved",
  },
  {
    id: 2,
    icon: "xlsx",
    title: "График поставок бетона (Декабрь)",
    fileType: "XLSX, 1.8 MB",
    project: "Ansau",
    uploader: "Диас М.",
    date: "9 Ноя 2025",
    status: "review",
  },
  {
    id: 3,
    icon: "jpg",
    title: "Фотоотчет фасада (Секция 1)",
    fileType: "JPG, 12 MB",
    project: "Dariya",
    uploader: "Айжан К.",
    date: "19 Дек 2025",
    status: "new",
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <span className="flex items-center gap-1.5 text-xs text-green-600">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Согласовано
        </span>
      );
    case "review":
      return (
        <span className="flex items-center gap-1.5 text-xs text-yellow-600">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          На проверке
        </span>
      );
    case "new":
      return (
        <span className="flex items-center gap-1.5 text-xs text-blue-600">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Новый
        </span>
      );
    default:
      return null;
  }
}

function getFileIcon(type: string) {
  const iconClass = "h-6 w-6";
  switch (type) {
    case "pdf":
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
          <FileText className={`${iconClass} text-red-500`} />
        </div>
      );
    case "xlsx":
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
          <FileSpreadsheet className={`${iconClass} text-green-500`} />
        </div>
      );
    case "jpg":
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50">
          <ImageIcon className={`${iconClass} text-orange-500`} />
        </div>
      );
    default:
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50">
          <FileText className={`${iconClass} text-gray-500`} />
        </div>
      );
  }
}

export default function DocumentsContent() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ЖЦП Документы</h1>
          <p className="mt-1 text-sm text-gray-500">
            Управление и отслеживание жизненного цикла проекта
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="gap-2 bg-gray-900 text-white hover:bg-gray-800">
            <Upload size={16} />
            Загрузить документ
          </Button>
          <Button variant="outline" className="gap-2 border-gray-300 bg-transparent">
            <SlidersHorizontal size={16} />
            Фильтр
          </Button>
        </div>
      </div>

      {/* Recent Uploads Section */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-yellow-100 px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-gray-800">Недавние загрузки: 4</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`flex h-[180px] w-full flex-col rounded-2xl border p-4 ${doc.urgent ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
                }`}
            >
              <div className="flex items-center justify-between">
                {doc.urgent ? (
                  <span className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle size={12} />
                    Срочно
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">Проект: {doc.project}</span>
                )}
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${doc.urgent ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                  }`}>
                  <Clock size={10} />
                  {doc.time}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900 line-clamp-2">{doc.title}</h3>
              <p className="mt-1 flex-1 text-xs text-gray-500 line-clamp-2">{doc.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {doc.avatars.map((avatar, idx) => (
                    <img
                      key={idx}
                      src={avatar || "/placeholder.svg"}
                      alt="User"
                      className="h-7 w-7 rounded-full border-2 border-white object-cover"
                    />
                  ))}
                  {doc.urgent && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
                      <AlertCircle size={14} className="text-red-500" />
                    </div>
                  )}
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Document Archive Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-100 px-4 py-2 self-start">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-gray-800">Архив документов: 128</span>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Поиск по названию..."
              className="pl-9 border-gray-200 w-full"
            />
          </div>
        </div>

        <div className="space-y-3">
          {archivedDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col md:flex-row md:items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 gap-4"
            >
              <div className="flex items-center gap-4">
                {getFileIcon(doc.icon)}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <h3 className="text-sm font-semibold text-gray-900">{doc.title}</h3>
                    <span className="inline-block w-fit rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {doc.fileType}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      Проект: {doc.project}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-gray-200" />
                      Загрузил: {doc.uploader}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-gray-200" />
                      {doc.date}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                {getStatusBadge(doc.status)}
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Show More Button */}
        <div className="flex justify-center pt-4">
          <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            Показать больше документов
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
