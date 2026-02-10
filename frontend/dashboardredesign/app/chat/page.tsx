'use client';

import { Suspense } from 'react';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';
import AIChatContent from '@/components/ai-chat-content';

export default function ChatPage() {
  const selectedChat = {
    id: 0,
    name: 'AI-Ассистент The Qurylys',
    avatar: 'https://images.unsplash.com/photo-1675271591211-126ad94e495d?w=100&h=100&fit=crop',
  };

  return (
    <div className="flex h-screen bg-white dark:bg-background">
      {/* AI Context Sidebar */}
      <div className="hidden md:block h-full">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative pt-24">
        {/* Header */}
        <Header />

        {/* Chat Layout (No ChatsList) */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 bg-white dark:bg-background h-full relative">
            <Suspense fallback={<div className="p-6 text-sm text-gray-500">Загрузка...</div>}>
              <AIChatContent
                chatId={selectedChat.id}
                chatName={selectedChat.name}
                chatAvatar={selectedChat.avatar}
              />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
