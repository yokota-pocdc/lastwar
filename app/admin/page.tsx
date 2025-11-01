'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Event {
  id: number;
  title: string;
  event_type: 'desert' | 'gap';
  event_date: string;
  status: string;
  lottery_executed: number;
}

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    event_type: 'desert',
    event_date: '',
    use_team_b: true,
  });

  useEffect(() => {
    fetchEvents();
  }, []);

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
        alert('イベントを作成しました');
        setShowCreateForm(false);
        setFormData({
          title: '',
          event_type: 'desert',
          event_date: '',
          use_team_b: true,
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
    if (!confirm('本当に削除しますか?')) return;

    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('削除しました');
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || '削除に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました');
    }
  };

  const executeLottery = async (eventId: number) => {
    if (!confirm('抽選を実行しますか？実行後は取り消せません。')) return;

    try {
      const res = await fetch('/api/admin/lottery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });

      if (res.ok) {
        alert('抽選を実行しました');
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || '抽選実行に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-purple-600">管理画面</h1>
            <Link href="/" className="text-blue-600 hover:underline">
              ← トップに戻る
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition"
          >
            ➕ 新規イベント作成
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">新規イベント作成</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">タイトル</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">イベント種別</label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value as 'desert' | 'gap' })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                >
                  <option value="desert">砂漠の戦場</option>
                  <option value="gap">狭間の戦場</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">開催日</label>
                <input
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.use_team_b}
                    onChange={(e) => setFormData({ ...formData, use_team_b: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <span>チームBを使用する（2チーム編成）</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition"
                >
                  作成
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-6 rounded-lg transition"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
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
                    {new Date(event.event_date).toLocaleDateString('ja-JP')}
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
                      {!event.lottery_executed && (
                        <button
                          onClick={() => executeLottery(event.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition"
                        >
                          抽選実行
                        </button>
                      )}
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
      </div>
    </div>
  );
}
