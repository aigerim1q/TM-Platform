import NotificationsContent from '@/components/notifications-content';
import Header from '@/components/header';

export default function NotificationsPage() {
    return (
        <div className="min-h-screen bg-[#F9F9F9] dark:bg-background">
            <Header />
            <div className="pt-24">
                <NotificationsContent />
            </div>
        </div>
    );
}
