'use client';

import React from 'react';
import { CheckSquare, Layout } from 'lucide-react';
import EditorMediaDropzone from '@/components/editor-media-dropzone';
import { getFileUrl } from '@/lib/utils';
import type { EditorBlock } from './taskBlockMeta';

type BlockRendererProps = {
  block: EditorBlock;
  readOnly?: boolean;
  registerRef?: (id: string, el: HTMLElement | null) => void;
  onTextChange?: (blockId: string, value: string, inputElement: HTMLInputElement) => void;
  onTextKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>, blockId: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>, blockId: string) => void;
  onFocus?: (blockId: string) => void;
  onToggleSubtask?: (blockId: string) => void;
  onOpenPage?: (blockId: string) => void;
  onMediaUploaded?: (
    blockId: string,
    media: { fileUrl: string; fileName: string; fileType: string; fileSize: number },
  ) => void;
  onRemoveFile?: (blockId: string) => void;
  placeholder?: string;
};

function ReadOnlyMedia({ block }: { block: EditorBlock }) {
  const fileUrl = getFileUrl(block.fileUrl || block.content) || block.fileUrl || block.content;

  if (!fileUrl) {
    return null;
  }

  if (block.type === 'image') {
    return <img src={fileUrl} alt={block.fileName || 'Image'} className="max-w-full rounded-xl border border-gray-200 dark:border-gray-700" />;
  }

  if (block.type === 'video') {
    return (
      <video controls className="max-w-full rounded-xl border border-gray-200 dark:border-gray-700">
        <source src={fileUrl} />
      </video>
    );
  }

  return (
    <a href={fileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
      {block.fileName || 'Открыть файл'}
    </a>
  );
}

export default function BlockRenderer({
  block,
  readOnly = false,
  registerRef,
  onTextChange,
  onTextKeyDown,
  onKeyDown,
  onFocus,
  onToggleSubtask,
  onOpenPage,
  onMediaUploaded,
  onRemoveFile,
  placeholder = 'Напишите текст или нажмите / для команд...',
}: BlockRendererProps) {
  if (block.type === 'text') {
    if (readOnly) {
      return <p className="whitespace-pre-wrap py-1 text-base text-gray-900 dark:text-white">{block.content}</p>;
    }

    return (
      <input
        ref={(el) => registerRef?.(block.id, el)}
        value={block.content}
        onChange={(e) => onTextChange?.(block.id, e.target.value, e.currentTarget)}
        onKeyDown={(e) => onTextKeyDown?.(e, block.id)}
        onFocus={() => onFocus?.(block.id)}
        placeholder={placeholder}
        className="w-full py-1 bg-transparent border-none outline-none focus:ring-0 text-base text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
      />
    );
  }

  if (block.type === 'subtask') {
    if (readOnly) {
      return (
        <div className="flex items-center gap-2 py-1">
          <div className={`shrink-0 w-4 h-4 border rounded ${block.isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
            {block.isCompleted && <CheckSquare size={12} />}
          </div>
          <p className={`text-base ${block.isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
            {block.content}
          </p>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggleSubtask?.(block.id)}
          className={`shrink-0 w-4 h-4 border rounded ${block.isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
        >
          {block.isCompleted && <CheckSquare size={12} />}
        </button>
        <input
          ref={(el) => registerRef?.(block.id, el)}
          value={block.content}
          onChange={(e) => onTextChange?.(block.id, e.target.value, e.currentTarget)}
          onKeyDown={(e) => onKeyDown?.(e, block.id)}
          onFocus={() => onFocus?.(block.id)}
          className={`w-full py-1 bg-transparent border-none outline-none focus:ring-0 text-base ${block.isCompleted ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}
        />
      </div>
    );
  }

  if (block.type === 'page') {
    if (readOnly) {
      return (
        <div className="flex items-center gap-2 py-1">
          <Layout size={18} className="text-gray-500 dark:text-gray-400" />
          <span className="text-base text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600">
            {block.content || 'Новая страница'}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 rounded -ml-1 border-b border-transparent hover:border-gray-200 dark:hover:border-gray-700">
        <Layout size={18} className="text-gray-500 dark:text-gray-400" />
        <input
          ref={(el) => registerRef?.(block.id, el)}
          value={block.content}
          onChange={(e) => onTextChange?.(block.id, e.target.value, e.currentTarget)}
          onKeyDown={(e) => onKeyDown?.(e, block.id)}
          onFocus={() => onFocus?.(block.id)}
          placeholder="Новая страница"
          className="w-full py-1 bg-transparent border-none outline-none focus:ring-0 text-base text-gray-700 dark:text-gray-300"
          onDoubleClick={() => onOpenPage?.(block.id)}
        />
      </div>
    );
  }

  if (readOnly) {
    return <ReadOnlyMedia block={block} />;
  }

  return (
    <EditorMediaDropzone
      blockId={block.id}
      blockType={block.type}
      fileUrl={block.fileUrl}
      fileName={block.fileName}
      onUploaded={onMediaUploaded || (() => undefined)}
      onRemove={onRemoveFile || (() => undefined)}
    />
  );
}
