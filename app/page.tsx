import { Suspense } from 'react';
import PageContent from './page-content';

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    }>
      <PageContent />
    </Suspense>
  );
}
