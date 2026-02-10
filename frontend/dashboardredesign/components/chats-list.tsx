'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Settings, Plus } from 'lucide-react';

interface Chat {
  id: number;
  name: string;
  lastMessage: string;
  time: string;
  avatar: string;
  isProject: boolean;
  online?: boolean;
}

interface ChatsListProps {
  selectedChatId?: number;
  onSelectChat?: (chatId: number) => void;
  className?: string;
}

export const chatsData: Chat[] = [
  {
    id: 1,
    name: 'Проект Shyraq',
    lastMessage: 'Алексей: Плитка доставлена на об...',
    time: '12:30',
    avatar: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1000&auto=format&fit=crop',
    isProject: true,
    online: true,
  },
  {
    id: 2,
    name: 'Мария (HR)',
    lastMessage: 'Документы на подпись готовы,...',
    time: 'Вчера',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    isProject: false,
  },
  {
    id: 3,
    name: 'Дизайн отдел',
    lastMessage: 'Новые макеты загружены в папку',
    time: 'Вт',
    avatar: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&h=100&fit=crop',
    isProject: false,
  },
  {
    id: 4,
    name: 'Ербол (Прораб)',
    lastMessage: 'Нужно согласовать смету по элек...',
    time: 'Пн',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    isProject: false,
    online: true,
  },
  {
    id: 5,
    name: 'Ляззат Нуркеева',
    lastMessage: 'Привет, ты видел отчет за прошлый...',
    time: '10.01',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    isProject: false,
  },
  {
    id: 6,
    name: 'Марат Алиев',
    lastMessage: 'Напоминаю, что по плану на эту не...',
    time: '09.01',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    isProject: false,
  },
  {
    id: 7,
    name: 'Тимур Азимов',
    lastMessage: 'Прошу до конца дня проверить ста...',
    time: '05.01',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    isProject: false,
  },
];

export default function ChatsList({ selectedChatId, onSelectChat, className = '' }: ChatsListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [displayChats, setDisplayChats] = useState<Chat[]>(chatsData);

  useEffect(() => {
    // Load custom chats from localStorage to simulate persistence
    const loadChats = () => {
      const customChats = JSON.parse(localStorage.getItem('custom_chats') || '[]');
      // Filter out duplicates if any
      const uniqueInitial = chatsData.filter(c => !customChats.some((cc: Chat) => cc.id === c.id));
      setDisplayChats([...customChats, ...uniqueInitial]);
    };

    loadChats();

    // Optional: listen for storage changes in case of cross-tab creation
    window.addEventListener('storage', loadChats);
    return () => window.removeEventListener('storage', loadChats);
  }, []);

  const filteredChats = displayChats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`w-full md:w-80 border-r border-gray-100 dark:border-white/5 bg-white dark:bg-[#050505] flex flex-col h-full transition-colors ${className}`}>
      {/* Header with Title and Settings Icon */}
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight transition-colors">Сообщения</h2>
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <Settings size={22} strokeWidth={1.5} />
          </button>
        </div>

        {/* Create new chat button */}
        <button
          onClick={() => router.push('/chats/new')}
          className="w-full flex items-center justify-center gap-2 bg-[#F3E8D6]/60 hover:bg-[#F3E8D6]/80 dark:bg-[#7c3aed] dark:hover:bg-[#6d28d9] text-gray-900 dark:text-white font-bold py-5 px-4 rounded-[20px] transition-all mb-8 border border-[#F3E8D6]/20 dark:border-transparent shadow-sm"
        >
          <Plus size={24} strokeWidth={2.5} />
          <span className="text-[17px]">Создать групповой чат</span>
        </button>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 rounded-[16px] bg-[#f8f9fa] dark:bg-white/5 border-0 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/20 placeholder:text-gray-400 placeholder:font-medium text-gray-900 dark:text-white transition-colors"
          />
        </div>
      </div>

      {/* Chats list */}
      <div className="flex-1 overflow-y-auto px-4">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onSelectChat?.(chat.id)}
              className={`w-full flex items-center gap-4 p-3.5 rounded-[12px] transition-all mb-1 group ${selectedChatId === chat.id ? 'bg-[#f8f9fa] dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                  {chat.avatar.startsWith('/') ? (
                    <div className="w-full h-full bg-[#D1B891] flex items-center justify-center text-white font-bold text-lg">
                      {chat.name[0]}
                    </div>
                  ) : (
                    <img
                      src={chat.avatar}
                      alt={chat.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {chat.online && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-card rounded-full" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-bold text-gray-900 dark:text-white text-[14px] truncate tracking-tight transition-colors">{chat.name}</h3>
                  <span className={`text-[11px] font-medium ${chat.time === 'только что' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-gray-400'}`}>{chat.time}</span>
                </div>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate leading-snug transition-colors">{chat.lastMessage}</p>
              </div>
            </button>
          ))
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 transition-colors">
            <p className="text-sm font-medium">Чаты не найдены</p>
          </div>
        )}
      </div>
    </div>
  );
}
