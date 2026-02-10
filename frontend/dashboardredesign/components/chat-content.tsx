'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, FileText, Phone, Video, MoreVertical, Plus, Smile, Paperclip, ChevronRight, Info, ChevronLeft } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'other';
  timestamp: string;
}

interface ChatContentProps {
  chatId: number;
  chatName: string;
  chatAvatar: string;
  onBack?: () => void;
  className?: string; // Added className prop
}

export default function ChatContent({ chatId, chatName, chatAvatar, onBack, className = '' }: ChatContentProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Привет! Плитка доставлена на объект Shyraq. Можем начинать укладку?",
      sender: 'other',
      timestamp: '12:30',
    },
    {
      id: 2,
      text: "Отлично! Да, начинайте согласно графику. Главное — следите за качеством швов.",
      sender: 'user',
      timestamp: '12:35',
    },
    {
      id: 3,
      text: "Принято. Фотоотчет пришлю в конце смены.",
      sender: 'other',
      timestamp: '12:40',
    }
  ]);
  const [input, setInput] = useState('');
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

    setMessages([...messages, userMessage]);
    setInput('');
  };

  return (
    <div className={`flex-1 flex flex-col h-full bg-white dark:bg-[#110027] relative overflow-hidden transition-colors ${className}`}>
      {/* Chat Header */}
      <div className="px-4 md:px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-white/80 dark:bg-[#110027]/80 backdrop-blur-md z-10 sticky top-0 transition-colors">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Back Button for Mobile */}
          <button
            onClick={onBack}
            className="md:hidden p-1 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden ring-2 ring-gray-50 shadow-sm">
            <img src={chatAvatar} alt={chatName} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-[15px] md:text-[16px] tracking-tight transition-colors line-clamp-1">{chatName}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[11px] md:text-[12px] font-medium text-gray-500">онлайн</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-6 text-gray-400 dark:text-gray-500">
          <button className="hover:text-amber-500 transition-colors"><Phone size={20} /></button>
          <button className="hover:text-amber-500 transition-colors"><Video size={20} /></button>
          <button className="hover:text-amber-500 transition-colors"><MoreVertical size={20} /></button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'} max-w-[75%]`}>
              <div
                className={`px-5 py-3 rounded-[20px] shadow-sm relative text-[15px] leading-relaxed ${message.sender === 'user'
                  ? 'bg-amber-500 text-white rounded-tr-none'
                  : 'bg-[#F3F4F6] dark:bg-white/10 text-gray-800 dark:text-gray-200 rounded-tl-none'
                  }`}
              >
                {message.text}
              </div>
              <span className="text-[11px] text-gray-400 mt-1.5 font-medium px-1">
                {message.timestamp} {message.sender === 'user' && '· Просмотрено'}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white dark:bg-[#110027] border-t border-gray-100 dark:border-white/5 transition-colors">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-all">
              <Plus size={22} />
            </button>
          </div>

          <form onSubmit={handleSendMessage} className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Написать сообщение..."
              className="w-full bg-[#f8f9fa] dark:bg-white/5 border-0 py-3.5 px-6 rounded-full focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/10 focus:bg-white dark:focus:bg-white/10 transition-all text-[15px] text-gray-700 dark:text-white placeholder:text-gray-400"
            />
          </form>

          <button
            onClick={handleSendMessage}
            disabled={!input.trim()}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${input.trim()
              ? 'bg-amber-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95'
              : 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600 pointer-events-none'
              }`}
          >
            <Send size={20} className={input.trim() ? "translate-x-0.5" : ""} />
          </button>
        </div>
        <div className="mt-4 flex justify-center">
          <p className="text-[11px] text-gray-400 font-medium">Ваши сообщения защищены сквозным шифрованием</p>
        </div>
      </div>
    </div>
  );
}
