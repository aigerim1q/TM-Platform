import Header from '@/components/header';
import LifecycleContent from '@/components/lifecycle-content';

export default function Lifecycle() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <Header />

      {/* Main content area */}
      <main className="pt-24">
        <LifecycleContent />
      </main>
    </div>
  );
}
