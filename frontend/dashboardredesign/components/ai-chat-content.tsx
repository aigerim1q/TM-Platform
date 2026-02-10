'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Send, FileText, Phone, Video, MoreVertical, Sparkles, SquarePen, AlertTriangle, User, Plus, ArrowUp, ShieldCheck, ChevronRight } from 'lucide-react';

interface ProjectInfo {
    name: string;
    description: string;
    fileName: string;
    fileSize: string;
}

interface Message {
    id: number;
    text: string;
    sender: 'user' | 'other';
    timestamp: string;
    senderName?: string;
    projectInfo?: ProjectInfo;
}

interface AIChatContentProps {
    chatId: number;
    chatName: string;
    chatAvatar: string;
}

export default function AIChatContent({ chatId, chatName, chatAvatar }: AIChatContentProps) {
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode');

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');

    // Initial greeting for template mode
    useEffect(() => {
        if (mode === 'template' && messages.length === 0) {
            setMessages([
                {
                    id: 0,
                    text: "Привет! Я твой AI помощник. Ты можешь спросить меня о любом проекте, и я дам тебе информацию. Попробуй написать например \"Расскажи о проекте Shyraq\"",
                    sender: 'other',
                    timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                    senderName: 'AI-Ассистент',
                }
            ]);
        }
    }, [mode]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = {
            id: messages.length + 1,
            text: input,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');

        // AI Bot auto-reply logic
        setTimeout(() => {
            let aiResponseText = "Я проанализировал ваш запрос. Чем еще я могу помочь?";
            let projectInfo: ProjectInfo | undefined = undefined;

            const lowerInput = input.toLowerCase();

            if (lowerInput.includes('привет') || lowerInput.includes('hello')) {
                aiResponseText = "Я помогу тебе! Напиши название проекта, например \"Shyraq\", \"Ansau\" или \"Dariya\".";
            } else if (lowerInput.includes('shyraq') || lowerInput.includes('шарык')) {
                aiResponseText = "Вот информация о проекте Shyraq:";
                projectInfo = {
                    name: "Проект: Shyraq",
                    description: "Искусственный интеллект проанализировал ваш документ и сформировал структуру жилищного цикла проекта.",
                    fileName: "Техническое_задание_Shyraq.pdf",
                    fileSize: "2.4 MB"
                };
            } else if (lowerInput.includes('ansau') || lowerInput.includes('ансау')) {
                aiResponseText = "Вот информация о проекте Ansau:";
                projectInfo = {
                    name: "Проект: Ansau",
                    description: "Искусственный интеллект проанализировал ваш документ и сформировал структуру жилищного цикла проекта.",
                    fileName: "Техническое_задание_Ansau.pdf",
                    fileSize: "1.8 MB"
                };
            } else if (lowerInput.includes('dariya') || lowerInput.includes('дария')) {
                aiResponseText = "Вот информация о проекте Dariya:";
                projectInfo = {
                    name: "Проект: Dariya",
                    description: "Искусственный интеллект проанализировал ваш документ и сформировал структуру жилищного цикла проекта.",
                    fileName: "Техническое_задание_Dariya.pdf",
                    fileSize: "3.2 MB"
                };
            }

            const aiMessage: Message = {
                id: newMessages.length + 1,
                text: aiResponseText,
                sender: 'other',
                timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                senderName: 'AI-Ассистент',
                projectInfo
            };
            setMessages(prev => [...prev, aiMessage]);
        }, 1000);
    };

    const suggestionCards = [
        {
            icon: <SquarePen size={20} className="text-blue-500" />,
            iconBg: 'bg-blue-50 dark:bg-blue-900/20',
            title: 'Спланировать проект',
            desc: 'Создадим структуру этапов и задач для нового объекта'
        },
        {
            icon: <AlertTriangle size={20} className="text-purple-500" />,
            iconBg: 'bg-purple-50 dark:bg-purple-900/20',
            title: 'Проанализировать риски',
            desc: 'Найду слабые места в текущем графике поставок'
        },
        {
            icon: <User size={20} className="text-pink-500" />,
            iconBg: 'bg-pink-50 dark:bg-pink-900/20',
            title: 'Распределить задачи',
            desc: 'Оптимально назначу исполнителей по компетенциям'
        }
    ];

    return (
        <div className="flex-1 flex flex-col bg-[#F9F9FB] dark:bg-background h-full transition-colors">
            {/* Messages Area / Welcome Screen */}
            <div className="flex-1 overflow-y-auto px-6 pt-10">
                {messages.length === 0 ? (
                    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-full text-center py-10">
                        {/* Central Icon */}
                        <div className="w-16 h-16 bg-gradient-to-br from-[#A855F7] to-[#7C3AED] rounded-2xl flex items-center justify-center shadow-[0_8px_20px_rgba(139,92,246,0.3)] mb-8">
                            <Sparkles className="text-white" size={32} />
                        </div>

                        <h1 className="text-4xl font-bold text-[#111827] dark:text-white mb-4 transition-colors">
                            Чем я могу помочь вам сегодня?
                        </h1>
                        <p className="text-lg text-gray-500 dark:text-gray-400 mb-12 transition-colors">
                            Задайте вопрос или выберите одно из предложений ниже
                        </p>

                        {/* Suggestion Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
                            {suggestionCards.map((card, i) => (
                                <div
                                    key={i}
                                    className="bg-white dark:bg-card p-6 rounded-[24px] border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md dark:hover:bg-white/5 transition-all cursor-pointer text-left group"
                                    onClick={() => setInput(card.title)}
                                >
                                    <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                                        {card.icon}
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2 transition-colors">{card.title}</h3>
                                    <p className="text-sm text-gray-400 dark:text-gray-400 leading-relaxed transition-colors">{card.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-6 pb-10">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] ${message.sender === 'user'
                                        ? 'bg-[#8B5CF6] text-white rounded-2xl rounded-tr-none px-5 py-3 shadow-sm'
                                        : 'bg-white dark:bg-card text-gray-900 dark:text-gray-100 rounded-2xl rounded-tl-none px-5 py-3 border border-gray-100 dark:border-white/10 shadow-sm'
                                        }`}
                                >
                                    <p className="text-[15px] leading-relaxed">{message.text}</p>

                                    {message.projectInfo && (
                                        <Link href="/lifecycle/shyraq">
                                            <div className="mt-4 p-4 border border-[#8B5CF6] rounded-xl bg-white dark:bg-black/20 shadow-sm hover:shadow-md transition-all group cursor-pointer">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 bg-[#F5F3FF] dark:bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                                                        <FileText className="text-[#8B5CF6]" size={22} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="font-bold text-[#111827] dark:text-white text-sm transition-colors">{message.projectInfo.name}</h4>
                                                            <ChevronRight size={18} className="text-[#8B5CF6]" />
                                                        </div>
                                                        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 leading-snug transition-colors">
                                                            {message.projectInfo.description}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-3 text-[12px] text-gray-400">
                                                            <FileText size={14} className="opacity-60" />
                                                            <span>{message.projectInfo.fileName}</span>
                                                            <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                                                            <span>{message.projectInfo.fileSize}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    )}

                                    <div className={`text-[10px] mt-1.5 font-medium ${message.sender === 'user' ? 'text-white/60 text-right' : 'text-gray-400 dark:text-gray-500'}`}>
                                        {message.timestamp}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Message Input Area */}
            <div className="px-6 pb-8 pt-4">
                <div className="max-w-4xl mx-auto relative">
                    <form
                        onSubmit={handleSendMessage}
                        className="relative flex items-center bg-white dark:bg-card rounded-[24px] border border-[#E5E7EB] dark:border-white/10 shadow-[0_2px_15px_rgba(0,0,0,0.02)] ring-1 ring-purple-100/50 dark:ring-white/5 p-2 pl-4 transition-all focus-within:ring-purple-200 dark:focus-within:ring-white/20 focus-within:shadow-lg"
                    >
                        <button type="button" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <Plus size={20} />
                        </button>

                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Опишите задачу или задайте вопрос AI..."
                            className="flex-1 bg-transparent border-0 outline-none focus:ring-0 focus:outline-none text-[15px] text-gray-700 dark:text-white px-3 py-3 placeholder:text-gray-400 placeholder:font-medium"
                        />

                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="w-10 h-10 bg-[#4B4B4B] hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-200 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white rounded-full flex items-center justify-center transition-all shadow-sm shrink-0"
                        >
                            <ArrowUp className="w-5 h-5" />
                        </button>
                    </form>

                    {/* Footer Info */}
                    <div className="flex justify-between items-center mt-4 px-2 text-[11px] font-medium tracking-tight">
                        <div className="flex items-center gap-1.5 text-gray-400">
                            <div className="text-[#10B981]">
                                <ShieldCheck size={14} />
                            </div>
                            Ваши данные защищены
                        </div>
                        <div className="text-gray-400/80">
                            Нажмите Enter для отправки
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
