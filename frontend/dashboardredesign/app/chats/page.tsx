import { Suspense } from 'react';
import ChatsClient from './ChatsClient';

export default function ChatsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Загрузка...</div>}>
      <ChatsClient />
    </Suspense>
  );
}
