'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';

interface IrregularEvent {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  deadline: string;
  status: string;
  participants_count?: number;
}

interface Application {
  id: number;
  dice1: number;
  dice2: number;
  dice3: number;
  sub_dice1: number;
  sub_dice2: number;
  sub_dice3: number;
  random_value: number;
  rank: number;
  user_name?: string;
  user_id?: number;
}

interface IrregularEventModalProps {
  event: IrregularEvent;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function IrregularEventModal({ event, onClose, onRefresh }: IrregularEventModalProps) {
  const [application, setApplication] = useState<Application | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [diceAnimation, setDiceAnimation] = useState<number[]>([1, 1, 1]);
  const [totalParticipants, setTotalParticipants] = useState(0);

  useEffect(() => {
    fetchApplicationData();
  }, [event.id]);

  const fetchApplicationData = async () => {
    try {
      // 自分の参加情報を取得
      const myRes = await fetch(apiUrl(`/api/irregular-applications?eventId=${event.id}`));
      const myData = await myRes.json();
      if (myRes.ok && myData.applied) {
        setApplication(myData.application);
        setTotalParticipants(myData.totalParticipants);
      }

      // 全参加者の情報を取得
      const allRes = await fetch(apiUrl(`/api/irregular-events/${event.id}`));
      const allData = await allRes.json();
      if (allRes.ok) {
        setApplications(allData.applications || []);
        setTotalParticipants(allData.applications?.length || 0);
      }
    } catch (error) {
      console.error('Failed to fetch application data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollDice = async () => {
    setRolling(true);

    // サイコロアニメーション
    const animationInterval = setInterval(() => {
      setDiceAnimation([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 100);

    await new Promise(resolve => setTimeout(resolve, 2000));
    clearInterval(animationInterval);

    try {
      const res = await fetch(apiUrl('/api/irregular-applications'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      });

      const data = await res.json();

      if (res.ok) {
        // 最終的なサイコロの目をセット
        setDiceAnimation([
          data.application.dice.main.dice1,
          data.application.dice.main.dice2,
          data.application.dice.main.dice3,
        ]);

        // 少し待ってから結果を表示
        await new Promise(resolve => setTimeout(resolve, 500));

        setApplication({
          id: data.application.id,
          dice1: data.application.dice.main.dice1,
          dice2: data.application.dice.main.dice2,
          dice3: data.application.dice.main.dice3,
          sub_dice1: data.application.dice.sub.dice1,
          sub_dice2: data.application.dice.sub.dice2,
          sub_dice3: data.application.dice.sub.dice3,
          random_value: 0,
          rank: data.application.rank,
        });
        setTotalParticipants(data.totalParticipants);

        // データを再取得
        fetchApplicationData();
        onRefresh?.();
      } else {
        alert(data.error || 'エラーが発生しました');
      }
    } catch (error) {
      alert('サーバーエラーが発生しました');
    } finally {
      setRolling(false);
    }
  };

  const formatScore = (d1: number, d2: number, d3: number) => `${d1}${d2}${d3}`;

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return '締切済';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `あと${days}日`;
    if (hours > 0) return `あと${hours}時間`;
    return `あと${Math.floor(diff / (1000 * 60))}分`;
  };

  const isDeadlinePassed = new Date(event.deadline) < new Date();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">{event.title}</h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full text-white text-sm bg-emerald-500">
                  不定期イベント
                </span>
                <span className={`px-3 py-1 rounded-full text-white text-sm ${
                  event.status === 'open' && !isDeadlinePassed ? 'bg-green-500' : 'bg-gray-500'
                }`}>
                  {event.status === 'open' && !isDeadlinePassed ? '募集中' : '募集終了'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          {event.description && (
            <p className="text-gray-600 mb-4">{event.description}</p>
          )}

          <div className="mb-6 space-y-2">
            <p className="text-gray-600">
              📅 開催日: {new Date(event.event_date).toLocaleString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            <p className={`text-sm font-medium ${isDeadlinePassed ? 'text-gray-500' : 'text-orange-600'}`}>
              ⏰ 申込締切: {new Date(event.deadline).toLocaleString('ja-JP', {
                month: 'numeric',
                day: 'numeric',
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })} ({formatDeadline(event.deadline)})
            </p>
            <p className="text-gray-600">
              👥 参加者数: {totalParticipants}名
            </p>
          </div>

          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : application ? (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-4 text-gray-900">あなたの参加情報</h3>

              <div className="space-y-4">
                {/* スコア表示 */}
                <div className="bg-gradient-to-r from-emerald-500 to-green-500 p-4 rounded-lg text-white text-center">
                  <div className="text-sm opacity-80 mb-1">スコア (P)</div>
                  <div className="font-mono text-5xl font-bold tracking-wider">
                    {formatScore(application.dice1, application.dice2, application.dice3)}
                  </div>
                </div>

                <div className="bg-gray-100 p-3 rounded-lg text-center">
                  <div className="text-sm text-gray-500 mb-1">サブスコア (Q)</div>
                  <div className="font-mono text-2xl font-bold text-gray-700">
                    {formatScore(application.sub_dice1, application.sub_dice2, application.sub_dice3)}
                  </div>
                </div>

                {/* 順位表示 */}
                <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">現在の順位</div>
                  <div className="text-3xl font-bold text-blue-600">
                    {application.rank ? (
                      <>
                        {application.rank}位
                        <span className="text-lg text-gray-500"> / {totalParticipants}名中</span>
                      </>
                    ) : (
                      <span className="text-lg">参加者{totalParticipants}名</span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  ※同点の場合はサブスコア(Q)で順位が決まります
                </p>
              </div>

              {/* 順位一覧表示ボタン */}
              <button
                onClick={() => setShowRankings(!showRankings)}
                className="w-full mt-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-4 rounded-lg transition"
              >
                {showRankings ? '🔼 順位一覧を閉じる' : '🔽 順位一覧を見る'}
              </button>
            </div>
          ) : (
            <div className="text-center">
              {event.status === 'open' && !isDeadlinePassed ? (
                <div className="space-y-4">
                  {rolling ? (
                    <div className="py-8">
                      <div className="flex justify-center gap-4 mb-4">
                        {diceAnimation.map((die, index) => (
                          <div
                            key={index}
                            className="w-20 h-20 bg-white border-4 border-emerald-500 rounded-xl flex items-center justify-center text-4xl font-bold text-emerald-600 animate-bounce"
                            style={{ animationDelay: `${index * 0.1}s` }}
                          >
                            {die}
                          </div>
                        ))}
                      </div>
                      <p className="text-lg text-gray-600">サイコロを振っています...</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-emerald-50 p-4 rounded-lg mb-4">
                        <p className="text-sm text-gray-600 mb-2">3つのサイコロを振って参加！</p>
                        <p className="text-xs text-gray-500">
                          スコア(P): 111〜666の3桁の数値で順位が決まります
                        </p>
                      </div>
                      <button
                        onClick={handleRollDice}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition w-full max-w-md"
                      >
                        🎲🎲🎲 サイコロを振って参加
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 py-8">このイベントは募集を終了しています</p>
              )}
            </div>
          )}

          {/* 順位一覧 */}
          {showRankings && applications.length > 0 && (
            <div className="mt-4 bg-white border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-bold text-gray-700">
                順位一覧
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-center">順位</th>
                      <th className="px-3 py-2 text-left">ユーザー</th>
                      <th className="px-3 py-2 text-center">スコア</th>
                      <th className="px-3 py-2 text-center">サブ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr key={app.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 text-center font-bold">
                          {app.rank === 1 && '🥇'}
                          {app.rank === 2 && '🥈'}
                          {app.rank === 3 && '🥉'}
                          {app.rank && app.rank > 3 && app.rank}
                        </td>
                        <td className="px-3 py-2">{app.user_name}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">
                          {formatScore(app.dice1, app.dice2, app.dice3)}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-gray-500">
                          {formatScore(app.sub_dice1, app.sub_dice2, app.sub_dice3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
