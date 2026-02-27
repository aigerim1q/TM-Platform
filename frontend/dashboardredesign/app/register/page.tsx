"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register as registerUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [agree, setAgree] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(() => {
    if (!firstName.trim()) return false;
    if (!lastName.trim()) return false;
    if (!email.trim()) return false;
    if (!password.trim() || password.length < 8) return false;
    if (password !== password2) return false;
    if (!agree) return false;
    return true;
  }, [firstName, lastName, email, password, password2, agree]);

  const toggleTheme = () => {
    if (!mounted) return;
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }

    try {
      setLoading(true);

      await registerUser({
        email: email.trim(),
        password,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      });

      router.push("/login");
    } catch (err: any) {
      setError(err?.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-[#faf7f2] to-[#f3e8dd] text-black dark:from-[#0b0b0d] dark:via-[#0f1117] dark:to-[#0b0b0d] dark:text-white">
      <div className="mx-auto flex min-h-screen max-w-[880px] flex-col items-center justify-center px-6 py-10">
        <div className="flex w-full justify-end">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-800 dark:text-amber-200"
            aria-label="Переключить тему"
          >
            {mounted && resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="w-full max-w-[560px] rounded-2xl border border-white/20 bg-white/80 p-8 shadow-[0px_4px_90px_0px_rgba(240,230,218,1)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
          <div className="text-center">
            <div className="text-sm text-[#58616F]">
              Уже есть аккаунт?{" "}
              <Link href="/login" className="font-medium text-[#BC915A] hover:underline">
                Войти
              </Link>
            </div>

            <h1 className="mt-3 text-3xl font-bold">Создать аккаунт</h1>
            <p className="mt-2 text-[#5B6D91]">Начните управлять проектами эффективно</p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[14.5px] font-medium text-[#4C5464]">Имя</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={cn("h-[45px] rounded-[10px] border-[#E6EDF8] bg-[#F5F7FF]")}
                  placeholder="AIGANYM"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[14.5px] font-medium text-[#4C5464]">Фамилия</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={cn("h-[45px] rounded-[10px] border-[#E6EDF8] bg-[#F5F7FF]")}
                  placeholder="TULEBAYEVA"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[14.5px] font-medium text-[#4C5464]">Электронная почта</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn("h-[45px] rounded-[10px] border-[#E6EDF8] bg-[#F5F7FF]")}
                placeholder="you@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[14.5px] font-medium text-[#4C5464]">Пароль</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className={cn("h-[45px] rounded-[10px] border-[#FFF2E6] bg-[rgba(255,252,249,0.6)]")}
                placeholder="Минимум 8 символов"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[14.5px] font-medium text-[#4C5464]">Подтвердите пароль</Label>
              <Input
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                type="password"
                className={cn("h-[45px] rounded-[10px] border-[#FFF2E6] bg-[rgba(255,252,249,0.6)]")}
                placeholder="Повторите пароль"
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-[#58616F]">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                Я соглашаюсь с Условиями использования и Политикой конфиденциальности.
              </span>
            </label>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!isValid || loading}
              className="h-[49px] w-full rounded-[11px] bg-[#C19A6B] text-white hover:bg-[#C19A6B]/90 disabled:opacity-60"
            >
              {loading ? "Регистрируем..." : "Зарегистрироваться"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
