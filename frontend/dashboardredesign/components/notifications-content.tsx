'use client';

import { useState } from 'react';
import {
    User,
    ArrowRight,
    Calendar,
    MessageSquare,
    AlertTriangle,
    Video,
    CheckCircle,
    MoreHorizontal,
    Bell,
} from 'lucide-react';

type NotificationType =
    | 'assignment'
    | 'delegation'
    | 'deadline'
    | 'comment'
    | 'warning'
    | 'sync'
    | 'completion';

interface Notification {
    id: string;
    type: NotificationType;
    title: React.ReactNode;
    description?: string;
    meta?: string; // For things like original author, assigned to, etc.
    time: string;
    isUnread?: boolean;
    dateGroup?: string; // 'Today', 'Yesterday', etc.
    action?: {
        label: string;
        onClick: () => void;
    };
    details?: React.ReactNode; // Extra content like the quote
}

const mockNotifications: Notification[] = [
    {
        id: '1',
        type: 'assignment',
        title: (
            <span>
                <span className="font-semibold">Алексей Смирнов</span> назначил вас на задачу
            </span>
        ),
        description: 'Разработка API для мобильного приложения',
        meta: 'Необходимо подготовить endpoints для аутентификации...',
        time: '2 мин назад',
        isUnread: true,
        dateGroup: 'Today',
    },
    {
        id: '2',
        type: 'delegation',
        title: <span className="font-semibold">Задача делегирована</span>,
        description: 'Задача "Дизайн главной страницы" передана',
        meta: 'Мария Иванова', // Using meta for the assigned user pill
        time: '15 мин назад',
        isUnread: true,
        dateGroup: 'Today',
    },
    {
        id: '3',
        type: 'deadline',
        title: <span className="font-semibold">Обновлен дедлайн</span>,
        description: 'Задача "Бэкенд логика корзины"',
        meta: '12 Окт -> 14 Окт', // Using meta for date change
        time: '1 час назад',
        dateGroup: 'Today',
    },
    {
        id: '4',
        type: 'comment',
        title: (
            <span>
                Новый комментарий в <span className="font-semibold">"Маркетинг план"</span>
            </span>
        ),
        time: '3 часа назад',
        dateGroup: 'Today',
        details: (
            <div className="mt-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                    <img
                        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                        alt="Elena"
                        className="h-5 w-5 rounded-full object-cover"
                    />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Елена Козлова</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                    "Коллеги, нужно проверить цифры по конверсии за прошлый квартал, кажется, там ошибка..."
                </p>
            </div>
        ),
    },
    {
        id: '5',
        type: 'warning',
        title: (
            <span className="text-red-600 font-semibold">
                Дедлайн просрочен <span className="ml-2 inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">критично</span>
            </span>
        ),
        description: 'Отчет за Q3',
        meta: 'Эта задача блокирует начало следующего спринта.',
        time: 'Просрочено на 2 часа',
        dateGroup: 'Today',
        isUnread: false, // Visual treatment is strong enough
    },
    {
        id: '6',
        type: 'sync',
        title: <span className="font-semibold">Еженедельный синк команды</span>,
        time: 'Сейчас',
        dateGroup: 'Today',
        action: {
            label: 'Присоединиться',
            onClick: () => console.log('Join meeting'),
        },
        meta: '+4', // For avatars
    },
    {
        id: '7',
        type: 'completion',
        title: <span className="font-semibold text-gray-500 dark:text-gray-400 line-through">Задача выполнена</span>,
        description: 'Дмитрий завершил задачу "Подготовка макетов для печати"',
        time: 'Вчера, 18:30',
        dateGroup: 'ВЧЕРА',
    },
];

