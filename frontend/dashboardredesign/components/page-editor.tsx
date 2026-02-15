'use client';

import type { ReactNode } from 'react';

interface PageEditorProps {
  title: string;
  onTitleChange: (nextTitle: string) => void;
  onTitleEnter?: () => void;
  saveError?: string | null;
  readOnly?: boolean;
  children: ReactNode;
}

export default function PageEditor({ title, onTitleChange, onTitleEnter, saveError, readOnly = false, children }: PageEditorProps) {
  return (
    <>
      <textarea
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && onTitleEnter) {
            event.preventDefault();
            onTitleEnter();
          }
        }}
        readOnly={readOnly}
        placeholder="Новая страница"
        rows={1}
        className={`w-full text-5xl font-bold text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 border-none outline-none resize-none overflow-hidden bg-transparent mb-6 py-2 ${readOnly ? 'cursor-default' : ''}`}
        onInput={(event) => {
          const target = event.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = `${target.scrollHeight}px`;
        }}
      />

      {saveError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {children}
    </>
  );
}
