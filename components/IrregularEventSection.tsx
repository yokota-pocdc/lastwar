'use client';

import { useState, useEffect } from 'react';

interface IrregularEvent {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  deadline: string;
  status: string;
  participants_count?: number;
}

interface ApplicationInfo {
  applied: boolean;
  application?: {
    mainScore: string;
    subScore: string;
    rank: number | null;
  };
  totalParticipants?: number;
}

interface Props {
  onRefresh?: () => void;
}

export default function IrregularEventSection({ onRefresh }: Props) {
  const [events, setEvents] = useState<IrregularEvent[]>([]);
  const [applicationInfo, setApplicationInfo] = useState<Map<number, ApplicationInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [rollingEventId, setRollingEventId] = useState<number | null>(null);
  const [showResultModal, setShowResultModal] = useState<{
    eventId: number;
    mainScore: string;
    subScore: string;
    rank: number | null;
    totalParticipants: number;
  } | null>(null);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/irregular-events?status=open&includeParticipants=true');
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events);
        // 各イベントの参加情報を取得
        for (const event of data.events) {
          await fetchApplicationInfo(event.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch irregular events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicationInfo = async (eventId: number) => {
    try {
      const res = await fetch(`/api/irregular-applications?eventId=${eventId}`);
      const data = await res.json();
      if (res.ok) {
        setApplicationInfo(prev => new Map(prev).set(eventId, data));
      }
    } catch (error) {
      console.error('Failed to fetch application info:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleRollDice = async (eventId: number) => {
    setRollingEventId(eventId);

    // アニメーション時間
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const res = await fetch('/api/irregular-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });

      const data = await res.json();

      if (res.ok) {
        // 結果を表示
        setShowResultModal({
          eventId,
          mainScore: data.application.mainScore,
          subScore: data.application.subScore,
          rank: data.application.rank,
          totalParticipants: data.totalParticipants,
        });

        // 参加情報を更新
        await fetchApplicationInfo(eventId);
        onRefresh?.();
      } else {
        alert(data.error || 'エラーが発生しました');
      }
    } catch (error) {
      alert('サーバーエラーが発生しました');
    } finally {
      setRollingEventId(null);
    }
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return '締切済';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `あと${days}日`;
    } else if (hours > 0) {
      return `あと${hours}時間`;
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return `あと${minutes}分`;
    }
  };

  if (loading) {
    return null;
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl shadow-lg p-6 text-white">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className="text-2xl">🎲</span>
        募集中の不定期イベント
      </h2>

      <div className="space-y-4">
        {events.map(event => {
          const info = applicationInfo.get(event.id);
          const hasApplied = info?.applied;

          return (
            <div
              key={event.id}
              className="bg-white/20 backdrop-blur rounded-xl p-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{event.title}</h3>
                  {event.description && (
                    <p className="text-sm opacity-80 mt-1">{event.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="bg-white/30 px-2 py-1 rounded">
                      開催: {new Date(event.event_date).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className={`px-2 py-1 rounded ${
                      new Date(event.deadline) < new Date()
                        ? 'bg-red-500/50'
                        : 'bg-yellow-500/50'
                    }`}>
                      締切: {formatDeadline(event.deadline)}
                    </span>
                    <span className="bg-white/30 px-2 py-1 rounded">
                      参加者: {event.participants_count || 0}名
                    </span>
                  </div>
                </div>

                <div className="w-full sm:w-auto">
                  {hasApplied ? (
                    <div className="bg-white/30 rounded-lg p-3 text-center">
                      <div className="text-xs opacity-80 mb-1">参加済み</div>
                      <div className="flex items-center justify-center gap-2">
                        <div>
                          <div className="text-xs opacity-80">スコア</div>
                          <div className="font-mono text-2xl font-bold">
                            {info?.application?.mainScore}
                          </div>
                        </div>
                        <div className="border-l border-white/30 pl-2">
                          <div className="text-xs opacity-80">サブスコア</div>
                          <div className="font-mono text-lg">
                            {info?.application?.subScore}
                          </div>
                        </div>
                      </div>
                      {info?.application?.rank && (
                        <div className="mt-2 text-sm">
                          現在 <span className="font-bold text-xl">{info.application.rank}</span>位
                          / {info.totalParticipants}名
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRollDice(event.id)}
                      disabled={rollingEventId !== null}
                      className={`w-full sm:w-auto px-6 py-3 rounded-lg font-bold transition ${
                        rollingEventId === event.id
                          ? 'bg-white text-emerald-600 animate-pulse'
                          : 'bg-white text-emerald-600 hover:bg-emerald-100'
                      } disabled:opacity-50`}
                    >
                      {rollingEventId === event.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-2xl animate-bounce">🎲</span>
                          <span className="text-2xl animate-bounce delay-100">🎲</span>
                          <span className="text-2xl animate-bounce delay-200">🎲</span>
                        </span>
                      ) : (
                        <span>🎲 サイコロを振る</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 結果モーダル */}
      {showResultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-gray-900 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold mb-4">サイコロの結果</h3>

            <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl p-4 text-white mb-4">
              <div className="text-sm opacity-80">スコア (P)</div>
              <div className="font-mono text-5xl font-bold tracking-wider">
                {showResultModal.mainScore}
              </div>
            </div>

            <div className="bg-gray-100 rounded-xl p-3 mb-4">
              <div className="text-sm text-gray-500">サブスコア (Q)</div>
              <div className="font-mono text-2xl font-bold text-gray-700">
                {showResultModal.subScore}
              </div>
            </div>

            {showResultModal.rank && (
              <div className="mb-4">
                <span className="text-gray-600">現在の順位: </span>
                <span className="text-2xl font-bold text-emerald-600">
                  {showResultModal.rank}位
                </span>
                <span className="text-gray-500">
                  {' '}/ {showResultModal.totalParticipants}名中
                </span>
              </div>
            )}

            <div className="text-xs text-gray-500 mb-4">
              ※同点の場合はサブスコア(Q)で順位が決まります
            </div>

            <button
              onClick={() => setShowResultModal(null)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .delay-100 {
          animation-delay: 0.1s;
        }
        .delay-200 {
          animation-delay: 0.2s;
        }
      `}</style>
    </div>
  );
}
