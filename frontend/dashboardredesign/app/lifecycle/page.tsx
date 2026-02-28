'use client';

import { Suspense } from 'react';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';
import AIChatContent from '@/components/ai-chat-content';

export default function Lifecycle() {
  return (
    <div className="flex h-screen bg-white dark:bg-background">
      <div className="hidden md:block h-full">
        <Sidebar />
      </div>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative pt-24">
        <Header />
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
