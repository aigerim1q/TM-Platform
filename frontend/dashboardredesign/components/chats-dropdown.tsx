'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Plus, ArrowRight } from 'lucide-react';

interface ChatsDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

const dropdownChats = [
    {
        id: 1,
        name: 'Проект Shyraq',
        lastMessage: 'Алексей: Плитка доставлена на об...',
        time: '12:30',
        avatar: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1000&auto=format&fit=crop',
    },
    {
        id: 2,
        name: 'Мария (HR)',
        lastMessage: 'Документы на подпись готовы,...',
        time: 'Вчера',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    },
    {
        id: 3,
        name: 'Дизайн отдел',
        lastMessage: 'Новые макеты загружены в папку',
        time: 'Вт',
        avatar: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&h=100&fit=crop',
    },
    {
        id: 4,
        name: 'Ербол (Прораб)',
        lastMessage: 'Нужно согласовать смету по элек...',
        time: 'Пн',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    },
];

export default function ChatsDropdown({ isOpen, onClose }: ChatsDropdownProps) {
    const router = useRouter();

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop to close on click outside */}
            <div className="fixed inset-0 z-40" onClick={onClose} />

            <div className="absolute top-16 right-0 z-50 w-[420px] origin-top-right rounded-[32px] border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1f2937] shadow-[0_20px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in duration-200 ring-1 ring-black/5 dark:ring-white/5">
                <div className="p-6 pb-2">
                    {/* Create new chat button - Matching Screenshot 2 exactly */}
                    <button
                        onClick={() => {
                            router.push('/chats/new');
                            onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-[#F3E8D6]/60 hover:bg-[#F3E8D6]/80 dark:bg-[#7c3aed] dark:hover:bg-[#6d28d9] text-gray-900 dark:text-white font-bold py-5 px-4 rounded-[20px] transition-all mb-8 border border-[#F3E8D6]/20 dark:border-transparent shadow-sm"
                    >
                        <Plus size={24} strokeWidth={2.5} />
                        <span className="text-[17px]">Создать групповой чат</span>
                    </button>

                    {/* Chats list */}
                    <div className="space-y-1">
                        {dropdownChats.map((chat) => (
                            <div
                                key={chat.id}
                                className="flex items-center gap-4 px-3 py-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                onClick={() => {
                                    router.push(`/chats?id=${chat.id}`);
                                    onClose();
                                }}
                            >
                                <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-100 dark:border-white/10 shrink-0">
                                    <img src={chat.avatar} className="h-full w-full object-cover" alt="" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="text-[15px] font-bold text-gray-900 dark:text-white truncate tracking-tight">
                                            {chat.name}
                                        </h4>
                                        <span className="text-[12px] font-medium text-gray-400 dark:text-[#10b981]">
                                            {chat.time}
                                        </span>
                                    </div>
                                    <p className="text-[14px] text-gray-500 dark:text-gray-400 truncate leading-snug">
                                        {chat.lastMessage}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer - Matching Screenshot 2 exactly */}
                <button
                    onClick={() => {
                        router.push('/chats');
                        onClose();
                    }}
                    className="w-full py-6 mt-2 text-center text-[15px] font-extrabold text-blue-600 dark:text-[#10b981] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors uppercase tracking-wider border-t border-gray-50 dark:border-white/5"
                >
                    ПОКАЗАТЬ ВСЕ ЧАТЫ
                </button>
            </div>
        </>
    );
}
