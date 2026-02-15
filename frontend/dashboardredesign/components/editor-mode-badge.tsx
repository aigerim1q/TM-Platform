'use client';

type EditorModeBadgeProps = {
  role: 'owner' | 'manager' | 'member';
};

export default function EditorModeBadge({ role }: EditorModeBadgeProps) {
  const isReadOnly = role === 'member';

  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-medium text-gray-600 opacity-70 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-300">
      {isReadOnly ? '👁 Просмотр' : '✏ Редактирование'}
    </span>
  );
}
