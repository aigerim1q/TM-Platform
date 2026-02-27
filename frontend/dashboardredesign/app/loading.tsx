import LoadingSplash from '@/components/loading-splash';

export default function Loading() {
  return (
    <LoadingSplash
      fullScreen
      title="Загружаем страницу"
      subtitle="Подготавливаем данные и интерфейс..."
    />
  );
}

