'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { apiUrl, BASE_PATH } from '@/lib/api';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'ja': ja,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface IrregularEvent {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  deadline: string;
  google_event_id: string | null;
  status: string;
  created_at: string;
  participants_count?: number;
}

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  deadline: Date;
  status: string;
  isDeadline?: boolean;
}

interface EventFormData {
  title: string;
  description: string;
  event_date: string;
  deadline: string;
}

export default function IrregularEventManager() {
  const [events, setEvents] = useState<IrregularEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<IrregularEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    event_date: '',
    deadline: '',
  });
  const [view, setView] = useState<View>('month');
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    try {
      const res = await fetch(apiUrl('/api/irregular-events?includeParticipants=true'));
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to fetch irregular events:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Convert DB events to calendar events (show both event date and deadline)
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const result: CalendarEvent[] = [];
    for (const event of events) {
      // イベント日
      const eventStart = new Date(event.event_date);
      const eventEnd = new Date(eventStart.getTime() + 60 * 60000); // +1時間
      result.push({
        id: event.id,
        title: `${event.title}`,
        start: eventStart,
        end: eventEnd,
        deadline: new Date(event.deadline),
        status: event.status,
        isDeadline: false,
      });

      // 締切日（イベント日と異なる場合のみ表示）
      const deadlineDate = new Date(event.deadline);
      if (deadlineDate.toDateString() !== eventStart.toDateString()) {
        result.push({
          id: event.id * 10000, // ユニークなIDにするため
          title: `[締切] ${event.title}`,
          start: deadlineDate,
          end: new Date(deadlineDate.getTime() + 30 * 60000),
          deadline: deadlineDate,
          status: event.status,
          isDeadline: true,
        });
      }
    }
    return result;
  }, [events]);

  // Event style
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = '#10b981'; // 緑 - 不定期イベント
    if (event.isDeadline) {
      backgroundColor = '#ef4444'; // 赤 - 締切日
    } else if (event.status === 'closed') {
      backgroundColor = '#6b7280'; // グレー - 締め切り済み
    } else if (event.status === 'finished') {
      backgroundColor = '#3b82f6'; // 青 - 終了
    }
    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  // Handle slot selection (create new event)
  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date }) => {
    const startDate = new Date(slotInfo.start);
    const formattedDate = format(startDate, "yyyy-MM-dd'T'HH:mm");
    // デフォルトで締切日は1日前
    const deadlineDate = new Date(startDate);
    deadlineDate.setDate(deadlineDate.getDate() - 1);
    deadlineDate.setHours(21, 0, 0, 0);
    const formattedDeadline = format(deadlineDate, "yyyy-MM-dd'T'HH:mm");

    setFormData({
      title: '',
      description: '',
      event_date: formattedDate,
      deadline: formattedDeadline,
    });
    setSelectedEvent(null);
    setShowModal(true);
  }, []);

  // Handle event selection (edit existing event)
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    // 締切日マーカーをクリックした場合は元のイベントを取得
    const eventId = event.isDeadline ? Math.floor(event.id / 10000) : event.id;
    const originalEvent = events.find(e => e.id === eventId);
    if (!originalEvent) return;

    setFormData({
      title: originalEvent.title,
      description: originalEvent.description || '',
      event_date: format(new Date(originalEvent.event_date), "yyyy-MM-dd'T'HH:mm"),
      deadline: format(new Date(originalEvent.deadline), "yyyy-MM-dd'T'HH:mm"),
    });
    setSelectedEvent(originalEvent);
    setShowModal(true);
  }, [events]);

  // Create or update event
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (selectedEvent) {
        // Update existing event
        const res = await fetch(apiUrl(`/api/irregular-events/${selectedEvent.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          setShowModal(false);
          fetchEvents();
        } else {
          const data = await res.json();
          alert(data.error || '更新に失敗しました');
        }
      } else {
        // Create new event
        const res = await fetch(apiUrl('/api/irregular-events'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          setShowModal(false);
          fetchEvents();
        } else {
          const data = await res.json();
          alert(data.error || '作成に失敗しました');
        }
      }
    } catch (error) {
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // Delete event
  const handleDelete = async () => {
    if (!selectedEvent) return;

    const confirmMessage = selectedEvent.participants_count && selectedEvent.participants_count > 0
      ? `このイベントには${selectedEvent.participants_count}名の参加者がいます。\n削除すると参加データも削除されます。\n本当に削除しますか?`
      : '本当に削除しますか?';

    if (!confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/irregular-events/${selectedEvent.id}`), {
        method: 'DELETE',
      });

      if (res.ok) {
        setShowModal(false);
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || '削除に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // Update status
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEvent) return;

    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/irregular-events/${selectedEvent.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setShowModal(false);
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || 'ステータス更新に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <span className="text-2xl">🎲</span>
          不定期イベント管理
        </h2>
        <p className="text-sm text-gray-600">
          カレンダー上の空白をクリックして新規イベント作成、既存イベントをクリックで編集できます
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-emerald-500 text-white rounded">募集中</span>
          <span className="px-2 py-1 bg-red-500 text-white rounded">締切日</span>
          <span className="px-2 py-1 bg-gray-500 text-white rounded">募集終了</span>
          <span className="px-2 py-1 bg-blue-500 text-white rounded">終了</span>
        </div>
      </div>

      <div className="calendar-container" style={{ height: '500px' }}>
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          eventPropGetter={eventStyleGetter}
          view={view}
          onView={setView}
          defaultView="month"
          culture="ja"
          messages={{
            next: '次へ',
            previous: '前へ',
            today: '今日',
            month: '月',
            week: '週',
            day: '日',
            agenda: '予定',
            date: '日付',
            time: '時間',
            event: 'イベント',
            noEventsInRange: 'この期間にイベントはありません',
            showMore: (total) => `+${total} 件`,
          }}
        />
      </div>

      {/* イベント一覧テーブル */}
      <div className="mt-6">
        <h3 className="text-lg font-bold mb-3">不定期イベント一覧</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">タイトル</th>
                <th className="px-3 py-2 text-left">開催日</th>
                <th className="px-3 py-2 text-left">締切日</th>
                <th className="px-3 py-2 text-center">参加者</th>
                <th className="px-3 py-2 text-center">カレンダー</th>
                <th className="px-3 py-2 text-left">状態</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedEvent(event);
                    setFormData({
                      title: event.title,
                      description: event.description || '',
                      event_date: format(new Date(event.event_date), "yyyy-MM-dd'T'HH:mm"),
                      deadline: format(new Date(event.deadline), "yyyy-MM-dd'T'HH:mm"),
                    });
                    setShowModal(true);
                  }}
                >
                  <td className="px-3 py-2 font-medium">{event.title}</td>
                  <td className="px-3 py-2">
                    {format(new Date(event.event_date), 'yyyy/MM/dd HH:mm')}
                  </td>
                  <td className="px-3 py-2">
                    {format(new Date(event.deadline), 'yyyy/MM/dd HH:mm')}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {event.participants_count || 0}名
                  </td>
                  <td className="px-3 py-2 text-center">
                    {event.google_event_id ? (
                      <span className="text-emerald-500" title="Googleカレンダー同期済">&#10003;</span>
                    ) : (
                      <span className="text-gray-400" title="未同期">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded text-white text-xs ${
                      event.status === 'open' ? 'bg-emerald-500' :
                      event.status === 'closed' ? 'bg-gray-500' : 'bg-blue-500'
                    }`}>
                      {event.status === 'open' ? '募集中' :
                       event.status === 'closed' ? '募集終了' : '終了'}
                    </span>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    不定期イベントはありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {selectedEvent ? '不定期イベント編集' : '新規不定期イベント作成'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  タイトル <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  placeholder="例: 特別イベント第1回"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  説明
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  placeholder="イベントの説明（任意）"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  開催日時 <span className="text-red-600">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  締切日時 <span className="text-red-600">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  ※締切日時を過ぎると自動的に募集が終了します
                </p>
              </div>

              {selectedEvent && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      参加者数
                    </label>
                    <p className="text-lg font-bold text-emerald-600">
                      {selectedEvent.participants_count || 0}名
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Googleカレンダー同期
                    </label>
                    {selectedEvent.google_event_id ? (
                      <p className="text-emerald-600 flex items-center gap-1">
                        <span>&#10003;</span> 同期済み
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-orange-500 text-sm">
                          未同期
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            setLoading(true);
                            try {
                              const res = await fetch(apiUrl(`/api/irregular-events/${selectedEvent.id}`), {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({}),
                              });
                              if (res.ok) {
                                fetchEvents();
                                const data = await res.json();
                                setSelectedEvent(data.event);
                                alert(data.calendarSynced ? 'カレンダーに同期しました' : 'カレンダー同期に失敗しました');
                              }
                            } catch (error) {
                              alert('エラーが発生しました');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          disabled={loading}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition disabled:opacity-50"
                        >
                          カレンダーに同期
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedEvent && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    ステータス変更
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatusChange('open')}
                      disabled={loading || selectedEvent.status === 'open'}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        selectedEvent.status === 'open'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-200 hover:bg-emerald-100'
                      }`}
                    >
                      募集中
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange('closed')}
                      disabled={loading || selectedEvent.status === 'closed'}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        selectedEvent.status === 'closed'
                          ? 'bg-gray-500 text-white'
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      募集終了
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange('finished')}
                      disabled={loading || selectedEvent.status === 'finished'}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        selectedEvent.status === 'finished'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 hover:bg-blue-100'
                      }`}
                    >
                      終了
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                {selectedEvent && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
                  >
                    削除
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? '処理中...' : selectedEvent ? '更新' : '作成'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>

              {selectedEvent && (
                <div className="pt-2">
                  <a
                    href={`${BASE_PATH}/admin/irregular-results/${selectedEvent.id}`}
                    className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
                  >
                    参加者・結果を見る
                  </a>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
