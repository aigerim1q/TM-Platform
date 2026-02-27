'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bell, Calendar, MessageSquare, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getApiErrorMessage } from '@/lib/api';
import { getDisplayNameFromEmail } from '@/lib/utils';
import { emitNotificationsUpdated, NOTIFICATIONS_UPDATED_EVENT } from '@/lib/notifications-events';

type NotificationKind = 'project_created' | 'task_delegated' | 'task_assigned' | 'project_member' | 'task_comment' | 'call_invite';

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  actorEmail?: string;
  readAt?: string | null;
  createdAt: string;
};

function resolveNotificationLink(link: string) {
  const raw = String(link || '').trim();
  if (!raw) return '/dashboard';
  if (/^\/project\/[0-9a-f-]+$/i.test(raw)) {
    return raw.replace(/^\/project\//i, '/project-overview/');
  }
  return raw;
}

function formatRelativeTime(value: string) {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return 'только что';

  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн назад`;
  return new Date(value).toLocaleDateString('ru-RU');
}

function kindIcon(kind: NotificationKind) {
  switch (kind) {
    case 'project_created':
      return <Calendar className="h-5 w-5 text-emerald-600" />;
    case 'task_delegated':
      return <ArrowRight className="h-5 w-5 text-amber-600" />;
    case 'task_assigned':
      return <UserPlus className="h-5 w-5 text-sky-600" />;
    case 'project_member':
      return <UserPlus className="h-5 w-5 text-violet-600" />;
    case 'call_invite':
      return <Bell className="h-5 w-5 text-rose-600" />;
    case 'task_comment':
    default:
      return <MessageSquare className="h-5 w-5 text-blue-600" />;
  }
}

export default function NotificationsContentLive() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(() => items.filter((x) => !x.readAt).length, [items]);

  const loadItems = async (tab: 'all' | 'unread', silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const { data } = await api.get<NotificationItem[]>('/notifications', {
        params: {
          unreadOnly: tab === 'unread',
          limit: 100,
        },
      });
      setItems(Array.isArray(data) ? data : []);
      emitNotificationsUpdated();
    } catch (e) {
      if (!silent) {
        setError(getApiErrorMessage(e, 'Не удалось загрузить уведомления'));
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadItems(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const tick = () => {
      void loadItems(activeTab, true);
    };

    tick();
    const timer = window.setInterval(tick, 3000);
    const onFocus = () => tick();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    const onNotificationsUpdated = () => tick();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onNotificationsUpdated as EventListener);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onNotificationsUpdated as EventListener);
    };
  }, [activeTab]);

  const markOneRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)));
      emitNotificationsUpdated();
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      emitNotificationsUpdated();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Не удалось пометить уведомления как прочитанные'));
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 pb-20">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <Bell size={28} />
            <h1 className="text-3xl font-bold tracking-tight">Уведомления</h1>
          </div>
          <p className="mt-2 text-gray-500 dark:text-gray-400">События по проектам, делегированию и комментариям</p>
        </div>

        <button
          type="button"
          onClick={() => void markAllRead()}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Пометить все прочитанным
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3 border-b border-gray-200 pb-3 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${activeTab === 'all' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
        >
          Все
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('unread')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${activeTab === 'unread' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
        >
          Непрочитанные {unreadCount > 0 ? `(${unreadCount})` : ''}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          Загрузка уведомлений...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          Уведомлений пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isUnread = !item.readAt;
            return (
              <Link
                key={item.id}
                href={resolveNotificationLink(item.link)}
                onClick={() => {
                  if (isUnread) {
                    void markOneRead(item.id);
                  }
                }}
                className={`group flex items-start gap-4 rounded-2xl border p-4 transition-colors ${isUnread ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10 dark:hover:bg-amber-900/20' : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800'}`}
              >
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-gray-800">
                  {kindIcon(item.kind)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                    <span className="whitespace-nowrap text-xs text-gray-500">{formatRelativeTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.body}</p>
                  {item.actorEmail && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      От: {getDisplayNameFromEmail(item.actorEmail)}
                    </p>
                  )}
                  {item.kind === 'call_invite' && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isUnread) {
                            void markOneRead(item.id);
                          }
                          router.push(resolveNotificationLink(item.link));
                        }}
                        className="inline-flex items-center rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        Подключиться
                      </button>
                    </div>
                  )}
                </div>

                {isUnread && <span className="mt-2 h-2.5 w-2.5 rounded-full bg-red-500" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
