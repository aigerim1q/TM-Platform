'use client';

import {
    Home,
    Folder,
    Users,
    Calendar,
    Settings,
    LogOut
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

export default function AppSidebar() {
    const router = useRouter();
    const pathname = usePathname();

    const navItems = [
        { name: 'Дашборды', icon: Home, path: '/dashboard' },
        { name: 'ЖЦП', icon: Folder, path: '/lifecycle' },
        { name: 'Иерархия', icon: Users, path: '/hierarchy' },
        { name: 'Календарь', icon: Calendar, path: '/calendar' },
        { name: 'Настройки', icon: Settings, path: '/settings' },
    ];

    return (
        <aside className="w-64 bg-white dark:bg-[#050505] border-r border-gray-100 dark:border-white/5 flex flex-col h-screen shrink-0 font-sans transition-colors duration-300">
            {/* Logo Area */}
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#fceba7] dark:bg-[#d8b4fe] flex items-center justify-center text-[#78350f] dark:text-[#3b0764] font-bold shadow-sm">
                        Q
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-900 dark:text-white leading-tight">The Qurylys</h1>
                        <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Pro Workspace</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
                    return (
                        <button
                            key={item.path}
                            onClick={() => router.push(item.path)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 group ${isActive
                                ? 'bg-[#fffbeb] text-[#92400e] dark:bg-[#2e1065] dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`${isActive ? 'text-[#d97706] dark:text-[#fbbf24]' : 'text-gray-400 dark:text-[#71717a] group-hover:text-gray-600 dark:group-hover:text-white transition-colors'}`} />
                            {item.name}
                        </button>
                    );
                })}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-gray-100 dark:border-white/5 mt-auto">
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer group transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 ring-2 ring-white dark:ring-white/10">
                            <img
                                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop"
                                alt="User"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Гауһар Султан</p>
                            <p className="text-xs text-gray-500 dark:text-[#71717a]">Product Designer</p>
                        </div>
                    </div>
                    <LogOut size={18} className="text-gray-400 dark:text-[#52525b] opacity-0 group-hover:opacity-100 transition-all delay-75 transform translate-x-1 group-hover:translate-x-0" />
                </div>
            </div>
        </aside>
    );
}
