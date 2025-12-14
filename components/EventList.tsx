'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import EventModal from './EventModal';
import { apiUrl } from '@/lib/api';

interface Event {
  id: number;
  title: string;
  event_type: 'desert' | 'gap';
  event_date: string;
  team: 'A' | 'B';
  event_group: string;
  status: 'open' | 'closed' | 'finished';
  google_event_id?: string;
}

export default function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch(apiUrl('/api/events'));
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(apiUrl('/api/sync-calendar'), { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        alert(`${data.syncedCount}件のイベントを同期しました`);
        fetchEvents();
      } else {
        alert(data.error || '同期に失敗しました');
      }
    } catch (error) {
      alert('同期中にエラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
    fetchEvents();
  };

  // グループ名を表示用に変換
  const formatGroupName = (group: string): string => {
    // "砂漠-2025W01" → "砂漠 (2025年 第1週)"
    const match = group.match(/^(.+)-(\d{4})W(\d{2})$/);
    if (match) {
      const [, baseGroup, year, week] = match;
      return `${baseGroup} (${year}年 第${parseInt(week)}週)`;
    }
    return group;
  };

  // グループごとにイベントを整理
  const groupedEvents = events.reduce((acc, event) => {
    const group = event.event_group || 'その他';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(event);
    return acc;
  }, {} as Record<string, Event[]>);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              イベント一覧
            </h1>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-2 rounded-lg transition shadow-md hover:shadow-lg disabled:from-gray-400 disabled:to-gray-400 text-xs sm:text-sm font-medium whitespace-nowrap"
            >
              {syncing ? '同期中' : '🔄'}
            </button>
          </div>
        </div>

      {/* イベントリスト */}
      {Object.keys(groupedEvents).length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-4">イベントがありません</p>
          <button
            onClick={handleSync}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
          >
            Googleカレンダーから取り込む
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([group, groupEvents]) => (
            <div key={group} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
                <h2 className="font-bold text-base sm:text-lg text-gray-800">{formatGroupName(group)}</h2>
              </div>

              <div className="divide-y divide-gray-100">
                {groupEvents.map((event) => {
                  const eventDate = new Date(event.event_date);
                  const isOpen = event.status === 'open';

                  return (
                    <button
                      key={event.id}
                      onClick={() => handleEventClick(event)}
                      className="w-full text-left px-4 py-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all active:scale-[0.99] group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-white text-xs font-bold shadow-sm ${
                              event.team === 'A'
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                                : 'bg-gradient-to-r from-purple-500 to-purple-600'
                            }`}
                          >
                            チーム{event.team}
                          </span>

                          {isOpen ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                              受付中
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                              受付終了
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                        <span>📅</span>
                        {format(eventDate, 'yyyy年M月d日 HH:mm')}
                      </div>

                      <div className="font-medium text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                        {event.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* イベント詳細モーダル */}
      {showModal && selectedEvent && (
        <EventModal event={selectedEvent} onClose={handleCloseModal} />
      )}
    </div>
    </div>
  );
}
