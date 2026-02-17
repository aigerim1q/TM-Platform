'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AIChatModal from '@/components/ai-chat-modal';
import { X } from 'lucide-react';

export default function AIBubble() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    // Hide the bubble on chat/chats pages
    const isExcludedPage = pathname?.startsWith('/chat') || pathname?.startsWith('/chats');

    if (isExcludedPage) return null;

    return (
        <>
            <AIChatModal open={open} onClose={() => setOpen(false)} />

            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-label="Открыть AI-чат"
                className={`fixed bottom-8 right-6 z-[100] w-16 h-16 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.35)] border overflow-hidden transition-all duration-300 hover:scale-110 active:scale-95 animate-in zoom-in slide-in-from-bottom-10 fade-in ease-out cursor-pointer ${open
                    ? 'bg-[#2d9cfa] border-white/40'
                    : 'bg-gradient-to-br from-[#1a1a1a]/90 via-[#0d0d0d]/90 to-[#000000]/90 border-white/10'}
                `}
            >
                {open ? (
                    <>
                        <div className="absolute inset-0 rounded-full bg-white/25 scale-[1.22] -z-10" />
                        <X className="text-white" size={30} />
                    </>
                ) : (
                    <>
                        {/* Ambient Glow */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

                        <div className="relative flex items-center gap-1.5 translate-x-[-1px]">
                            {/* Hex Icon (More detailed grid matching the image) */}
                            <svg width="28" height="28" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white opacity-90">
                                <path d="M21 2L37.45 11.5V30.5L21 40L4.55 30.5V11.5L21 2Z" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M21 2V40M4.55 11.5L37.45 30.5M4.55 30.5L37.45 11.5" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                                <path d="M12.775 6.75L29.225 35.25M12.775 35.25L29.225 6.75M4.55 21H37.45" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                                <circle cx="21" cy="21" r="1" fill="currentColor" />
                                <circle cx="12.775" cy="6.75" r="0.5" fill="currentColor" />
                                <circle cx="29.225" cy="6.75" r="0.5" fill="currentColor" />
                                <circle cx="4.55" cy="11.5" r="0.5" fill="currentColor" />
                                <circle cx="37.45" cy="11.5" r="0.5" fill="currentColor" />
                                <circle cx="4.55" cy="30.5" r="0.5" fill="currentColor" />
                                <circle cx="37.45" cy="30.5" r="0.5" fill="currentColor" />
                                <circle cx="12.775" cy="35.25" r="0.5" fill="currentColor" />
                                <circle cx="29.225" cy="35.25" r="0.5" fill="currentColor" />
                            </svg>

                            {/* AI Text */}
                            <span className="text-lg font-black text-white tracking-tighter">AI</span>
                        </div>

                        {/* Reflection Sweep */}
                        <div className="absolute top-0 -left-[100%] h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-30deg] group-hover:left-[150%] transition-all duration-700 ease-in-out" />
                    </>
                )}
            </button>
        </>
    );
}
