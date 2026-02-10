'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const chats = [
  {
    id: 1,
    name: 'Проект Shyraq',
    lastMessage: 'Алексей: Плитка доставлена на об...',
    time: '12:30',
    avatar: '/images/building-1.jpg',
    isProject: true,
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
  },
];

export default function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const router = useRouter();

  const handleCreateChat = () => {
    onClose();
    router.push('/chats/new');
  };

  const handleShowAllChats = () => {
    onClose();
    router.push('/chat');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Create Group Chat Button */}
          <div className="p-4">
            <button
              onClick={handleCreateChat}
              className="w-full flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-gray-900 font-medium py-4 px-6 rounded-full transition-colors border border-amber-100"
            >
              <Plus className="w-5 h-5" />
              Создать групповой чат
            </button>
          </div>

          {/* Chat List */}
          <div className="px-4 pb-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => {
                  onClose();
                  router.push(`/chats?selected=${chat.id}`);
                }}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors"
              >
                <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 ring-2 ring-amber-200">
                  <img
                    src={chat.avatar || "/placeholder.svg"}
                    alt={chat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{chat.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
                </div>
                <span className={`text-sm shrink-0 ${chat.time === '12:30' ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
                  {chat.time}
                </span>
              </button>
            ))}
          </div>

          {/* Show All Chats */}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={handleShowAllChats}
              className="w-full text-center text-blue-600 font-semibold text-sm hover:text-blue-700 transition-colors py-2"
            >
              ПОКАЗАТЬ ВСЕ ЧАТЫ
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
