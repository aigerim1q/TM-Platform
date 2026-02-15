'use client';

import { useCallback, useState } from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
import { FileText, Image as ImageIcon, Video, X } from 'lucide-react';
import { getFileUrl } from '@/lib/utils';

type MediaBlockType = 'image' | 'video' | 'file';

interface UploadResult {
  url?: string;
  fileName?: string;
}

interface EditorMediaDropzoneProps {
  blockId: string;
  blockType: MediaBlockType;
  fileUrl?: string;
  fileName?: string;
  onUploaded: (blockId: string, media: { fileUrl: string; fileName: string; fileType: string; fileSize: number }) => void;
  onRemove: (blockId: string) => void;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '');

const ACCEPT_BY_TYPE: Record<MediaBlockType, Accept> = {
  image: {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/webp': ['.webp'],
  },
  video: {
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov'],
  },
  file: {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
  },
};

export default function EditorMediaDropzone({
  blockId,
  blockType,
  fileUrl,
  fileName,
  onUploaded,
  onRemove,
}: EditorMediaDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const mediaSrc = getFileUrl(fileUrl) || fileUrl;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const picked = acceptedFiles[0];
      if (!picked) return;

      const formData = new FormData();
      formData.append('file', picked);
      formData.append('type', blockType);

      setUploading(true);
      try {
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`upload failed with status ${res.status}`);
        }

        const data = (await res.json()) as UploadResult;
        if (!data.url || !data.fileName) {
          throw new Error('invalid upload response');
        }

        onUploaded(blockId, {
          fileUrl: data.url,
          fileName: data.fileName,
          fileType: blockType,
          fileSize: picked.size,
        });
      } catch (error) {
        console.error('Failed to upload media block file', error);
      } finally {
        setUploading(false);
      }
    },
    [blockId, blockType, onUploaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxFiles: 1,
    accept: ACCEPT_BY_TYPE[blockType],
  });

  return (
    <div
      {...getRootProps({
        className: `bg-gray-50 dark:bg-gray-900 rounded-lg p-8 text-center border-2 border-dashed transition-colors cursor-pointer relative group/media ${
          isDragActive
            ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`,
      })}
    >
      <input {...getInputProps()} />

      {!fileUrl && !uploading && (
        <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
          {blockType === 'image' && <ImageIcon size={24} />}
          {blockType === 'video' && <Video size={24} />}
          {blockType === 'file' && <FileText size={24} />}
          <span className="text-sm font-medium">
            {isDragActive ? 'Drop file here...' : `Drag & drop or click to add ${blockType}`}
          </span>
        </div>
      )}

      {uploading && (
        <div className="flex flex-col items-center gap-2 text-amber-600 dark:text-amber-400">
          <span className="text-sm font-semibold">Uploading...</span>
        </div>
      )}

      {fileUrl && blockType === 'image' && (
        <img
          src={mediaSrc}
          alt={fileName || 'image'}
          className="max-h-80 mx-auto rounded-lg object-contain"
        />
      )}

      {fileUrl && blockType === 'video' && (
        <video
          src={mediaSrc}
          controls
          className="max-h-80 mx-auto rounded-lg"
        />
      )}

      {fileUrl && blockType === 'file' && (
        <div className="flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300">
          <FileText size={24} />
          <span className="text-sm font-medium">{fileName || 'File'}</span>
        </div>
      )}

      {fileUrl && !uploading && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(blockId);
          }}
          className="absolute top-2 right-2 p-1 bg-white dark:bg-gray-700 rounded-full shadow opacity-0 group-hover/media:opacity-100 hover:text-red-500"
        >
          <X size={14} className="dark:text-white" />
        </button>
      )}
    </div>
  );
}
