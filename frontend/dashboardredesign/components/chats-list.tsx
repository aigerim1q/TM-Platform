'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Settings, Plus } from 'lucide-react';

import type { ChatThread } from '@/lib/chats';
import { getDisplayNameFromEmail, getFileUrl } from '@/lib/utils';

interface ChatsListProps {
  threads: ChatThread[];
  selectedChatId?: string;
  onSelectChat?: (chatId: string) => void;
  className?: string;
  loading?: boolean;
}

function formatThreadTime(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diff = now - date.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (diff < day) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function threadDisplayName(thread: ChatThread) {
  if (thread.is_group) return thread.name;
  if (thread.partner_full_name) return thread.partner_full_name;
  return getDisplayNameFromEmail(thread.partner_email || thread.name);
}

export default function ChatsList({ threads, selectedChatId, onSelectChat, className = '', loading = false }: ChatsListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const base = [...threads].sort((a, b) => {
      const aTs = Date.parse(a.last_message_at || a.updated_at || '');
      const bTs = Date.parse(b.last_message_at || b.updated_at || '');
      return (Number.isNaN(bTs) ? 0 : bTs) - (Number.isNaN(aTs) ? 0 : aTs);
    });

    if (!normalizedQuery) return base;
    return base.filter((thread) => threadDisplayName(thread).toLowerCase().includes(normalizedQuery));
  }, [threads, searchQuery]);

  return (
    <div className={`w-full md:w-80 border-r border-gray-100 dark:border-white/5 bg-white dark:bg-[#050505] flex flex-col h-full transition-colors ${className}`}>
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight transition-colors">Сообщения</h2>
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <Settings size={22} strokeWidth={1.5} />
          </button>
        </div>

        <button
          onClick={() => router.push('/chats/new')}
          className="w-full flex items-center justify-center gap-2 bg-[#F3E8D6]/60 hover:bg-[#F3E8D6]/80 dark:bg-[#7c3aed] dark:hover:bg-[#6d28d9] text-gray-900 dark:text-white font-bold py-5 px-4 rounded-[20px] transition-all mb-8 border border-[#F3E8D6]/20 dark:border-transparent shadow-sm"
        >
          <Plus size={24} strokeWidth={2.5} />
          <span className="text-[17px]">Создать групповой чат</span>
        </button>

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

      <div className="flex-1 overflow-y-auto px-4">
        {loading && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm font-medium">Загрузка чатов...</p>
          </div>
        )}

        {!loading && filteredChats.length > 0 && (
          filteredChats.map((thread) => {
            const name = threadDisplayName(thread);
            const time = formatThreadTime(thread.last_message_at || thread.updated_at);
            const preview = thread.last_message || (thread.last_message_type ? `[${thread.last_message_type}]` : 'Сообщений пока нет');
            const isSelected = selectedChatId === thread.id;

            return (
              <button
                key={thread.id}
                onClick={() => onSelectChat?.(thread.id)}
                className={`w-full flex items-center gap-4 p-3.5 rounded-[12px] transition-all mb-1 group ${isSelected ? 'bg-[#f8f9fa] dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
              >
                <div className="relative shrink-0">
                  {(() => {
                    const avatarSrc = !thread.is_group ? getFileUrl(thread.partner_avatar_url) : null;
                    return avatarSrc ? (
                      <img src={avatarSrc} alt={name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#D1B891] text-white font-bold flex items-center justify-center">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    );
                  })()}
                  {!thread.is_group && (
                    <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white dark:border-[#050505] rounded-full ${thread.online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  )}
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between mb-0.5 gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-[14px] truncate tracking-tight transition-colors">{name}</h3>
                    <span className="text-[11px] font-medium text-gray-400">{time}</span>
                  </div>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate leading-snug transition-colors">{preview}</p>
                </div>
              </button>
            );
          })
        )}

        {!loading && filteredChats.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 transition-colors">
            <p className="text-sm font-medium">Чаты не найдены</p>
          </div>
        )}
      </div>
    </div>
  );
}
