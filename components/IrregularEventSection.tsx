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

interface Props {
  onRefresh?: () => void;
}

export default function IrregularEventSection({ onRefresh }: Props) {
  const [events, setEvents] = useState<IrregularEvent[]>([]);
  const [applicationInfo, setApplicationInfo] = useState<Map<number, ApplicationInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<IrregularEvent | null>(null);

  const fetchEvents = async () => {
    try {
      const res = await fetch(apiUrl('/api/irregular-events?status=open&includeParticipants=true'));
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
      const res = await fetch(apiUrl(`/api/irregular-applications?eventId=${eventId}`));
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

  const handleCloseModal = () => {
    setSelectedEvent(null);
    fetchEvents();
    onRefresh?.();
  };

  if (loading) {
    return null;
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl shadow-lg p-6 text-white">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="text-2xl">🎲</span>
          募集中の不定期イベント
        </h2>

        <div className="space-y-3">
          {events.map(event => {
            const info = applicationInfo.get(event.id);
            const hasApplied = info?.applied;

            return (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="bg-white/20 backdrop-blur rounded-xl p-4 cursor-pointer hover:bg-white/30 transition"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">{event.title}</h3>
                    {event.description && (
                      <p className="text-sm opacity-80 mt-1 line-clamp-1">{event.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="bg-white/30 px-2 py-1 rounded">
                        開催: {new Date(event.event_date).toLocaleDateString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
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

                  <div className="flex-shrink-0">
                    {hasApplied ? (
                      <div className="bg-white/30 rounded-lg px-4 py-2 text-center">
                        <div className="text-xs opacity-80">参加済</div>
                        <div className="font-mono text-xl font-bold">
                          {info?.application?.mainScore}
                        </div>
                        <div className="text-xs">
                          {info?.application?.rank}位 / {info?.totalParticipants}名
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white text-emerald-600 rounded-lg px-4 py-2 font-bold text-center">
                        🎲 参加する
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
