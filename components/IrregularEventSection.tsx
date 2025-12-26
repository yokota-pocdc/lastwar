'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';
import IrregularEventModal from './IrregularEventModal';

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

interface RankingEntry {
  user_name: string;
  mainScore: string;
  subScore: string;
  rank: number;
}

interface Props {
  onRefresh?: () => void;
}

export default function IrregularEventSection({ onRefresh }: Props) {
  const [openEvents, setOpenEvents] = useState<IrregularEvent[]>([]);
  const [closedEvents, setClosedEvents] = useState<IrregularEvent[]>([]);
  const [applicationInfo, setApplicationInfo] = useState<Map<number, ApplicationInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<IrregularEvent | null>(null);
  const [expandedRankings, setExpandedRankings] = useState<Set<number>>(new Set());
  const [rankings, setRankings] = useState<Map<number, RankingEntry[]>>(new Map());

  const fetchEvents = async () => {
    try {
      // オープン中のイベント
      const openRes = await fetch(apiUrl('/api/irregular-events?status=open&includeParticipants=true'));
      const openData = await openRes.json();
      if (openRes.ok) {
        setOpenEvents(openData.events);
        for (const event of openData.events) {
          await fetchApplicationInfo(event.id);
        }
      }

      // 終了したイベント（closed + finished）
      const allRes = await fetch(apiUrl('/api/irregular-events?includeParticipants=true'));
      const allData = await allRes.json();
      if (allRes.ok) {
        const closed = allData.events.filter((e: IrregularEvent) => e.status !== 'open');
        setClosedEvents(closed);
        for (const event of closed) {
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
      const res = await fetch(apiUrl(`/api/irregular-applications?eventId=${eventId}`));
      const data = await res.json();
      if (res.ok) {
        setApplicationInfo(prev => new Map(prev).set(eventId, data));
      }
    } catch (error) {
      console.error('Failed to fetch application info:', error);
    }
  };

  const fetchRanking = async (eventId: number) => {
    try {
      const res = await fetch(apiUrl(`/api/irregular-events/${eventId}`));
      const data = await res.json();
      if (res.ok && data.applications) {
        const rankingData: RankingEntry[] = data.applications.map((app: any) => ({
          user_name: app.user_name,
          mainScore: `${app.dice1}${app.dice2}${app.dice3}`,
          subScore: `${app.sub_dice1}${app.sub_dice2}${app.sub_dice3}`,
          rank: app.rank,
        }));
        setRankings(prev => new Map(prev).set(eventId, rankingData));
      }
    } catch (error) {
      console.error('Failed to fetch ranking:', error);
    }
  };

  const toggleRanking = async (eventId: number) => {
    if (expandedRankings.has(eventId)) {
      setExpandedRankings(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    } else {
      if (!rankings.has(eventId)) {
        await fetchRanking(eventId);
      }
      setExpandedRankings(prev => new Set(prev).add(eventId));
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
    fetchEvents();
    onRefresh?.();
  };

  const renderRankMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
  };

  const renderEventCard = (event: IrregularEvent, isOpen: boolean) => {
    const info = applicationInfo.get(event.id);
    const hasApplied = info?.applied;
    const isExpanded = expandedRankings.has(event.id);
    const rankingData = rankings.get(event.id) || [];

    return (
      <div
        key={event.id}
        className={`rounded-xl shadow-lg overflow-hidden ${
          isOpen
            ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
            : 'bg-white border border-gray-200'
        }`}
      >
        <div
          className={`p-4 ${isOpen ? 'cursor-pointer hover:bg-white/10' : ''}`}
          onClick={() => isOpen && setSelectedEvent(event)}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">{event.title}</h3>
                {!isOpen && (
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    event.status === 'finished' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {event.status === 'finished' ? '終了' : '募集終了'}
                  </span>
                )}
              </div>
              {event.description && (
                <p className={`text-sm mt-1 line-clamp-1 ${isOpen ? 'opacity-80' : 'text-gray-600'}`}>
                  {event.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className={`px-2 py-1 rounded ${isOpen ? 'bg-white/30' : 'bg-gray-100 text-gray-700'}`}>
                  開催: {formatDate(event.event_date)}
                </span>
                {isOpen && (
                  <span className={`px-2 py-1 rounded ${
                    new Date(event.deadline) < new Date()
                      ? 'bg-red-500/50'
                      : 'bg-yellow-500/50'
                  }`}>
                    締切: {formatDeadline(event.deadline)}
                  </span>
                )}
                <span className={`px-2 py-1 rounded ${isOpen ? 'bg-white/30' : 'bg-gray-100 text-gray-700'}`}>
                  参加者: {event.participants_count || 0}名
                </span>
              </div>
            </div>

            <div className="flex-shrink-0">
              {hasApplied ? (
                <div className={`rounded-lg px-4 py-2 text-center ${isOpen ? 'bg-white/30' : 'bg-emerald-50'}`}>
                  <div className={`text-xs ${isOpen ? 'opacity-80' : 'text-emerald-600'}`}>参加済</div>
                  <div className={`font-mono text-xl font-bold ${isOpen ? '' : 'text-emerald-700'}`}>
                    {info?.application?.mainScore}
                  </div>
                  <div className={`text-xs ${isOpen ? '' : 'text-emerald-600'}`}>
                    {info?.application?.rank && info?.totalParticipants
                      ? `${info.application.rank}位 / ${info.totalParticipants}名中`
                      : info?.totalParticipants
                        ? `参加者${info.totalParticipants}名`
                        : ''}
                  </div>
                </div>
              ) : isOpen ? (
                <div className="bg-white text-emerald-600 rounded-lg px-4 py-2 font-bold text-center">
                  🎲 参加する
                </div>
              ) : (
                <div className="bg-gray-100 text-gray-500 rounded-lg px-4 py-2 text-center text-sm">
                  未参加
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 順位一覧トグル */}
        <div className={`border-t ${isOpen ? 'border-white/30' : 'border-gray-200'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleRanking(event.id);
            }}
            className={`w-full py-2 text-sm font-medium transition ${
              isOpen
                ? 'hover:bg-white/10 text-white/90'
                : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            {isExpanded ? '▲ 順位一覧を閉じる' : '▼ 順位一覧を見る'}
          </button>

          {isExpanded && (
            <div className={`px-4 pb-4 ${isOpen ? '' : 'bg-gray-50'}`}>
              {rankingData.length === 0 ? (
                <p className={`text-center py-4 text-sm ${isOpen ? 'text-white/70' : 'text-gray-500'}`}>
                  参加者がいません
                </p>
              ) : (
                <div className="space-y-1">
                  {rankingData.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between py-2 px-3 rounded ${
                        isOpen ? 'bg-white/20' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-center font-bold">
                          {renderRankMedal(entry.rank)}
                        </span>
                        <span className={`font-medium ${isOpen ? '' : 'text-gray-900'}`}>
                          {entry.user_name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono font-bold ${isOpen ? '' : 'text-gray-900'}`}>
                          {entry.mainScore}
                        </span>
                        <span className={`text-xs ml-2 ${isOpen ? 'opacity-70' : 'text-gray-500'}`}>
                          ({entry.subScore})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {/* 募集中のイベント */}
        {openEvents.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
              <span className="text-2xl">🎲</span>
              募集中のイベント
            </h2>
            <div className="space-y-4">
              {openEvents.map(event => renderEventCard(event, true))}
            </div>
          </div>
        )}

        {/* 終了したイベント */}
        {closedEvents.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
              <span className="text-2xl">📋</span>
              過去のイベント
            </h2>
            <div className="space-y-4">
              {closedEvents.map(event => renderEventCard(event, false))}
            </div>
          </div>
        )}

        {/* イベントがない場合 */}
        {openEvents.length === 0 && closedEvents.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-4xl mb-4">🎲</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">イベントはありません</h2>
            <p className="text-gray-500">新しいイベントが登録されるまでお待ちください</p>
          </div>
        )}
      </div>

      {/* イベント詳細モーダル */}
      {selectedEvent && (
        <IrregularEventModal
          event={selectedEvent}
          onClose={handleCloseModal}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