export default function NotificationsContent() {
    const [activeTab, setActiveTab] = useState('Все');

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'assignment':
                return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"><User size={20} /></div>;
            case 'delegation':
                return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"><ArrowRight size={20} /></div>;
            case 'deadline':
                return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"><Calendar size={20} /></div>;
            case 'comment':
                return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"><MessageSquare size={20} /></div>;
            case 'warning':
                return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"><AlertTriangle size={20} /></div>;
            case 'sync':
                return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"><Video size={20} /></div>;
            case 'completion':
                return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"><CheckCircle size={20} /></div>;
        }
    };

    const renderMeta = (notification: Notification) => {
        if (notification.type === 'delegation' && notification.meta) {
            return (
                <div className="flex items-center gap-1 mt-1">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">Задача "Дизайн главной страницы" передана</span>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
                        <div className="h-4 w-4 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-[8px] overflow-hidden">
                            <User size={10} className="text-gray-600 dark:text-gray-300" />
                        </div>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{notification.meta}</span>
                    </div>
                </div>
            )
        }
        if (notification.type === 'deadline' && notification.meta) {
            const [oldDate, newDate] = notification.meta.split('->').map(s => s.trim());
            return (
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span>Задача  <span className="font-medium text-gray-900 dark:text-white">"Бэкенд логика корзины"</span></span>
                    <span className="line-through text-gray-400 dark:text-gray-500">{oldDate}</span>
                    <ArrowRight size={12} className="text-gray-400 dark:text-gray-500" />
                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded text-xs font-medium">{newDate}</span>
                </div>
            )

        }
        if (notification.type === 'sync') {
            return (
                <div className="flex items-center gap-[-8px] mt-2">
                    <div className="flex -space-x-2">
                        <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800" src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="" />
                        <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800" src="https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="" />
                        <img className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="" />
                        <div className="h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-medium text-gray-500 dark:text-gray-400">
                            {notification.meta}
                        </div>
                    </div>
                </div>
            );
        }
        if (notification.details) return notification.details;
        return notification.description ? <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{notification.description}</p> : null;
    }
    // Specific tweaks to match the exact design for "Delegation" meta content as string was a bit limited
    const getNotificationContent = (item: Notification) => {
        if (item.type === 'delegation') {
            return (
                <div>
                    <div className="text-gray-900 dark:text-gray-100">{item.title}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>Задача <span className="font-medium text-gray-900 dark:text-white">"Дизайн главной страницы"</span> передана</span>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 pl-1 pr-2 py-0.5">
                            <div className="h-4 w-4 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center overflow-hidden">
                                <User size={12} className="text-gray-600 dark:text-gray-300" />
                            </div>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{item.meta}</span>
                        </div>
                    </div>
                </div>
            )
        }
        if (item.type === 'assignment') {
            return (
                <div>
                    <div className="text-gray-900 dark:text-gray-100">{item.title}</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-200">
                        • {item.description}
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {item.meta}
                    </div>
                </div>
            )
        }
        if (item.type === 'deadline') {
            const [oldDate, newDate] = (item.meta || '').split('->').map(s => s.trim());
            return (
                <div>
                    <div className="text-gray-900 dark:text-gray-100">{item.title}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>Задача <span className="font-medium text-gray-900 dark:text-white">"Бэкенд логика корзины"</span></span>
                        <span className="line-through decoration-gray-400 text-gray-400 dark:text-gray-500">{oldDate}</span>
                        <ArrowRight size={12} className="text-gray-400 dark:text-gray-500" />
                        <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">{newDate}</span>
                    </div>
                </div>
            )
        }
        if (item.type === 'warning') {
            return (
                <div>
                    <div className="text-gray-900 dark:text-gray-100">{item.title}</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-200">
                        {item.description}
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {item.meta}
                    </div>
                </div>
            )
        }

        return (
            <div>
                <div className="text-gray-900 dark:text-gray-100">{item.title}</div>
                {renderMeta(item)}
            </div>
        )
    }


    return (
        <div className="mx-auto max-w-7xl px-6 py-8 pb-20">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                    <Bell size={28} className="text-gray-900 dark:text-white" />
                    <h1 className="text-3xl font-bold tracking-tight">Уведомления</h1>
                </div>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Следите за обновлениями по вашим проектам</p>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('Все')}
                    className={`relative pb-3 text-sm font-medium transition-colors hover:text-gray-900 dark:hover:text-white px-4 ${activeTab === 'Все'
                        ? 'text-gray-900 dark:text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-gray-900 dark:after:bg-white'
                        : 'text-gray-500 dark:text-gray-400'
                        }`}
                >
                    Все
                </button>
                <button
                    onClick={() => setActiveTab('Непрочитанные')}
                    className={`relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors hover:text-gray-900 dark:hover:text-white px-4 ${activeTab === 'Непрочитанные'
                        ? 'text-gray-900 dark:text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-gray-900 dark:after:bg-white'
                        : 'text-gray-500 dark:text-gray-400'
                        }`}
                >
                    Непрочитанные
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
                </button>
                <button
                    onClick={() => setActiveTab('Упоминания')}
                    className={`relative pb-3 text-sm font-medium transition-colors hover:text-gray-900 dark:hover:text-white px-4 ${activeTab === 'Упоминания'
                        ? 'text-gray-900 dark:text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-gray-900 dark:after:bg-white'
                        : 'text-gray-500 dark:text-gray-400'
                        }`}
                >
                    Упоминания
                </button>
            </div>

            {/* Notifications List */}
            <div className="space-y-4">
                {mockNotifications.map((item, index) => {
                    const isLast = index === mockNotifications.length - 1;
                    const showDateHeader = item.dateGroup && (index === 0 || mockNotifications[index - 1].dateGroup !== item.dateGroup && item.dateGroup !== 'Today'); // Simplified logic from design

                    return (
                        <div key={item.id}>
                            {showDateHeader && (
                                <div className="mb-4 mt-8">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{item.dateGroup}</h3>
                                </div>
                            )}

                            <div className={`group relative flex items-start gap-4 rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-sm ring-1 transition-all hover:shadow-md ${item.type === 'warning' ? 'bg-red-50/30 dark:bg-red-900/10 ring-red-100 dark:ring-red-900/30 hover:bg-red-50/50 dark:hover:bg-red-900/20' : 'ring-gray-100 dark:ring-gray-700 hover:ring-gray-200 dark:hover:ring-gray-600'}`}>
                                {/* Unread Dot */}
                                {item.isUnread && (
                                    <div className="absolute left-3 top-8 h-2 w-2 rounded-full bg-blue-500" />
                                )}

                                {/* Icon */}
                                <div className="flex-shrink-0 ml-2"> {/* Added left margin to account for dot dot visual space if needed, or just standard spacing */}
                                    {getIcon(item.type)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            {getNotificationContent(item)}
                                        </div>
                                        <span className={`whitespace-nowrap text-xs ${item.type === 'warning' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                            {item.time}
                                        </span>
                                    </div>

                                    {/* Action Button */}
                                    {item.action && (
                                        <div className="mt-3 flex justify-end">
                                            <button
                                                onClick={item.action.onClick}
                                                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-500"
                                            >
                                                <div className="mr-1.5 bg-white rounded-full p-0.5">
                                                    <Video size={10} className="text-amber-500" fill="currentColor" />
                                                </div>
                                                {item.action.label}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Show More */}
            <div className="mt-8 flex justify-center">
                <button className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    Показать больше
                    <ArrowRight size={16} className="rotate-90" />
                </button>
            </div>
        </div>
    );
}
