'use client';

import { useParams } from 'next/navigation';
import TaskEditor from '@/components/editor/TaskEditor';

export default function TaskEditPage() {
  const params = useParams();
  const taskId = String(params.id || '');

  if (!taskId) {
    return null;
  }

  return <TaskEditor taskId={taskId} />;
}
