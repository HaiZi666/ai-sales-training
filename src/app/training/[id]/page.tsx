import { Suspense } from 'react';
import TrainingSessionContent from './TrainingSessionContent';

function TrainingSessionFallback() {
  return (
    <div className="flex flex-col h-screen bg-[#f2f3f5] items-center justify-center gap-3 px-4">
      <div
        className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"
        aria-hidden
      />
      <p className="text-sm text-gray-500">加载中…</p>
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
