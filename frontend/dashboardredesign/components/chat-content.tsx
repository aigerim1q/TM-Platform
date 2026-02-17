'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Phone, Video, MoreVertical, Plus, Paperclip, ChevronLeft, X } from 'lucide-react';

import { getCurrentUserId } from '@/lib/api';
import {
  inviteThreadToCall,
  isOwnChatMessage,
  listThreadMessages,
  renameChatThread,
  sendThreadMessage,
  type ChatThread,
  type ChatMessage,
  uploadChatAttachment,
} from '@/lib/chats';
import { getFileUrl } from '@/lib/utils';

type PendingAttachment = {
  url: string;
  type: 'image' | 'video' | 'file';
  name: string;
};

interface ChatContentProps {
  threadId: string;
  chatName: string;
  isGroup?: boolean;
  initialCallRoomId?: string | null;
  online?: boolean;
  partnerAvatarUrl?: string | null;
  onBack?: () => void;
  onThreadRenamed?: (thread: ChatThread) => void;
  onMessageSent?: () => void;
  className?: string;
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function MessageAttachment({ message }: { message: ChatMessage }) {
  if (!message.attachment_url) return null;

  const url = getFileUrl(message.attachment_url) || message.attachment_url;
  const type = (message.attachment_type || '').toLowerCase();

  if (type === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
        <img src={url} alt={message.attachment_name || 'image'} className="max-h-56 rounded-xl object-cover" />
      </a>
    );
  }

