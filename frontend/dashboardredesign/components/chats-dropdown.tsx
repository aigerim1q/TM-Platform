'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { ensureDirectThread, listChatUsers, type ChatUser } from '@/lib/chats';
import { getDisplayNameFromEmail, getFileUrl } from '@/lib/utils';

interface ChatsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatMetaTime(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diff = now - date.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (diff < day) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('ru-RU', { weekday: 'short' });
}

function buildSubtitle(user: ChatUser) {
  const chunks: string[] = [];
  if (user.role) chunks.push(user.role);
  if (user.department_name) chunks.push(user.department_name);
  chunks.push(user.online ? 'онлайн' : 'не в сети');
  return chunks.join(' • ');
}

export default function ChatsDropdown({ isOpen, onClose }: ChatsDropdownProps) {
  const router = useRouter();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await listChatUsers(8);
        if (!mounted) return;
        setUsers(Array.isArray(data) ? data : []);
      } catch {
        if (!mounted) return;
        setUsers([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    load();
    const id = window.setInterval(load, 20_000);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [isOpen]);

  const visibleUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;

      const aTs = a.last_message_at ? Date.parse(a.last_message_at) : 0;
      const bTs = b.last_message_at ? Date.parse(b.last_message_at) : 0;
      return bTs - aTs;
    });
  }, [users]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute top-16 right-0 z-50 w-105 max-h-[80vh] origin-top-right rounded-4xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1f2937] shadow-[0_20px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in duration-200 ring-1 ring-black/5 dark:ring-white/5 flex flex-col">
        <div className="p-6 pb-2 flex flex-col min-h-0">
          <button
            onClick={() => {
              router.push('/chats/new');
              onClose();
            }}
            className="w-full shrink-0 flex items-center justify-center gap-2 bg-[#F3E8D6]/60 hover:bg-[#F3E8D6]/80 dark:bg-[#7c3aed] dark:hover:bg-[#6d28d9] text-gray-900 dark:text-white font-bold py-5 px-4 rounded-[20px] transition-all mb-8 border border-[#F3E8D6]/20 dark:border-transparent shadow-sm"
          >
            <Plus size={24} strokeWidth={2.5} />
            <span className="text-[17px]">Создать групповой чат</span>
          </button>

          <div className="space-y-1 overflow-y-auto pr-1 min-h-0 flex-1">
            {loading && (
              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
            )}

            {!loading && visibleUsers.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">Пользователи не найдены</div>
            )}

            {!loading && visibleUsers.map((user) => {
              const name = user.full_name || getDisplayNameFromEmail(user.email);
              const time = formatMetaTime(user.last_message_at);
              const preview = user.last_message || buildSubtitle(user);
              const avatarSrc = getFileUrl(user.avatar_url);

              return (
                <div
                  key={user.id}
                  className="flex items-center gap-4 px-3 py-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={async () => {
                    try {
                      const thread = await ensureDirectThread(user.id);
                      router.push(`/chats?id=${thread.id}`);
                      onClose();
                    } catch {
                      // ignore to keep dropdown responsive
                    }
                  }}
                >
                  <div className="w-14 h-14 rounded-full border border-gray-100 dark:border-white/10 shrink-0 bg-[#D1B891] text-white font-bold text-lg flex items-center justify-center relative overflow-hidden">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                    <span
                      className={`absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#1f2937] ${
                        user.online ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-[15px] font-bold text-gray-900 dark:text-white truncate tracking-tight">
                        {name}
                      </h4>
                      <span className="text-[12px] font-medium text-gray-400 dark:text-[#10b981]">
                        {time || (user.online ? 'Online' : '')}
                      </span>
                    </div>
                    <p className="text-[14px] text-gray-500 dark:text-gray-400 truncate leading-snug">{preview}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
