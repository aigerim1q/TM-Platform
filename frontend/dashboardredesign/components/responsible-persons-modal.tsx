'use client';

import { X, UserPlus } from 'lucide-react';
import { useState } from 'react';

interface ResponsiblePerson {
    id: string;
    name: string;
    role: string;
    avatar: string;
}

interface ResponsiblePersonsModalProps {
    isOpen: boolean;
    onClose: () => void;
    persons: ResponsiblePerson[];
}

export default function ResponsiblePersonsModal({
    isOpen,
    onClose,
    persons,
}: ResponsiblePersonsModalProps) {
    const [selectedDepartment, setSelectedDepartment] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-[#F5F5F5] dark:bg-gray-900 rounded-[32px] w-full max-w-[600px] mx-4 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                        <svg
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-gray-900 dark:text-white"
                        >
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ответственные</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium">
                            <UserPlus className="w-5 h-5" strokeWidth={2} />
                            Делегировать
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
                        >
                            <X className="w-6 h-6 text-gray-900 dark:text-white" strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5 max-h-[500px] overflow-y-auto">
                    {/* Persons List */}
                    <div className="space-y-4 mb-8">
                        {persons.map((person) => (
                            <div
                                key={person.id}
                                className="flex items-center gap-4 py-2"
                            >
                                {/* Avatar */}
                                <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white dark:ring-gray-700 shadow-md">
                                    <img
                                        src={person.avatar}
                                        alt={person.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {/* Info */}
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
                                        {person.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                        {person.role}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-300 dark:border-gray-700 mb-6" />

                    {/* Quick Delegation Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Быстрое делегирование
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                Выбрать из ответственных
                            </p>
                        </div>

                        {/* Employee Dropdown */}
                        <div className="relative">
                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="w-full px-6 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white font-medium appearance-none cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10"
                            >
                                <option value="">Выбрать ответственного...</option>
                                <option value="askar">Аскар Нурланов - Главный архитектор</option>
                                <option value="dinara">Динара Жумабаева - Инженер</option>
                                <option value="timur">Тимур Касымов - Прораб</option>
                                <option value="aida">Аида Сагындыкова - Дизайнер</option>
                                <option value="marat">Марат Абдуллаев - Конструктор</option>
                                <option value="gulmira">Гульмира Токтарова - Архитектор</option>
                                <option value="nurlan">Нурлан Ержанов - Инженер ПТО</option>
                                <option value="saule">Сауле Бекмуратова - Аудитор</option>
                                <option value="erlan">Ерлан Мухамедов - Геодезист</option>
                                <option value="zhanna">Жанна Алимова - Сметчик</option>
                                <option value="baurzhan">Бауржан Сарсенов - Электрик</option>
                                <option value="aliya">Алия Кенжебаева - Технолог</option>
                            </select>
                            <svg
                                className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                            >
                                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>

                    {/* Add Button */}
                    <button className="w-full bg-[#E9DFBD] dark:bg-[#4a4225] hover:bg-[#DFD3A8] dark:hover:bg-[#5c5230] text-gray-900 dark:text-amber-50 font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-3 shadow-sm">
                        <UserPlus className="w-5 h-5" strokeWidth={2.5} />
                        Добавить ответственных
                    </button>
                </div>
            </div>
        </div>
    );
}
