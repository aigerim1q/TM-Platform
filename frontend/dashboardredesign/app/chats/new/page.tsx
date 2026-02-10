'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, X, Search, ChevronRight, ArrowRight } from 'lucide-react';
import Header from '@/components/header';
import ChatDefaultView from '@/components/chat-default-view';

interface Member {
  id: number;
  name: string;
  avatar: string;
  status: string;
  online?: boolean;
}

const contacts: Member[] = [
  {
    id: 1,
    name: 'Мария (HR)',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    status: 'online',
    online: true,
  },
  {
    id: 2,
    name: 'Ляззат Нуркеева',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    status: 'был(-а) недавно',
  },
  {
    id: 3,
    name: 'Ербол (Прораб)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    status: 'был(-а) недавно',
    online: true,
  },
  {
    id: 4,
    name: 'Марат Алиев (IT отдел)',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    status: 'был(-а) недавно',
  },
  {
    id: 5,
    name: 'Тимур Азимов',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    status: 'был(-а) сегодня в 09:31',
  },
  {
    id: 6,
    name: 'Динара Байжан (HR)',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop',
    status: 'был(-а) вчера в 11:45',
  },
  {
    id: 7,
    name: 'Аскар Утегенов (юр. отдел)',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop',
    status: 'был(-а) сегодня в 19:30',
  },
];

export default function NewChatPage() {
  const router = useRouter();
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleMember = (member: Member) => {
    setSelectedMembers((prev) => {
      const exists = prev.find((m) => m.id === member.id);
      if (exists) {
        return prev.filter((m) => m.id !== member.id);
      } else {
        return [...prev, member];
      }
    });
  };

  const handleCreate = () => {
    if (selectedMembers.length > 0) {
      // Simulate adding a new group at the top
      const newGroup = {
        id: Date.now(),
        name: 'Новая группа',
        lastMessage: 'Вы создали группу',
        time: 'только что',
        avatar: '/placeholder-group.svg',
        isProject: false,
        online: true,
      };

      const existing = JSON.parse(localStorage.getItem('custom_chats') || '[]');
      localStorage.setItem('custom_chats', JSON.stringify([newGroup, ...existing]));

      router.push(`/chats?id=${newGroup.id}`);
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

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Добавить участников..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 rounded-[16px] bg-[#f8f9fa] dark:bg-gray-800 border-0 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/20 placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-medium"
              />
            </div>

            {/* Selected Members Rows */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-4 mb-6 px-1">
                {selectedMembers.map((member) => (
                  <div key={member.id} className="relative group animate-in zoom-in duration-200">
                    <div className="relative">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                      <button
                        onClick={() => toggleMember(member)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    </div>
                    <span className="text-[12px] text-gray-900 dark:text-gray-100 font-semibold mt-1.5 block text-center truncate w-12">
                      {member.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-20">
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-3 mb-4">ВАШИ КОНТАКТЫ</h3>
            <div className="space-y-1">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => toggleMember(contact)}
                  className="w-full flex items-center gap-4 p-3.5 rounded-[12px] transition-all mb-1 group hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                >
                  <div className="relative shrink-0">
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    {contact.online && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-white text-[14px] truncate tracking-tight">{contact.name}</h4>
                    <p className={`text-[12px] truncate ${contact.status === 'online' ? 'text-blue-500 dark:text-blue-400 font-bold' : 'text-gray-400 dark:text-gray-500 font-medium'}`}>
                      {contact.status}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedMembers.some((m) => m.id === contact.id)}
                    onChange={() => { }} // Controlled by button click
                    className="w-5 h-5 rounded-[6px] border-gray-300 dark:border-gray-600 accent-amber-500 cursor-pointer bg-white dark:bg-gray-700"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Floating Action Button */}
          {selectedMembers.length > 0 && (
            <div className="absolute bottom-10 right-8 animate-in slide-in-from-bottom-5 duration-300">
              <button
                onClick={handleCreate}
                className="w-14 h-14 bg-[#D1B891] hover:bg-[#C1A881] text-white rounded-full flex items-center justify-center shadow-[0_8px_25px_rgba(209,184,145,0.4)] dark:shadow-[0_8px_25px_rgba(209,184,145,0.2)] transition-all transform hover:scale-110 active:scale-95"
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
