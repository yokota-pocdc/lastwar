'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface IrregularEvent {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  deadline: string;
  status: string;
  created_at: string;
}

interface Application {
  id: number;
  event_id: number;
  user_id: number;
  user_name: string;
  dice1: number;
  dice2: number;
  dice3: number;
  sub_dice1: number;
  sub_dice2: number;
  sub_dice3: number;
  random_value: number;
  rank: number;
  created_at: string;
  scores: {
    mainScore: number;
    subScore: number;
    randomValue: number;
  };
}

export default function IrregularResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<IrregularEvent | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/irregular-events/${id}`);
        const data = await res.json();
        if (res.ok) {
          setEvent(data.event);
          setApplications(data.applications);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const formatScore = (d1: number, d2: number, d3: number) => `${d1}${d2}${d3}`;

  const exportCSV = () => {
    if (!event || applications.length === 0) return;

    const headers = ['順位', 'ユーザー名', 'スコア(P)', 'サブスコア(Q)', '登録日時'];
    const rows = applications.map(app => [
      app.rank,
      app.user_name,
      formatScore(app.dice1, app.dice2, app.dice3),
      formatScore(app.sub_dice1, app.sub_dice2, app.sub_dice3),
      new Date(app.created_at).toLocaleString('ja-JP'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `irregular_event_${event.id}_results.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-600">イベントが見つかりません</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="bg-gradient-to-r from-emerald-600 to-green-600 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🎲</span>
              不定期イベント結果
            </h1>
            <Link href="/admin" className="text-sm sm:text-base text-white hover:text-gray-200 font-medium transition">
              ← 管理画面に戻る
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* イベント情報 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">{event.title}</h2>
          {event.description && (
            <p className="text-gray-600 mb-4">{event.description}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-500">開催日時:</span>
              <div className="text-lg">
                {new Date(event.event_date).toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-500">締切日時:</span>
              <div className="text-lg">
                {new Date(event.deadline).toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-500">状態:</span>
              <div>
                <span className={`px-3 py-1 rounded text-white text-sm ${
                  event.status === 'open' ? 'bg-emerald-500' :
                  event.status === 'closed' ? 'bg-gray-500' : 'bg-blue-500'
                }`}>
                  {event.status === 'open' ? '募集中' :
                   event.status === 'closed' ? '募集終了' : '終了'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 参加者一覧 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">
              参加者一覧（{applications.length}名）
            </h3>
            <button
              onClick={exportCSV}
              disabled={applications.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              CSV出力
            </button>
          </div>

          {applications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              まだ参加者がいません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-3 text-center">順位</th>
                    <th className="px-3 py-3 text-left">ユーザー名</th>
                    <th className="px-3 py-3 text-center">スコア(P)</th>
                    <th className="px-3 py-3 text-center">サブスコア(Q)</th>
                    <th className="px-3 py-3 text-left">登録日時</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app, index) => (
                    <tr
                      key={app.id}
                      className={`border-t ${
                        index === 0 ? 'bg-yellow-50' :
                        index === 1 ? 'bg-gray-50' :
                        index === 2 ? 'bg-orange-50' : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-center font-bold">
                        {app.rank === 1 && <span className="text-yellow-500 text-lg">🥇</span>}
                        {app.rank === 2 && <span className="text-gray-400 text-lg">🥈</span>}
                        {app.rank === 3 && <span className="text-orange-400 text-lg">🥉</span>}
                        {app.rank > 3 && <span>{app.rank}</span>}
                      </td>
                      <td className="px-3 py-3 font-medium">{app.user_name}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-mono text-lg font-bold text-emerald-600">
                          {formatScore(app.dice1, app.dice2, app.dice3)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-mono text-gray-600">
                          {formatScore(app.sub_dice1, app.sub_dice2, app.sub_dice3)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-500">
                        {new Date(app.created_at).toLocaleString('ja-JP', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* スコアの説明 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            <h4 className="font-bold mb-2">スコアについて</h4>
            <ul className="space-y-1">
              <li><strong>スコア(P):</strong> 3つのサイコロを振って得られる3桁の数値（111〜666）。大きいほど上位。</li>
              <li><strong>サブスコア(Q):</strong> 同点比較用の3桁の数値。Pが同じ場合にQで順位を決定。</li>
              <li><strong>順位決定:</strong> P → Q → システムランダム値(R)の順で比較し、必ずユニークな順位が付きます。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
