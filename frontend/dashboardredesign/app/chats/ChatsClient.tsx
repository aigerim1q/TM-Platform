'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import ChatsList, { chatsData } from '@/components/chats-list';
import ChatContent from '@/components/chat-content';
import ChatDefaultView from '@/components/chat-default-view';

export default function ChatsClient() {
  const searchParams = useSearchParams();
  const initialChatId = searchParams.get('id');
  const [selectedChatId, setSelectedChatId] = useState<number | null>(
    initialChatId ? parseInt(initialChatId) : null
  );

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setSelectedChatId(parseInt(id));
    }
  }, [searchParams]);

  const selectedChat = chatsData.find((chat) => chat.id === selectedChatId);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-background overflow-hidden">
      <Header />

      <div className="flex flex-1 pt-24 overflow-hidden">
        <main className="flex w-full h-full">
          <ChatsList
            selectedChatId={selectedChatId ?? undefined}
            onSelectChat={(id) => setSelectedChatId(id)}
            className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80`}
          />

          <div className={`flex-1 bg-white dark:bg-[#110027] h-full relative ${selectedChatId ? 'flex' : 'hidden md:flex'}`}>
            {selectedChat ? (
              <ChatContent
                chatId={selectedChat.id}
                chatName={selectedChat.name}
                chatAvatar={selectedChat.avatar}
                onBack={() => setSelectedChatId(null)}
              />
            ) : (
              <ChatDefaultView />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
