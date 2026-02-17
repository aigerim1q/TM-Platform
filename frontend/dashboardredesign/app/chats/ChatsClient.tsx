'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import Header from '@/components/header';
import ChatsList from '@/components/chats-list';
import ChatContent from '@/components/chat-content';
import ChatDefaultView from '@/components/chat-default-view';
import { listChatThreads, type ChatThread } from '@/lib/chats';
import { getDisplayNameFromEmail } from '@/lib/utils';

export default function ChatsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialChatId = searchParams.get('id');
  const callRoomFromQuery = searchParams.get('callRoom');

  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialChatId || null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const loadThreads = async (showLoader = false) => {
    if (showLoader) {
      setLoadingThreads(true);
    }

    try {
      const data = await listChatThreads(80);
      setThreads(Array.isArray(data) ? data : []);
    } catch {
      if (showLoader) {
        setThreads([]);
      }
    } finally {
      if (showLoader) {
        setLoadingThreads(false);
      }
    }
  };

  useEffect(() => {
    loadThreads(true);

    const id = window.setInterval(() => {
      loadThreads(false).catch(() => {
        // silent refresh
      });
    }, 2000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setSelectedChatId(id);
    }
  }, [searchParams]);

  const selectedThread = useMemo(() => {
    if (!selectedChatId) return null;
    return threads.find((thread) => thread.id === selectedChatId) || null;
  }, [selectedChatId, threads]);

  const selectedName = useMemo(() => {
    if (selectedThread) {
      if (!selectedThread.is_group) {
        return selectedThread.partner_full_name || getDisplayNameFromEmail(selectedThread.partner_email || selectedThread.name);
      }
      return selectedThread.name;
    }

    return selectedChatId ? 'Чат' : '';
  }, [selectedThread, selectedChatId]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-background overflow-hidden">
      <Header />

      <div className="flex flex-1 pt-24 overflow-hidden">
        <main className="flex w-full h-full">
          <ChatsList
            threads={threads}
            loading={loadingThreads}
            selectedChatId={selectedChatId ?? undefined}
            onSelectChat={(id) => {
              setSelectedChatId(id);
              router.replace(`${pathname}?id=${id}`);
            }}
            className={`${selectedChatId ? 'hidden md:flex' : 'flex'} w-full md:w-80`}
          />

          <div className={`flex-1 bg-white dark:bg-[#110027] h-full relative ${selectedChatId ? 'flex' : 'hidden md:flex'}`}>
            {selectedChatId ? (
              <ChatContent
                threadId={selectedChatId}
                chatName={selectedName}
                isGroup={Boolean(selectedThread?.is_group)}
                initialCallRoomId={callRoomFromQuery}
                online={selectedThread?.online}
                partnerAvatarUrl={selectedThread?.partner_avatar_url}
                onBack={() => {
                  setSelectedChatId(null);
                  router.replace(pathname);
                }}
                onThreadRenamed={(updated) => {
                  setThreads((prev) => prev.map((thread) => (thread.id === updated.id ? updated : thread)));
                }}
                onMessageSent={() => {
                  loadThreads(false).catch(() => {
                    // silent
                  });
                }}
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
