'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import IrregularEventManager from '@/components/IrregularEventManager';
import { apiUrl } from '@/lib/api';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    // sessionStorageから認証状態を確認
    const adminAuth = sessionStorage.getItem('adminAuth');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 簡易パスワード認証（環境変数と照合）
    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';
    if (password === correctPassword) {
      sessionStorage.setItem('adminAuth', 'true');
      setIsAuthenticated(true);
    } else {
      alert('パスワードが正しくありません');
      setPassword('');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
    setPassword('');
  };

  const handleClearAllData = async () => {
    const confirmMessage = '【警告】すべてのデータを削除します。\n・イベントデータ\n・参加申込データ\n・ユーザー情報\n\n※実行後は自動的にログアウトされます\n\nこの操作は取り消せません。\n本当に実行しますか？';
    if (!confirm(confirmMessage)) return;

    // 二重確認
    const doubleConfirm = confirm('再確認：本当にすべてのデータを削除しますか？\nデータベースが完全にクリアされます。');
    if (!doubleConfirm) return;

    try {
      const res = await fetch(apiUrl('/api/admin/clear-applications'), {
        method: 'POST',
      });

      if (res.ok) {
        alert('すべてのデータを削除しました。\nログイン画面に戻ります。');
        // セッションとcookieをクリア
        sessionStorage.removeItem('adminAuth');
        // すべてのcookieを削除
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        window.location.href = '/';
      } else {
        const data = await res.json();
        alert(data.error || '削除に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました');
    }
  };

  // 認証されていない場合はログインフォームを表示
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="inline-block w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mb-3">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">管理画面ログイン</h1>
          </div>
          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 transition"
                placeholder="パスワードを入力してください"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg"
            >
              🔓 ログイン
            </button>
            <div className="mt-4 text-center">
              <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                ← トップに戻る
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">⚙️</span>
              管理画面
            </h1>
            <div className="flex gap-4">
              <button
                onClick={handleLogout}
                className="text-sm sm:text-base text-white hover:text-gray-200 font-medium transition"
              >
                ログアウト
              </button>
              <Link href="/" className="text-sm sm:text-base text-white hover:text-gray-200 font-medium transition">
                ← トップに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* 管理ツール */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={handleClearAllData}
            className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold py-2 px-4 sm:px-6 rounded-lg transition shadow-md text-sm sm:text-base"
          >
            🗑️ 全データ削除（試験用）
          </button>
        </div>

        {/* イベント管理 */}
        <IrregularEventManager />
      </div>
    </div>
  );
}
