"use client";

import { Moon, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ThemeAnimationType, useModeAnimation } from 'react-theme-switch-animation';
import { useTheme } from 'next-themes';

type ThemeToggleAnimatedProps = {
  className?: string;
};

export default function ThemeToggleAnimated({ className }: ThemeToggleAnimatedProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkFromTheme = useMemo(() => resolvedTheme === 'dark', [resolvedTheme]);

  const { ref, toggleSwitchTheme, isDarkMode } = useModeAnimation({
    animationType: ThemeAnimationType.CIRCLE,
    duration: 420,
    easing: 'ease-in-out',
    globalClassName: 'dark',
    isDarkMode: isDarkFromTheme,
    onDarkModeChange: (isDark) => {
      setTheme(isDark ? 'dark' : 'light');
    },
  });

  const darkMode = mounted ? isDarkMode : isDarkFromTheme;

  return (
    <button
      ref={ref}
      onClick={toggleSwitchTheme}
      className={className}
      aria-label="Toggle theme"
      type="button"
    >
      {darkMode ? <Sun size={22} /> : <Moon size={22} />}
    </button>
  );
}
