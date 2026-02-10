import Header from '@/components/header';
import DashboardContent from '@/components/dashboard-content';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header - centered */}
      <Header />

      {/* Dashboard content */}
      <div className="pt-24">
        <DashboardContent />
      </div>
    </div>
  );
}
