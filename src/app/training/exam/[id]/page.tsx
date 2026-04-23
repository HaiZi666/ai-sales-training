import { Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import TrainingExamSessionContent from './TrainingExamSessionContent';

function TrainingExamFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
        <LoaderCircle className="h-4 w-4 animate-spin text-[var(--color-brand-strong)]" />
        正在加载考试页面...
      </div>
    </div>
  );
}

export default function TrainingExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<TrainingExamFallback />}>
      <TrainingExamSessionContent params={params} />
    </Suspense>
  );
}
