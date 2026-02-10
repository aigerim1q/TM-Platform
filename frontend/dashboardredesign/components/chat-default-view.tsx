'use client';

import { Lock } from 'lucide-react';

export default function ChatDefaultView() {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-[#110027] text-center px-6 transition-colors">
            <div className="mb-10">
                <div className="w-24 h-24 flex items-center justify-center opacity-80">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#D1B891] dark:text-amber-500/80">
                        <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="currentColor" />
                    </svg>
                </div>
            </div>

            <h2 className="text-[32px] font-extrabold text-[#1A1C1E] dark:text-white mb-6 tracking-tight leading-[1.1] transition-colors">
                Выберите чат, чтобы начать <br /> общение
            </h2>

            <p className="text-[#6C757D] dark:text-gray-400 max-w-md mb-16 text-[17px] leading-relaxed font-medium transition-colors">
                Отправляйте сообщения, делитесь файлами и обсуждайте проекты с коллегами в режиме реального времени.
            </p>

            <div className="flex items-center gap-3 text-[15px] text-[#1A1C1E] dark:text-white font-bold transition-colors">
                <Lock size={18} fill="currentColor" className="text-[#1A1C1E] dark:text-white" />
                <span className="tracking-tight">Все сообщения надёжно зашифрованы</span>
            </div>
        </div>
    );
}
