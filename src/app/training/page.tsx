'use client';

import { Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import TrainingPageClient from './TrainingPageClient';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <LoaderCircle className="h-8 w-8 animate-spin text-[var(--color-brand)]" />
    </div>
  );
}

export default function TrainingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TrainingPageClient />
    </Suspense>
  );
}
