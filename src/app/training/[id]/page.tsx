import { Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import TrainingSessionContent from './TrainingSessionContent';

function TrainingSessionFallback() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[var(--color-bg)] px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[var(--shadow-card)]">
        <LoaderCircle className="h-5 w-5 animate-spin text-[var(--color-brand-strong)]" aria-hidden />
      </div>
      <p className="text-sm text-[var(--color-text-secondary)]">加载中…</p>
    </div>
  );
}

export default function TrainingSessionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<TrainingSessionFallback />}>
      <TrainingSessionContent params={params} />
    </Suspense>
  );
}
