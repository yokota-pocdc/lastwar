'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
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

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  const fetchEvents = async () => {
    try {
      const month = format(currentDate, 'yyyy-MM');
      const res = await fetch(apiUrl(`/api/events?month=${month}`));
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.event_date);
      return isSameDay(eventDate, day);
    });
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
    fetchEvents(); // データ再取得
  };

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={prevMonth}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
        >
          ◀ 前月
        </button>

        <h2 className="text-2xl font-bold">
          {format(currentDate, 'yyyy年 M月')}
        </h2>

        <button
          onClick={nextMonth}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
        >
          次月 ▶
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
          <div key={day} className="text-center font-bold py-2 bg-gray-100 rounded">
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[120px] p-2 border rounded-lg ${
                isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'
              } ${!isSameMonth(day, currentDate) ? 'opacity-50' : ''}`}
            >
              <div className="text-sm font-semibold mb-1">
                {format(day, 'd')}
              </div>

              <div className="space-y-1">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className={`w-full text-xs p-1 rounded text-white hover:opacity-80 transition ${
                      event.event_type === 'desert'
                        ? 'bg-orange-500'
                        : 'bg-purple-500'
                    }`}
                  >
                    {event.title}
                    {event.status === 'closed' && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && selectedEvent && (
        <EventModal event={selectedEvent} onClose={handleCloseModal} />
      )}
    </div>
  );
}
