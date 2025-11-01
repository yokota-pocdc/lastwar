'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import EventModal from './EventModal';

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
      const res = await fetch('/api/events');
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
      const res = await fetch('/api/sync-calendar', { method: 'POST' });
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
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 同期ボタン */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">イベント一覧</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition disabled:bg-gray-400 text-sm"
        >
          {syncing ? '同期中...' : '🔄 同期'}
        </button>
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
            <div key={group} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b">
                <h2 className="font-bold text-lg">{group}</h2>
              </div>

              <div className="divide-y">
                {groupEvents.map((event) => {
                  const eventDate = new Date(event.event_date);
                  const isOpen = event.status === 'open';

                  return (
                    <button
                      key={event.id}
                      onClick={() => handleEventClick(event)}
                      className="w-full text-left px-4 py-4 hover:bg-gray-50 transition active:bg-gray-100"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-white text-sm font-bold ${
                              event.team === 'A' ? 'bg-blue-500' : 'bg-purple-500'
                            }`}
                          >
                            {event.event_group} {event.team}
                          </span>

                          {!isOpen && (
                            <span className="inline-block px-2 py-1 rounded bg-gray-400 text-white text-xs">
                              受付終了
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-1">
                        {format(eventDate, 'yyyy年M月d日 HH:mm')}
                      </div>

                      <div className="font-medium text-gray-900">{event.title}</div>
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
  );
}
