'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';
import AIChatContent from '@/components/ai-chat-content';

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Загрузка...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const showContextSidebar = mode !== 'ordinary';

  return (
    <div className="flex h-screen bg-white dark:bg-background">
      {/* AI Context Sidebar */}
      {showContextSidebar && (
        <div className="hidden md:block h-full">
          <Sidebar />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative pt-24">
        {/* Header */}
        <Header />

        {/* Chat Layout (No ChatsList) */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 bg-white dark:bg-background h-full relative">
            <Suspense fallback={<div className="p-6 text-sm text-gray-500">Загрузка...</div>}>
              <AIChatContent />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
