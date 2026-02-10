'use client';

import { MessageCircle, Moon, Bell } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import ChatsDropdown from './chats-dropdown';
import { useTheme } from 'next-themes';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [isChatsOpen, setIsChatsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLifecyclePage = pathname === '/lifecycle';
  const isDashboard = pathname === '/dashboard' || pathname === '/';
  const isHierarchy = pathname === '/hierarchy';

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    closeMobileMenu();
  };

  return (
    <>
      <div className="fixed top-6 left-0 right-0 z-50 flex justify-center pointer-events-none px-4">
        <header className="pointer-events-auto inline-flex items-center justify-between w-full max-w-5xl gap-4 rounded-full border border-white/30 bg-white/40 dark:bg-black/40 backdrop-blur-3xl px-6 py-3 shadow-[0_15px_40px_rgba(215,185,145,0.25)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.5)] ring-1 ring-black/5 dark:ring-white/10 transition-all hover:bg-white/50 dark:hover:bg-black/60 md:w-auto md:justify-start md:gap-8">
          {/* Logo */}
          <div className="flex items-center gap-1.5 grayscale-[0.2] hover:grayscale-0 transition-all cursor-pointer" onClick={() => router.push('/')}>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 font-bold text-white text-[10px] shadow-sm">
              THE-
            </div>
            <span className="text-base font-bold tracking-tight text-amber-500">QURYLYS</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => router.push('/calendar')}
              className={`text-base font-medium transition-all ${pathname === '/calendar' ? 'text-gray-900 dark:text-white relative after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:bg-gray-900 dark:after:bg-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Календарь
            </button>
            <button
              onClick={() => router.push('/hierarchy')}
              className={`text-base font-medium transition-all ${isHierarchy ? 'text-gray-900 dark:text-white relative after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:bg-gray-900 dark:after:bg-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Иерархия
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className={`text-base font-medium transition-all ${isDashboard ? 'text-gray-900 dark:text-white relative after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:bg-gray-900 dark:after:bg-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Дашборд
            </button>
            <button
              onClick={() => router.push('/lifecycle')}
              className={`text-base font-medium transition-all ${isLifecyclePage ? 'text-gray-900 dark:text-white relative after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:bg-gray-900 dark:after:bg-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              ЖЦП
            </button>
          </nav>

          {/* Right Icons (Desktop) */}
          <div className="hidden md:flex items-center gap-4 relative">
            <button
              onClick={() => router.push('/notifications')}
              className={`hover:text-amber-600 transition-colors ${pathname === '/notifications' ? 'text-amber-500' : 'text-gray-500 dark:text-white'}`}
            >
              <Bell size={22} fill={pathname === '/notifications' ? "currentColor" : "none"} />
            </button>

            <div className="relative">
              <button
                onClick={() => setIsChatsOpen(!isChatsOpen)}
                className={`relative hover:text-gray-700 dark:hover:text-white transition-all ${pathname.startsWith('/chats') || isChatsOpen ? 'text-amber-500 dark:text-[#7c3aed] scale-110' : 'text-gray-500 dark:text-white'}`}
              >
                <MessageCircle size={24} fill={pathname.startsWith('/chats') || isChatsOpen ? "currentColor" : "none"} />
                <span className={`absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-black ${pathname.startsWith('/chats') || isChatsOpen ? 'bg-red-500 dark:bg-[#7c3aed]' : 'bg-red-500'}`} />
              </button>

              <ChatsDropdown isOpen={isChatsOpen} onClose={() => setIsChatsOpen(false)} />
            </div>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-[#8B5CF6] hover:text-[#7C3AED] dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
            >
              {mounted && (
                <>
                  <Moon size={22} fill={theme === 'dark' ? "currentColor" : "none"} className={theme === 'dark' ? "hidden" : "block"} />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`lucide lucide-sun ${theme === 'dark' ? 'block' : 'hidden'}`}
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                </>
              )}
              {!mounted && <Moon size={22} />}
            </button>
            <button className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-transparent hover:ring-gray-200 transition-all">
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                alt="User avatar"
                className="h-full w-full object-cover"
              />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={() => setIsChatsOpen(!isChatsOpen)}
              className={`relative hover:text-gray-700 dark:hover:text-white transition-all ${pathname.startsWith('/chats') || isChatsOpen ? 'text-amber-500 dark:text-[#7c3aed]' : 'text-gray-500 dark:text-white'}`}
            >
              <MessageCircle size={24} fill={pathname.startsWith('/chats') || isChatsOpen ? "currentColor" : "none"} />
              <span className={`absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-black ${pathname.startsWith('/chats') || isChatsOpen ? 'bg-red-500 dark:bg-[#7c3aed]' : 'bg-red-500'}`} />
            </button>
            <ChatsDropdown isOpen={isChatsOpen} onClose={() => setIsChatsOpen(false)} />

            <button
              onClick={toggleMobileMenu}
              className="text-gray-500 dark:text-white hover:text-gray-900 dark:hover:text-gray-300 transition-colors p-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
            </button>
          </div>
        </header>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-white dark:bg-black p-6 flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-200">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-1.5 grayscale-[0.2]" onClick={() => handleNavigation('/')}>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 font-bold text-white text-[10px] shadow-sm">
                THE-
              </div>
              <span className="text-base font-bold tracking-tight text-amber-500">QURYLYS</span>
            </div>
            <button onClick={closeMobileMenu} className="p-2 text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>

          <nav className="flex flex-col gap-6 text-xl font-medium">
            <button onClick={() => handleNavigation('/calendar')} className="flex items-center gap-4 text-left p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">
              <span className={pathname === '/calendar' ? 'text-amber-500' : 'text-gray-800 dark:text-white'}>Календарь</span>
            </button>
            <button onClick={() => handleNavigation('/hierarchy')} className="flex items-center gap-4 text-left p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">
              <span className={isHierarchy ? 'text-amber-500' : 'text-gray-800 dark:text-white'}>Иерархия</span>
            </button>
            <button onClick={() => handleNavigation('/dashboard')} className="flex items-center gap-4 text-left p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">
              <span className={isDashboard ? 'text-amber-500' : 'text-gray-800 dark:text-white'}>Дашборд</span>
            </button>
            <button onClick={() => handleNavigation('/lifecycle')} className="flex items-center gap-4 text-left p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">
              <span className={isLifecyclePage ? 'text-amber-500' : 'text-gray-800 dark:text-white'}>ЖЦП</span>
            </button>
            <button onClick={() => handleNavigation('/notifications')} className="flex items-center gap-4 text-left p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">
              <Bell size={24} className={pathname === '/notifications' ? 'text-amber-500' : 'text-gray-500 dark:text-white'} />
              <span className={pathname === '/notifications' ? 'text-amber-500' : 'text-gray-800 dark:text-white'}>Уведомления</span>
            </button>
          </nav>

          <div className="mt-auto pt-8 border-t border-gray-100 dark:border-white/10">
            <div className="flex items-center justify-between mb-6">
              <span className="text-gray-500 dark:text-gray-400">Тема</span>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white"
              >
                {mounted && (
                  <>
                    <Moon size={22} className={theme === 'dark' ? "hidden" : "block"} />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`lucide lucide-sun ${theme === 'dark' ? 'block' : 'hidden'}`}
                    >
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2" />
                      <path d="M12 20v2" />
                      <path d="m4.93 4.93 1.41 1.41" />
                      <path d="m17.66 17.66 1.41 1.41" />
                      <path d="M2 12h2" />
                      <path d="M20 12h2" />
                      <path d="m6.34 17.66-1.41 1.41" />
                      <path d="m19.07 4.93-1.41 1.41" />
                    </svg>
                  </>
                )}
                {!mounted && <Moon size={22} />}
              </button>
            </div>
            <div className="flex items-center gap-4 p-2 rounded-2xl bg-gray-50 dark:bg-white/5">
              <div className="h-10 w-10 overflow-hidden rounded-full">
                <img
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                  alt="User avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Пользователь</p>
                <p className="text-xs text-gray-500">user@example.com</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
