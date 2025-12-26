'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import Header from '@/components/Header';
import IrregularEventSection from '@/components/IrregularEventSection';

export default function PageContent() {
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: number; name: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // URLクエリから名前を取得
      const nameFromQuery = searchParams.get('name');

      if (nameFromQuery) {
        // クエリパラメータがある場合、自動ログイン
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nameFromQuery }),
        });
      }

      // セッション確認
      const res = await fetch('/api/auth');
      const data = await res.json();

      if (data.authenticated) {
        setIsAuthenticated(true);
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData: { id: number; name: string }) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} refreshKey={refreshKey} />
      <main className="container mx-auto px-4 py-8">
        <IrregularEventSection onRefresh={handleRefresh} />
      </main>
    </div>
  );
}
