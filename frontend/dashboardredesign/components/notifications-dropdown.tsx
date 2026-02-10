'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ArrowRight, Video, CheckCircle, Calendar, MessageSquare, AlertTriangle, User } from 'lucide-react';

interface NotificationsDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

const dropdownNotifications = [
    {
        id: '1',
        type: 'assignment',
        category: 'Новая задача',
        title: 'Тебя назначили на задачу "Редизайн главной"',
        time: '2 минуты назад',
        isUnread: true,
        icon: <User className="text-blue-500" size={16} />,
        iconBg: 'bg-blue-100',
    },
    {
        id: '2',
        type: 'deadline',
        category: 'Дедлайн изменен',
        title: 'Сроки задачи "Бэкенд API" сдвинуты на 2 дня',
        time: '1 час назад',
        isUnread: true,
        icon: <Calendar className="text-orange-500" size={16} />,
        iconBg: 'bg-orange-100',
    },
    {
        id: '3',
        type: 'sync',
        category: 'Видеозвонок',
        title: 'Приглашение на дейли митинг с командой',
        time: '3 часа назад',
        actions: true,
        icon: <Video className="text-green-500" size={16} />,
        iconBg: 'bg-green-100',
    },
    {
        id: '4',
        type: 'comment',
        category: 'Новый комментарий',
        title: 'Анна К. оставила комментарий в задаче "UI Kit":',
        time: 'Вчера',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    },
];

export default function NotificationsDropdown({ isOpen, onClose }: NotificationsDropdownProps) {
    const router = useRouter();

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop to close on click outside */}
            <div className="fixed inset-0 z-40" onClick={onClose} />

            <div className="absolute top-16 right-0 z-50 w-96 origin-top-right rounded-3xl border border-white/20 bg-white/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900">Уведомления</h3>
                    <button className="text-xs font-medium text-amber-600 hover:text-amber-700">
                        Пометить все как прочитанные
                    </button>
                </div>

                {/* Content */}
                <div className="max-h-[450px] overflow-y-auto">
                    {dropdownNotifications.map((notif) => (
                        <div
                            key={notif.id}
                            className={`relative flex gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer border-l-4 ${notif.isUnread ? 'border-amber-400' : 'border-transparent'}`}
                        >
                            {/* Icon / Avatar */}
                            <div className="flex-shrink-0">
                                {notif.avatar ? (
                                    <img src={notif.avatar} className="h-10 w-10 rounded-full object-cover" alt="" />
                                ) : (
                                    <div className={`h-10 w-10 rounded-full ${notif.iconBg} flex items-center justify-center`}>
                                        {notif.icon}
                                    </div>
                                )}
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                        {notif.category}
                                    </span>
                                    {notif.isUnread && (
                                        <span className="h-2 w-2 rounded-full bg-amber-500 mt-1" />
                                    )}
                                </div>
                                <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                                    {notif.title}
                                </p>
                                <span className="text-xs text-gray-400 mt-1 block">{notif.time}</span>

                                {/* Actions for Sync */}
                                {notif.actions && (
                                    <div className="flex gap-2 mt-3">
                                        <button className="flex-1 px-3 py-1.5 bg-amber-200/50 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-lg transition-colors">
                                            Принять
                                        </button>
                                        <button className="flex-1 px-3 py-1.5 bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 text-xs font-bold rounded-lg transition-colors">
                                            Отклонить
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <button
                    onClick={() => {
                        router.push('/notifications');
                        onClose();
                    }}
                    className="w-full py-4 text-center text-sm font-bold text-amber-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 border-t border-gray-100"
                >
                    Показать все уведомления
                    <ArrowRight size={16} />
                </button>
            </div>
        </>
    );
}
