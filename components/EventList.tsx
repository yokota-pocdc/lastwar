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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [creating, setCreating] = useState(false);

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

  const handleCreateEvent = async () => {
    if (!newEventTitle || !newEventDate) {
      alert('タイトルと日時を入力してください');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newEventTitle,
          event_date: newEventDate,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        alert('イベントを作成しました！');
        setShowCreateForm(false);
        setNewEventTitle('');
        setNewEventDate('');
        fetchEvents();
      } else {
        alert(data.error || 'イベント作成に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました');
    } finally {
      setCreating(false);
    }
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
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              イベント一覧
            </h1>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-5 py-2.5 rounded-xl transition shadow-md hover:shadow-lg text-sm font-bold"
              >
                ✚ 新規イベント
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-2.5 rounded-xl transition shadow-md hover:shadow-lg disabled:from-gray-400 disabled:to-gray-400 text-sm font-medium"
              >
                {syncing ? '同期中...' : '🔄 同期'}
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            イベントを作成するとGoogleカレンダーにも自動登録されます
          </p>
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
            <div key={group} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <h2 className="font-bold text-xl text-gray-800">{formatGroupName(group)}</h2>
              </div>

              <div className="divide-y divide-gray-100">
                {groupEvents.map((event) => {
                  const eventDate = new Date(event.event_date);
                  const isOpen = event.status === 'open';

                  return (
                    <button
                      key={event.id}
                      onClick={() => handleEventClick(event)}
                      className="w-full text-left px-6 py-5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all active:scale-[0.99] group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-block px-4 py-1.5 rounded-full text-white text-sm font-bold shadow-md ${
                              event.team === 'A'
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                                : 'bg-gradient-to-r from-purple-500 to-purple-600'
                            }`}
                          >
                            チーム{event.team}
                          </span>

                          {isOpen ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              受付中
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                              受付終了
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                        <span>📅</span>
                        {format(eventDate, 'yyyy年M月d日 HH:mm')}
                      </div>

                      <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
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

      {/* イベント作成モーダル */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-100">
            <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">新規イベント作成</h2>

            <div className="mb-4">
              <label className="block text-sm font-bold mb-2">
                イベント名 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                placeholder="例: 砂漠A 第1回"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                ※タイトルに「砂漠A」「砂漠B」「狭間A」「狭間B」のいずれかを含めてください
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold mb-2">
                開催日時 <span className="text-red-600">*</span>
              </label>
              <input
                type="datetime-local"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateEvent}
                disabled={creating}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3.5 px-4 rounded-xl transition shadow-md hover:shadow-lg disabled:from-gray-400 disabled:to-gray-400"
              >
                {creating ? '作成中...' : '✓ 作成'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewEventTitle('');
                  setNewEventDate('');
                }}
                disabled={creating}
                className="flex-1 bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-bold py-3.5 px-4 rounded-xl transition shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300"
              >
                キャンセル
              </button>
            </div>
          </div>
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
