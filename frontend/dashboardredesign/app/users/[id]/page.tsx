"use client";

import { useEffect, useState } from "react";
import { getApiStatus } from "@/lib/api";

import Header from "@/components/header";
import { getUserManager, getUserProfile, getUserSubordinates, type UserPublic } from "@/lib/users";
import { getDisplayNameFromEmail } from "@/lib/utils";

export default function UserProfilePage({ params }: { params: { id: string } }) {
  const userId = params.id;
  const [user, setUser] = useState<UserPublic | null>(null);
  const [manager, setManager] = useState<UserPublic | null>(null);
  const [managerLoading, setManagerLoading] = useState(false);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [subordinates, setSubordinates] = useState<UserPublic[]>([]);
  const [subordinatesLoading, setSubordinatesLoading] = useState(false);
  const [subordinatesError, setSubordinatesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setForbidden(false);
    setManager(null);
    setManagerError(null);
    setSubordinates([]);
    setSubordinatesError(null);

    getUserProfile(userId)
      .then((data) => {
        if (!isMounted) return;
        setUser(data);

        setManagerLoading(true);
        setSubordinatesLoading(true);

        const managerPromise = getUserManager(userId)
          .then((managerData) => {
            if (!isMounted) return;
            setManager(managerData);
          })
          .catch((managerErr) => {
            if (!isMounted) return;
            const status = getApiStatus(managerErr);
            if (status === 403) {
              setForbidden(true);
              return;
            }
            if (status && status >= 400) {
              setManagerError("Ошибка загрузки руководителя");
            }
          })
          .finally(() => {
            if (!isMounted) return;
            setManagerLoading(false);
          });

        const subordinatesPromise = getUserSubordinates(userId)
          .then((items) => {
            if (!isMounted) return;
            setSubordinates(items);
          })
          .catch((subErr) => {
            if (!isMounted) return;
            const status = getApiStatus(subErr);
            if (status === 403) {
              setForbidden(true);
              return;
            }
            if (status && status >= 400) {
              setSubordinatesError("Ошибка загрузки подчинённых");
            }
          })
          .finally(() => {
            if (!isMounted) return;
            setSubordinatesLoading(false);
          });

        return Promise.all([managerPromise, subordinatesPromise]);
      })
      .catch((err) => {
        if (!isMounted) return;
        const status = getApiStatus(err);
        if (status === 403) {
          setForbidden(true);
          return;
        }
        if (status === 404) {
          setError("Пользователь не найден");
          return;
        }
        setError("Ошибка загрузки профиля");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="pt-24 px-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/20 bg-white/80 p-6 shadow-[0px_4px_90px_0px_rgba(240,230,218,1)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
          <h1 className="text-2xl font-semibold">Профиль пользователя</h1>

          {loading && <p className="mt-4 text-sm text-gray-500">Загрузка...</p>}

          {forbidden && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Доступ запрещён. У вас нет прав для просмотра этого профиля.
            </div>
          )}

          {error && !forbidden && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}

          {!loading && !error && !forbidden && user && (
            <div className="mt-6 space-y-3 text-sm text-gray-700 dark:text-gray-200">
              <div>
                <span className="font-medium">ID:</span> {user.id}
              </div>
              <div>
                <span className="font-medium">Имя:</span> {getDisplayNameFromEmail(user.email)}
              </div>
              <div>
                <span className="font-medium">Role:</span> {user.role || "—"}
              </div>
              <div>
                <span className="font-medium">Manager ID:</span> {user.manager_id || "—"}
              </div>
              <div>
                <span className="font-medium">Created:</span> {new Date(user.created_at).toLocaleString()}
              </div>
              <div className="pt-3">
                <span className="font-medium">Руководитель:</span>{" "}
                {managerLoading && <span className="text-gray-500">Загрузка...</span>}
                {!managerLoading && managerError && (
                  <span className="text-red-600">{managerError}</span>
                )}
                {!managerLoading && !managerError && !manager && (
                  <span className="text-gray-500">Нет руководителя</span>
                )}
                {!managerLoading && !managerError && manager && (
                  <span>
                    {getDisplayNameFromEmail(manager.email)} ({manager.role || "—"})
                  </span>
                )}
              </div>
              <div className="pt-3">
                <span className="font-medium">Подчинённые:</span>
                {subordinatesLoading && (
                  <span className="ml-2 text-gray-500">Загрузка...</span>
                )}
                {!subordinatesLoading && subordinatesError && (
                  <span className="ml-2 text-red-600">{subordinatesError}</span>
                )}
                {!subordinatesLoading && !subordinatesError && subordinates.length === 0 && (
                  <span className="ml-2 text-gray-500">Нет подчинённых</span>
                )}
                {!subordinatesLoading && !subordinatesError && subordinates.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {subordinates.map((item) => (
                      <li key={item.id} className="flex items-center justify-between rounded-lg border border-white/20 bg-white/60 px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-white/10 dark:bg-slate-900/50 dark:text-gray-200">
                        <span>{getDisplayNameFromEmail(item.email)}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.role || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
