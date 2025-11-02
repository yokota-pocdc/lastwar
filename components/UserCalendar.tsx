'use client';

import { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import EventModal from './EventModal';

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
  status: 'open' | 'closed' | 'finished';
  event_group: string;
  google_event_id?: string;
}

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  event_type: 'desert' | 'gap';
  team: 'A' | 'B';
  status: string;
  event_group: string;
  hasApplied: boolean;
}

interface UserCalendarProps {
  events: Event[];
  appliedEventIds: number[];
  onEventsChange: () => void;
}

export default function UserCalendar({ events, appliedEventIds, onEventsChange }: UserCalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
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
        status: event.status,
        event_group: event.event_group,
        hasApplied: appliedEventIds.includes(event.id),
      };
    });
  }, [events, appliedEventIds]);

  // Event style based on type and application status
  const eventStyleGetter = (event: CalendarEvent) => {
    let backgroundColor = '#3174ad';
    let border = '2px solid';
    let borderColor = 'transparent';

    if (event.hasApplied) {
      // 申し込み済み - 緑色のボーダー
      borderColor = '#22c55e';
      if (event.event_type === 'desert') {
        backgroundColor = event.team === 'A' ? '#f97316' : '#fb923c';
      } else {
        backgroundColor = event.team === 'A' ? '#9333ea' : '#a855f7';
      }
    } else {
      // 未申し込み - 通常の色
      if (event.event_type === 'desert') {
        backgroundColor = event.team === 'A' ? '#f97316' : '#fb923c';
      } else {
        backgroundColor = event.team === 'A' ? '#9333ea' : '#a855f7';
      }
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border,
        borderColor,
        display: 'block',
        fontWeight: event.hasApplied ? 'bold' : 'normal',
      },
    };
  };

  // Custom event component to show "申込済" label
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    return (
      <div className="flex items-center justify-between h-full px-1">
        <span className="truncate flex-1">{event.title}</span>
        {event.hasApplied && (
          <span className="ml-1 bg-green-500 text-white text-xs px-1 rounded whitespace-nowrap">
            申込済
          </span>
        )}
      </div>
    );
  };

  // Handle event selection (show modal for application)
  const handleSelectEvent = useCallback((calEvent: CalendarEvent) => {
    const fullEvent = events.find(e => e.id === calEvent.id);
    if (fullEvent) {
      setSelectedEvent(fullEvent);
    }
  }, [events]);

  const handleCloseModal = () => {
    setSelectedEvent(null);
    onEventsChange(); // Refresh events after modal closes
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">イベントカレンダー</h2>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span>砂漠の戦場</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <span>狭間の戦場</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded border-2 border-green-500"></div>
            <span className="font-bold">申し込み済み</span>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          イベントをクリックして申し込みができます
        </p>
      </div>

      <div className="calendar-container" style={{ height: '700px' }}>
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          onSelectEvent={handleSelectEvent}
          selectable={false}
          eventPropGetter={eventStyleGetter}
          components={{
            event: EventComponent,
          }}
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

      {/* Event Modal for Application */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={handleCloseModal}
        />
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
