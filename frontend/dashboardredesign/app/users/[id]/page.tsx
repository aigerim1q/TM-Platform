"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Camera } from "lucide-react";

import Header from "@/components/header";
import { clearTokens, getApiErrorMessage, getApiStatus, getCurrentUserId } from "@/lib/api";
import {
  getUserProfile,
  uploadProfileImage,
  updateUserProfile,
  type UserPublic,
} from "@/lib/users";
import { getDisplayNameFromEmail, getFileUrl } from "@/lib/utils";

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const userId = Array.isArray(rawId) ? rawId[0] || "" : rawId || "";
  const [currentUserId, setCurrentUserId] = useState("");
  const isSelf = useMemo(() => Boolean(currentUserId) && currentUserId === userId, [currentUserId, userId]);

  const [user, setUser] = useState<UserPublic | null>(null);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [email, setEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
  }, []);

  useEffect(() => {
    if (!userId || userId === "undefined" || userId === "null") {
      setLoading(false);
      setError("Некорректный идентификатор пользователя");
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setForbidden(false);
    setSaveError(null);
    setSaveMessage(null);

    getUserProfile(userId)
      .then((data) => {
        if (!isMounted) return;
        setUser(data);
        setFullName(data.full_name || "");
        setAvatarUrl(data.avatar_url || "");
        setEmail(data.email || "");
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

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSelf || !user) return;

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const updatedProfile = await updateUserProfile(user.id, {
        email: email.trim(),
        full_name: fullName.trim() ? fullName.trim() : null,
        avatar_url: avatarUrl.trim() ? avatarUrl.trim() : null,
      });

      setUser(updatedProfile);
      setSaveMessage("Профиль обновлён");
      window.dispatchEvent(new Event("tm-profile-updated"));
    } catch (err) {
      setSaveError(getApiErrorMessage(err, "Не удалось сохранить профиль"));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const uploaded = await uploadProfileImage(file);
      setAvatarUrl(uploaded.url);
      setSaveMessage("Фото загружено. Нажмите «Сохранить».");
    } catch (err) {
      setSaveError(getApiErrorMessage(err, "Не удалось загрузить фото"));
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  };

  const displayName = fullName || getDisplayNameFromEmail(email || user?.email);
  const resolvedAvatar = getFileUrl(avatarUrl) || avatarUrl;

  const handleLogout = () => {
    clearTokens();
    router.replace('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="pt-28 px-4">
        <div className="mx-auto max-w-md">
          {loading && <p className="text-center text-sm text-gray-500">Загрузка...</p>}

          {forbidden && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              Доступ запрещён.
            </div>
          )}

          {error && !forbidden && <p className="text-center text-sm text-red-600">{error}</p>}

          {!loading && !error && !forbidden && user && (
            <form onSubmit={handleSave} className="space-y-8">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="group relative">
                  <div className="h-28 w-28 overflow-hidden rounded-full bg-[#D1B891] ring-4 ring-white/20 dark:ring-white/10">
                    {avatarUrl ? (
                      <img src={resolvedAvatar} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                        {(displayName.charAt(0) || "?").toUpperCase()}
                      </div>
                    )}
                  </div>

                  {isSelf && (
                    <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/0 transition-colors hover:bg-black/40">
                      <Camera size={24} className="text-white opacity-0 transition-opacity group-hover:opacity-100" />
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleAvatarFileChange}
                        disabled={avatarUploading}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                {avatarUploading && <p className="text-xs text-gray-400">Загрузка фото...</p>}
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Имя</span>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ваше имя"
                    disabled={!isSelf}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-amber-400 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={!isSelf}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-amber-400 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>
              </div>

              {/* Save */}
              {isSelf && (
                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Сохранение..." : "Сохранить"}
                  </button>

                  {saveMessage && (
                    <p className="text-center text-sm text-emerald-500">{saveMessage}</p>
                  )}
                  {saveError && (
                    <p className="text-center text-sm text-red-500">{saveError}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-xl border border-red-400/40 bg-red-500/10 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    Выйти
                  </button>
                </div>
              )}

              {!isSelf && (
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  Редактирование доступно только владельцу профиля
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
