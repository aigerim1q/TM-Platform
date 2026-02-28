'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, Bell, Calendar, MessageSquare, UserPlus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { emitNotificationsUpdated } from '@/lib/notifications-events';

type NotificationKind = 'project_created' | 'task_delegated' | 'task_assigned' | 'project_member' | 'task_comment' | 'call_invite';

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  readAt?: string | null;
  createdAt: string;
};

type ToastItem = NotificationItem & {
  localId: string;
};

const POLL_MS = 3000;
const TOAST_LIFETIME_MS = 5500;
const MAX_TOASTS = 3;

function resolveNotificationLink(link: string) {
  const raw = String(link || '').trim();
  if (!raw) return '/dashboard';
  if (/^\/project\/[0-9a-f-]+$/i.test(raw)) {
    return raw.replace(/^\/project\//i, '/project-overview/');
  }
  return raw;
}

function kindIcon(kind: NotificationKind) {
  switch (kind) {
    case 'project_created':
      return <Calendar className="h-4 w-4 text-emerald-500" />;
    case 'task_delegated':
      return <ArrowRight className="h-4 w-4 text-amber-500" />;
    case 'task_assigned':
      return <UserPlus className="h-4 w-4 text-sky-500" />;
    case 'project_member':
      return <UserPlus className="h-4 w-4 text-violet-500" />;
    case 'call_invite':
      return <Bell className="h-4 w-4 text-rose-500" />;
    case 'task_comment':
    default:
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
  }
}

export default function LiveNotificationToaster() {
  const router = useRouter();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const knownNotificationIDsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const timeoutsRef = useRef<Record<string, number>>({});

  const dismissToast = useCallback((localId: string) => {
    setToasts((prev) => prev.filter((item) => item.localId !== localId));
    const timeoutID = timeoutsRef.current[localId];
    if (timeoutID) {
      window.clearTimeout(timeoutID);
      delete timeoutsRef.current[localId];
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      emitNotificationsUpdated();
    } catch {
      // ignore notification read errors
    }
  }, []);

  const pushToasts = useCallback((notifications: NotificationItem[]) => {
    if (notifications.length === 0) return;

    const nextToasts = notifications.map((item) => ({
      ...item,
      localId: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }));

    setToasts((prev) => {
      const merged = [...prev, ...nextToasts];
      return merged.slice(Math.max(merged.length - MAX_TOASTS, 0));
    });

    nextToasts.forEach((item) => {
      const timeoutID = window.setTimeout(() => {
        dismissToast(item.localId);
      }, TOAST_LIFETIME_MS);
      timeoutsRef.current[item.localId] = timeoutID;
    });
  }, [dismissToast]);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await api.get<NotificationItem[]>('/notifications', {
        params: {
          unreadOnly: false,
          limit: 40,
        },
      });
      const items = Array.isArray(data) ? data : [];

      if (!initializedRef.current) {
        items.forEach((item) => knownNotificationIDsRef.current.add(item.id));
        initializedRef.current = true;
        return;
      }

      const fresh = items
        .filter((item) => !knownNotificationIDsRef.current.has(item.id))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (fresh.length === 0) {
        return;
      }

      fresh.forEach((item) => knownNotificationIDsRef.current.add(item.id));
      pushToasts(fresh);
      emitNotificationsUpdated();
    } catch {
      // ignore temporary polling errors
    }
  }, [pushToasts]);

  useEffect(() => {
    if (pathname === '/notifications') {
      return;
    }

    void loadNotifications();
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void loadNotifications();
      }
    }, POLL_MS);

    const onFocus = () => {
      void loadNotifications();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadNotifications();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadNotifications, pathname]);

  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach((timeoutID) => window.clearTimeout(timeoutID));
      timeoutsRef.current = {};
    };
  }, []);

  if (pathname === '/notifications' || toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[95] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((item) => (
        <div
          key={item.localId}
          className="pointer-events-auto animate-in slide-in-from-right-8 fade-in duration-300 rounded-2xl border border-white/30 bg-white/80 p-3 shadow-xl backdrop-blur dark:border-white/10 dark:bg-gray-900/90"
        >
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              {kindIcon(item.kind)}
            </div>
            <button
              type="button"
              onClick={() => {
                void markRead(item.id);
                dismissToast(item.localId);
                router.push(resolveNotificationLink(item.link));
              }}
              className="min-w-0 flex-1 text-left"
            >
              <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">{item.body}</p>
            </button>
            <button
              type="button"
              onClick={() => dismissToast(item.localId)}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              aria-label="Закрыть уведомление"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