  if (type === 'video') {
    return (
      <video className="mt-2 max-h-64 rounded-xl" controls src={url} preload="metadata" />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex rounded-lg bg-black/10 dark:bg-white/10 px-3 py-2 text-xs font-medium hover:opacity-80"
    >
      {message.attachment_name || 'Файл'}
    </a>
  );
}

export default function ChatContent({ threadId, chatName, isGroup, initialCallRoomId, online, partnerAvatarUrl, onBack, onThreadRenamed, onMessageSent, className = '' }: ChatContentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(chatName);
  const [renameLoading, setRenameLoading] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loadingCall, setLoadingCall] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentUserID = getCurrentUserId();

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  }, [messages]);

  useEffect(() => {
    setRenameValue(chatName);
  }, [chatName]);

  useEffect(() => {
    const room = (initialCallRoomId || '').trim();
    if (!room) return;
    setRoomId(room);
  }, [initialCallRoomId]);

  useEffect(() => {
    if (!menuOpen) return;

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
    };
  }, [menuOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const data = await listThreadMessages(threadId, 120);
      setMessages(Array.isArray(data) ? data : []);
      setError(null);
    } catch {
      setError('Не удалось загрузить сообщения');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    setMessages([]);
    setInput('');
    setPendingAttachment(null);

    const init = async () => {
      if (!mounted) return;
      await loadMessages(true);
    };

    init();

    const id = window.setInterval(() => {
      if (!mounted) return;
      loadMessages(false).catch(() => {
        // silent refresh
      });
    }, 1800);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [sortedMessages]);

  const handleAttachmentPick = async (file?: File) => {
    if (!file) return;

    setUploadingAttachment(true);
    try {
      const uploaded = await uploadChatAttachment(file);
      setPendingAttachment({
        url: uploaded.url,
        type: uploaded.type,
        name: file.name,
      });
      setError(null);
    } catch {
      setError('Не удалось загрузить файл');
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (sending) return;

    const text = input.trim();
    if (!text && !pendingAttachment) return;

    setSending(true);
    try {
      await sendThreadMessage(threadId, {
        text: text || null,
        attachment_url: pendingAttachment?.url || null,
        attachment_type: pendingAttachment?.type || null,
        attachment_name: pendingAttachment?.name || null,
      });

      setInput('');
      setPendingAttachment(null);
      setError(null);

      await loadMessages(false);
      onMessageSent?.();
    } catch {
      setError('Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  const startVideoCall = () => {
    setLoadingCall(true);
    const base = threadId.replace(/[^a-zA-Z0-9-]/g, '');
    const nextRoom = `tm-platform-${base}`;

    void (async () => {
      try {
        await inviteThreadToCall(threadId, nextRoom);
      } catch {
        // do not block call if notification send failed
      } finally {
        setRoomId(nextRoom);
        setLoadingCall(false);
        setMenuOpen(false);
      }
    })();
  };

  const submitRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = renameValue.trim();
    if (!title) {
      setError('Введите название чата');
      return;
    }

    setRenameLoading(true);
    try {
      const updated = await renameChatThread(threadId, title);
      onThreadRenamed?.(updated);
      setRenameOpen(false);
      setMenuOpen(false);
      setError(null);
    } catch {
      setError('Не удалось переименовать чат');
    } finally {
      setRenameLoading(false);
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full bg-white dark:bg-[#110027] relative overflow-hidden transition-colors ${className}`}>
      <div className="px-4 md:px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-white/80 dark:bg-[#110027]/80 backdrop-blur-md z-10 sticky top-0 transition-colors">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onBack}
            className="md:hidden p-1 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#D1B891] text-white font-bold flex items-center justify-center ring-2 ring-gray-50 shadow-sm overflow-hidden">
            {(() => {
              const avatarSrc = getFileUrl(partnerAvatarUrl);
              return avatarSrc ? (
                <img src={avatarSrc} alt={chatName} className="w-full h-full object-cover" />
              ) : (
                chatName.charAt(0).toUpperCase()
              );
            })()}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-[15px] md:text-[16px] tracking-tight transition-colors line-clamp-1">{chatName}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <p className="text-[11px] md:text-[12px] font-medium text-gray-500">{online ? 'онлайн' : 'не в сети'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6 text-gray-400 dark:text-gray-500 relative" ref={menuRef}>
          <button className="hover:text-amber-500 transition-colors" title="Аудио звонок (скоро)">
            <Phone size={20} />
          </button>
          <button
            className="hover:text-amber-500 transition-colors"
            title="Видеозвонок"
            onClick={startVideoCall}
            disabled={loadingCall}
          >
            <Video size={20} />
          </button>
          <button className="hover:text-amber-500 transition-colors" onClick={() => setMenuOpen((prev) => !prev)}>
            <MoreVertical size={20} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 min-w-48 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-[#1f1038]">
              <button
                onClick={startVideoCall}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
              >
                <Video size={16} />
                Видеозвонок
              </button>
              {isGroup && (
                <button
                  onClick={() => {
                    setRenameValue(chatName);
                    setRenameOpen(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  Переименовать чат
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8 space-y-5">
        {loading && (
          <p className="text-center text-sm text-gray-500">Загрузка сообщений...</p>
        )}

        {!loading && sortedMessages.length === 0 && (
          <p className="text-center text-sm text-gray-500">Начните диалог первым сообщением</p>
        )}

        {!loading && sortedMessages.map((message) => {
          const own = isOwnChatMessage(message) || (currentUserID && message.sender_id === currentUserID);

          return (
            <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col ${own ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[75%]`}>
                <div
                  className={`px-4 md:px-5 py-3 rounded-[20px] shadow-sm relative text-[14px] md:text-[15px] leading-relaxed ${
                    own
                      ? 'bg-amber-500 text-white rounded-tr-none'
                      : 'bg-[#F3F4F6] dark:bg-white/10 text-gray-800 dark:text-gray-200 rounded-tl-none'
                  }`}
                >
                  {message.text && <p>{message.text}</p>}
                  <MessageAttachment message={message} />
                </div>
                <span className="text-[11px] text-gray-400 mt-1.5 font-medium px-1">{formatMessageTime(message.created_at)}</span>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 md:p-6 bg-white dark:bg-[#110027] border-t border-gray-100 dark:border-white/5 transition-colors">
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300 px-3 py-2 text-xs">
            {error}
          </div>
        )}

        {pendingAttachment && (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-[#f8f9fa] dark:bg-white/10 px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
            <span className="truncate pr-3">
              {pendingAttachment.type === 'image' ? 'Фото: ' : pendingAttachment.type === 'video' ? 'Видео: ' : 'Файл: '}
              {pendingAttachment.name}
            </span>
            <button
              onClick={() => setPendingAttachment(null)}
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
              title="Удалить вложение"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="max-w-5xl mx-auto flex items-center gap-2 md:gap-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleAttachmentPick(e.target.files?.[0])}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAttachment || sending}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10 transition-all disabled:opacity-50"
            title="Прикрепить файл"
          >
            {uploadingAttachment ? <Plus size={20} className="animate-spin" /> : <Paperclip size={20} />}
          </button>

          <form onSubmit={handleSendMessage} className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Написать сообщение..."
              className="w-full bg-[#f8f9fa] dark:bg-white/5 border-0 py-3 px-4 md:px-6 rounded-full focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/10 focus:bg-white dark:focus:bg-white/10 transition-all text-[14px] md:text-[15px] text-gray-700 dark:text-white placeholder:text-gray-400"
            />
          </form>

          <button
            onClick={() => handleSendMessage()}
            disabled={sending || (!input.trim() && !pendingAttachment)}
            className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
              input.trim() || pendingAttachment
                ? 'bg-amber-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95'
                : 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600 pointer-events-none'
            }`}
          >
            <Send size={19} className={input.trim() || pendingAttachment ? 'translate-x-0.5' : ''} />
          </button>
        </div>
      </div>

      {renameOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 p-4">
          <div className="mx-auto mt-24 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#1f1038]">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">Переименовать чат</h4>
            <form onSubmit={submitRename} className="mt-4 space-y-3">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={120}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-amber-400 dark:border-white/10 dark:bg-white/10 dark:text-white"
                placeholder="Название чата"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={renameLoading}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {renameLoading ? 'Сохраняю...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {roomId && (
        <div className="fixed inset-0 z-50 bg-black/80 p-4 md:p-6">
          <button
            onClick={() => setRoomId(null)}
            className="absolute right-6 top-6 rounded-full bg-white p-2 text-black"
            title="Закрыть видеозвонок"
          >
            <X size={18} />
          </button>

          <iframe
            title="Jitsi video call"
            src={`https://meet.jit.si/${roomId}`}
            className="h-full w-full rounded-xl"
            allow="camera; microphone; fullscreen; display-capture"
          />
        </div>
      )}
    </div>
  );
}
