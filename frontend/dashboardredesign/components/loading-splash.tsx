import { Loader2 } from 'lucide-react';

type LoadingSplashProps = {
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
  compact?: boolean;
};

export default function LoadingSplash({
  title = 'Загрузка',
  subtitle = 'Пожалуйста, подождите...',
  fullScreen = false,
  compact = false,
}: LoadingSplashProps) {
  const containerClass = fullScreen
    ? 'min-h-screen w-full'
    : 'w-full';

  const contentClass = compact
    ? 'rounded-2xl px-5 py-4'
    : 'rounded-3xl px-8 py-7';

  return (
    <div className={`${containerClass} flex items-center justify-center`}>
      <div className={`${contentClass} border border-white/10 bg-slate-950/80 shadow-2xl backdrop-blur`}>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-slate-300">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

