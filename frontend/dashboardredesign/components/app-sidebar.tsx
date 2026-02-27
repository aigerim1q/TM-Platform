'use client';

import {
    Home,
    Folder,
    Users,
    Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AppSidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const navItems = [
        { name: 'Дашборды', icon: Home, path: '/dashboard' },
        { name: 'ЖЦП', icon: Folder, path: '/lifecycle' },
        { name: 'Иерархия', icon: Users, path: '/hierarchy' },
        { name: 'Календарь', icon: Calendar, path: '/calendar' },
    ];

    return (
        <motion.aside
            animate={{ width: open ? 256 : 84 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="bg-white dark:bg-[#050505] border-r border-gray-100 dark:border-white/5 flex flex-col h-screen shrink-0 font-sans transition-colors duration-300 overflow-hidden"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            {/* Logo Area */}
            <div className="p-4 pb-2">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#fceba7] dark:bg-[#d8b4fe] flex items-center justify-center text-[#78350f] dark:text-[#3b0764] font-bold shadow-sm shrink-0">
                        Q
                    </div>
                    <motion.div
                        animate={{ opacity: open ? 1 : 0, x: open ? 0 : -6 }}
                        transition={{ duration: 0.16 }}
                        className="min-w-0"
                    >
                        <h1 className="font-bold text-gray-900 dark:text-white leading-tight whitespace-nowrap">The Qurylys</h1>
                        <p className="text-xs text-gray-500 dark:text-[#a1a1aa] whitespace-nowrap">Pro Workspace</p>
                    </motion.div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
                    return (
                        <button
                            key={item.path}
                            onClick={() => router.push(item.path)}
                            className={`w-full flex items-center ${open ? 'gap-3 px-4' : 'justify-center px-0'} py-3 rounded-2xl text-sm font-medium transition-all duration-200 group ${isActive
                                ? 'bg-[#fffbeb] text-[#92400e] dark:bg-[#2e1065] dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            title={open ? undefined : item.name}
                        >
                            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`shrink-0 ${isActive ? 'text-[#d97706] dark:text-[#fbbf24]' : 'text-gray-400 dark:text-[#71717a] group-hover:text-gray-600 dark:group-hover:text-white transition-colors'}`} />
                            <motion.span
                                animate={{ opacity: open ? 1 : 0, width: open ? 'auto' : 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden whitespace-nowrap"
                            >
                                {item.name}
                            </motion.span>
                        </button>
                    );
                })}
            </nav>
        </motion.aside>
    );
}
