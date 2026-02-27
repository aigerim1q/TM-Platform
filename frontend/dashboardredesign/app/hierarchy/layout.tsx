import Header from '@/components/header';

type Props = {
  children: React.ReactNode;
};

export default function HierarchyLayout({ children }: Props) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-white dark:bg-slate-950">
      <Header />
      <main className="absolute inset-0 overflow-hidden pt-24">{children}</main>
    </div>
  );
}
