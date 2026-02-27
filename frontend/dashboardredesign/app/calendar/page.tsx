'use client';

import Header from '@/components/header';
import CalendarContent from '@/components/calendar-content';

export default function CalendarPage() {
    return (
        <div className="h-screen bg-gray-50 dark:bg-background flex flex-col overflow-hidden">
            {/* Header */}
            <Header />

            {/* Main Content */}
            <main className="min-h-0 flex-1 overflow-y-auto p-6 pt-24">
                <CalendarContent />
            </main>
        </div>
    );
}
