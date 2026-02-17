'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, X, Search, ArrowRight } from 'lucide-react';
import Header from '@/components/header';
import ChatDefaultView from '@/components/chat-default-view';
import { createGroupThread, listChatUsers, type ChatUser } from '@/lib/chats';
import { getDisplayNameFromEmail, getFileUrl } from '@/lib/utils';

function buildStatus(user: ChatUser) {
  if (user.online) {
    return 'online';
  }
  return 'не в сети';
}

export default function NewChatPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('Новая группа');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadContacts = async () => {
      setLoading(true);
      try {
        const users = await listChatUsers(200);
        if (!mounted) return;
        setContacts(Array.isArray(users) ? users : []);
      } catch {
        if (!mounted) return;
        setContacts([]);
        setError('Не удалось загрузить контакты');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadContacts();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const getName = (u: ChatUser) => u.full_name || getDisplayNameFromEmail(u.email);
    const base = [...contacts].sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return getName(a).localeCompare(getName(b), 'ru');
    });

    if (!q) return base;
    return base.filter((user) => getName(user).toLowerCase().includes(q));
  }, [contacts, searchQuery]);

  const selectedMembers = useMemo(
    () => contacts.filter((user) => selectedMemberIds.includes(user.id)),
    [contacts, selectedMemberIds],
  );

  const toggleMember = (user: ChatUser) => {
    setSelectedMemberIds((prev) => {
      const exists = prev.includes(user.id);
      if (exists) {
        return prev.filter((id) => id !== user.id);
      } else {
        return [...prev, user.id];
      }
    });
  };

  const handleCreate = async () => {
    const title = groupName.trim();
    if (title.length === 0) {
      setError('Введите название группы');
      return;
    }
    if (selectedMemberIds.length < 2) {
      setError('Выберите минимум 2 участников');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const thread = await createGroupThread(title, selectedMemberIds);
      router.replace(`/chats?id=${thread.id}`);
    } catch {
      setError('Не удалось создать групповой чат');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-background overflow-hidden">
      <Header />

      <div className="flex flex-1 pt-24 overflow-hidden">
        {/* Left Sidebar: New Group Selection */}
        <aside className="w-80 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-background flex flex-col h-full relative">
          <div className="p-6 pb-2">
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => router.back()}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <ArrowLeft size={20} strokeWidth={2.5} />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">Новая группа</h2>
                <p className="text-[14px] text-gray-400 dark:text-gray-500 font-medium">Добавить участников</p>
              </div>
            </div>

            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Название группы"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full pl-4 pr-4 py-3.5 rounded-2xl bg-[#f8f9fa] dark:bg-gray-800 border-0 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/20 placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-medium"
              />
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Добавить участников..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#f8f9fa] dark:bg-gray-800 border-0 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/20 placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-medium"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Selected Members Rows */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-4 mb-6 px-1">
                {selectedMembers.map((member) => {
                  const memberName = member.full_name || getDisplayNameFromEmail(member.email);
                  const memberAvatar = getFileUrl(member.avatar_url);
                  return (
                  <div key={member.id} className="relative group animate-in zoom-in duration-200">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-[#D1B891] text-white font-bold flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                        {memberAvatar ? (
                          <img src={memberAvatar} alt={memberName} className="w-full h-full object-cover" />
                        ) : (
                          memberName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <button
                        onClick={() => toggleMember(member)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    </div>
                    <span className="text-[12px] text-gray-900 dark:text-gray-100 font-semibold mt-1.5 block text-center truncate w-12">
                      {memberName.split(' ')[0]}
                    </span>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-20">
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-3 mb-4">ВАШИ КОНТАКТЫ</h3>
            <div className="space-y-1">
              {!loading && filteredContacts.map((contact) => {
                const contactName = contact.full_name || getDisplayNameFromEmail(contact.email);
                const contactAvatar = getFileUrl(contact.avatar_url);
                return (
                <button
                  key={contact.id}
                  onClick={() => toggleMember(contact)}
                  className="w-full flex items-center gap-4 p-3.5 rounded-[12px] transition-all mb-1 group hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[#D1B891] text-white font-bold flex items-center justify-center overflow-hidden">
                      {contactAvatar ? (
                        <img src={contactAvatar} alt={contactName} className="w-full h-full object-cover" />
                      ) : (
                        contactName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white rounded-full ${contact.online ? 'bg-green-500' : 'bg-gray-400'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-white text-[14px] truncate tracking-tight">{contactName}</h4>
                    <p className={`text-[12px] truncate ${contact.online ? 'text-blue-500 dark:text-blue-400 font-bold' : 'text-gray-400 dark:text-gray-500 font-medium'}`}>
                      {buildStatus(contact)}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(contact.id)}
                    onChange={() => { }} // Controlled by button click
                    className="w-5 h-5 rounded-[6px] border-gray-300 dark:border-gray-600 accent-amber-500 cursor-pointer bg-white dark:bg-gray-700"
                  />
                </button>
              );
              })}

              {loading && (
                <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">Загрузка контактов...</div>
              )}

              {!loading && filteredContacts.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">Пользователи не найдены</div>
              )}
            </div>
          </div>

          {/* Floating Action Button */}
          {selectedMembers.length > 0 && (
            <div className="absolute bottom-10 right-8 animate-in slide-in-from-bottom-5 duration-300">
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="w-14 h-14 bg-[#D1B891] hover:bg-[#C1A881] disabled:opacity-60 text-white rounded-full flex items-center justify-center shadow-[0_8px_25px_rgba(209,184,145,0.4)] dark:shadow-[0_8px_25px_rgba(209,184,145,0.2)] transition-all transform hover:scale-110 active:scale-95"
              >
                <ArrowRight size={28} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </aside>

        {/* Right Content: Default View */}
        <main className="flex-1 h-full bg-white dark:bg-background relative">
          <ChatDefaultView />
        </main>
      </div>
    </div>
  );
}
