'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminCalendar from '@/components/AdminCalendar';
import SyncManagement from '@/components/SyncManagement';

interface Event {
  id: number;
  title: string;
  event_type: 'desert' | 'gap';
  team: 'A' | 'B';
  event_date: string;
  status: string;
  lottery_executed: number;
}

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    event_type: 'desert-a',
    event_date: '',
  });

  useEffect(() => {
    // sessionStorageから認証状態を確認
    const adminAuth = sessionStorage.getItem('adminAuth');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
      fetchEvents();
    }
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 簡易パスワード認証（環境変数と照合）
    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';
    if (password === correctPassword) {
      sessionStorage.setItem('adminAuth', 'true');
      setIsAuthenticated(true);
      fetchEvents();
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

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCreateForm(false);
        setFormData({
          title: '',
          event_type: 'desert-a',
          event_date: '',
        });
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || '作成に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました');
    }
  };

  const handleDelete = async (id: number) => {
    // 申込者数を確認
    try {
      const checkRes = await fetch(`/api/events/${id}`);
      const checkData = await checkRes.json();

      let confirmMessage = '本当に削除しますか?';
      if (checkData.applicationsCount > 0) {
        confirmMessage = `このイベントには${checkData.applicationsCount}件の申し込みがあります。\n削除すると申し込みデータもすべて削除されます。\n本当に削除しますか?`;
      }

      if (!confirm(confirmMessage)) return;

      const res = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || '削除に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-calendar', {
        method: 'POST',
      });

      if (res.ok) {
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || '同期に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearApplications = async () => {
    const confirmMessage = '【警告】すべてのユーザーデータを削除します。\n・申し込みデータ\n・ユーザー情報\n・セッション情報\n※イベントカレンダーは残ります\n※実行後は自動的にログアウトされます\n\nこの操作は取り消せません。\n本当に実行しますか？';
    if (!confirm(confirmMessage)) return;

    // 二重確認
    const doubleConfirm = confirm('再確認：本当にすべてのユーザーデータを削除しますか？\n管理者を含む全ユーザーが削除され、再ログインが必要になります。');
    if (!doubleConfirm) return;

    try {
      const res = await fetch('/api/admin/clear-applications', {
        method: 'POST',
      });

      if (res.ok) {
        alert('すべてのデータを削除しました。ログイン画面に戻ります。');
        // セッションをクリアして、ログイン画面にリダイレクト
        sessionStorage.removeItem('adminAuth');
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-purple-600 mb-6 text-center">管理画面ログイン</h1>
          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg text-gray-900"
                placeholder="パスワードを入力してください"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              ログイン
            </button>
            <div className="mt-4 text-center">
              <Link href="/" className="text-sm text-blue-600 hover:underline">
                ← トップに戻る
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-purple-600">管理画面</h1>
            <div className="flex gap-2">
              <button
                onClick={handleLogout}
                className="text-sm sm:text-base text-red-600 hover:underline"
              >
                ログアウト
              </button>
              <Link href="/" className="text-sm sm:text-base text-blue-600 hover:underline">
                ← トップに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* カレンダービュー */}
        <div className="mb-6">
          <div className="mb-4 flex flex-col sm:flex-row justify-end gap-2">
            <button
              onClick={handleClearApplications}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:px-6 rounded-lg transition text-sm sm:text-base"
            >
              🗑️ 全データ削除（試験用）
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:px-6 rounded-lg transition disabled:bg-gray-400 text-sm sm:text-base"
            >
              {syncing ? '同期中...' : '🔄 Googleカレンダーから同期'}
            </button>
          </div>
          <AdminCalendar events={events} onEventsChange={fetchEvents} />
        </div>

        {/* 同期管理 */}
        <div className="mb-6">
          <SyncManagement />
        </div>

        {/* 旧イベント作成フォーム（コメントアウト） */}
        {/*
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition text-sm sm:text-base"
          >
            ➕ 新規イベント作成
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">新規イベント作成</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  タイトル <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  placeholder="例: 第1回、デイリーイベント など"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  ※種別（砂漠/狭間）やチーム（A/B）はプルダウンで選択するため、タイトルに含める必要はありません
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  イベント種別 <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  required
                >
                  <option value="desert-a">砂漠A</option>
                  <option value="desert-b">砂漠B</option>
                  <option value="gap-a">狭間A</option>
                  <option value="gap-b">狭間B</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  ※同一週のA/Bは同時申込不可です（月曜〜日曜が1週）
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  開始日時 <span className="text-red-600">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  ※終了日時は開始日時の30分後に自動設定されます
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition"
                >
                  作成
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}
        */}

        {/* PC用テーブル表示 */}
        <div className="hidden md:block bg-white rounded-lg shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">タイトル</th>
                <th className="px-4 py-3 text-left">種別</th>
                <th className="px-4 py-3 text-left">開催日</th>
                <th className="px-4 py-3 text-left">状態</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t">
                  <td className="px-4 py-3">{event.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-white text-sm ${
                      event.event_type === 'desert' ? 'bg-orange-500' : 'bg-purple-500'
                    }`}>
                      {event.event_type === 'desert' ? '砂漠' : '狭間'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(event.event_date).toLocaleString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {event.lottery_executed ? (
                      <span className="text-green-600 font-bold">抽選済み</span>
                    ) : (
                      <span className="text-blue-600">{event.status === 'open' ? '受付中' : '受付終了'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/results/${event.id}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition inline-block"
                      >
                        結果表示
                      </Link>
                      {!event.lottery_executed && (
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* スマホ用カード表示 */}
        <div className="md:hidden space-y-4">
          {events.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-lg p-4">
              <div className="mb-3">
                <h3 className="font-bold text-lg mb-2">{event.title}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-white text-xs ${
                    event.event_type === 'desert' ? 'bg-orange-500' : 'bg-purple-500'
                  }`}>
                    {event.event_type === 'desert' ? '砂漠' : '狭間'}
                  </span>
                  <span className="text-xs">チーム{event.team}</span>
                  {event.lottery_executed ? (
                    <span className="text-green-600 font-bold text-xs">抽選済み</span>
                  ) : (
                    <span className="text-blue-600 text-xs">{event.status === 'open' ? '受付中' : '受付終了'}</span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  📅 {new Date(event.event_date).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Link
                  href={`/admin/results/${event.id}`}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition inline-block text-center font-medium"
                >
                  📊 結果表示
                </Link>
                {!event.lottery_executed && (
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition font-medium"
                  >
                    🗑️ 削除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
