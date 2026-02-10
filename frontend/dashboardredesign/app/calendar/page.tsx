'use client';

import Header from '@/components/header';
import CalendarContent from '@/components/calendar-content';

export default function CalendarPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background flex flex-col">
            {/* Header */}
            <Header />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6 pt-24">
                <CalendarContent />
            </main>
        </div>
    );
}
