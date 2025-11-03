'use client';

import { useState } from 'react';

interface LoginFormProps {
  onLogin: (user: { id: number; name: string }) => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('名前を入力してください');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        onLogin(data.user);
      } else {
        setError(data.error || 'ログインに失敗しました');
      }
    } catch (err) {
      setError('サーバーエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="inline-block w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <span className="text-5xl">🎮</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            イベント参加申込システム
          </h1>
          <h2 className="text-lg text-gray-500 font-medium">
            -jfkh-
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
              プレイヤー名を入力してください
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 transition"
              placeholder="例: 太郎"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-rose-100 border-2 border-rose-300 text-rose-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '処理中...' : '🚀 入場'}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-600 text-center bg-gray-50 rounded-lg p-3">
          <p>イベント参加者抽選・管理システム</p>
        </div>
      </div>
    </div>
  );
}
