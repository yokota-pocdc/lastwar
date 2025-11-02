'use client';

import { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
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

interface Event {
  id: number;
  title: string;
  event_type: 'desert' | 'gap';
  team: 'A' | 'B';
  event_date: string;
  status: string;
  google_event_id?: string;
}

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  event_type: 'desert' | 'gap';
  team: 'A' | 'B';
  google_event_id?: string;
}

interface EventFormData {
  title: string;
  event_type: 'desert-a' | 'desert-b' | 'gap-a' | 'gap-b';
  event_date: string;
}

interface AdminCalendarProps {
  events: Event[];
  onEventsChange: () => void;
}

export default function AdminCalendar({ events, onEventsChange }: AdminCalendarProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    event_type: 'desert-a',
    event_date: '',
  });
  const [view, setView] = useState<View>('month');

  // Convert DB events to calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return events.map(event => {
      const start = new Date(event.event_date);
      const end = new Date(start.getTime() + 30 * 60000); // +30分
      return {
        id: event.id,
        title: event.title,
        start,
        end,
        event_type: event.event_type,
        team: event.team,
        google_event_id: event.google_event_id,
      };
    });
  }, [events]);

  // Event style based on type
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = '#3174ad';
    if (event.event_type === 'desert') {
      backgroundColor = event.team === 'A' ? '#f97316' : '#fb923c'; // オレンジ系
    } else {
      backgroundColor = event.team === 'A' ? '#9333ea' : '#a855f7'; // 紫系
    }
    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
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

    setFormData({
      title: '',
      event_type: 'desert-a',
      event_date: formattedDate,
    });
    setSelectedEvent(null);
    setShowModal(true);
  }, []);

  // Handle event selection (edit existing event)
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    const eventTypeTeam = `${event.event_type}-${event.team.toLowerCase()}` as 'desert-a' | 'desert-b' | 'gap-a' | 'gap-b';
    const formattedDate = format(event.start, "yyyy-MM-dd'T'HH:mm");

    setFormData({
      title: event.title,
      event_type: eventTypeTeam,
      event_date: formattedDate,
    });
    setSelectedEvent(event);
    setShowModal(true);
  }, []);

  // Create or update event
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedEvent) {
        // Update existing event
        const res = await fetch(`/api/events/${selectedEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          alert('イベントを更新しました');
          setShowModal(false);
          onEventsChange();
        } else {
          const data = await res.json();
          alert(data.error || '更新に失敗しました');
        }
      } else {
        // Create new event
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          alert('イベントを作成しました');
          setShowModal(false);
          onEventsChange();
        } else {
          const data = await res.json();
          alert(data.error || '作成に失敗しました');
        }
      }
    } catch (error) {
      alert('エラーが発生しました');
    }
  };

  // Delete event
  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (!confirm('本当に削除しますか?')) return;

    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('削除しました');
        setShowModal(false);
        onEventsChange();
      } else {
        const data = await res.json();
        alert(data.error || '削除に失敗しました');
      }
    } catch (error) {
      alert('エラーが発生しました');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">イベントカレンダー</h2>
        <p className="text-sm text-gray-600">
          カレンダー上の空白をクリックして新規イベント作成、既存イベントをクリックで編集できます
        </p>
      </div>

      <div className="calendar-container" style={{ height: '700px' }}>
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

      {/* Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">
              {selectedEvent ? 'イベント編集' : '新規イベント作成'}
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
                  placeholder="例: 第1回、デイリーイベント など"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  イベント種別 <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value as EventFormData['event_type'] })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  required
                >
                  <option value="desert-a">砂漠A</option>
                  <option value="desert-b">砂漠B</option>
                  <option value="gap-a">狭間A</option>
                  <option value="gap-b">狭間B</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  開始日時 <span className="text-red-600">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg text-gray-900"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  ※終了日時は開始日時の30分後に自動設定されます
                </p>
              </div>

              <div className="flex gap-3">
                {selectedEvent && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition"
                  >
                    削除
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  {selectedEvent ? '更新' : '作成'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom CSS for calendar */}
      <style jsx global>{`
        .rbc-calendar {
          font-family: inherit;
        }
        .rbc-header {
          padding: 10px 3px;
          font-weight: bold;
          background-color: #f3f4f6;
        }
        .rbc-today {
          background-color: #fef3c7;
        }
        .rbc-event {
          padding: 2px 5px;
          font-size: 0.875rem;
        }
        .rbc-toolbar button {
          color: #374151;
          border: 1px solid #d1d5db;
          padding: 5px 10px;
          margin: 0 2px;
        }
        .rbc-toolbar button:hover {
          background-color: #e5e7eb;
        }
        .rbc-toolbar button.rbc-active {
          background-color: #3b82f6;
          color: white;
        }
      `}</style>
    </div>
  );
}
