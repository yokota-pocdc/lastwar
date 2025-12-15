'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import UserCalendar from '@/components/UserCalendar';
import LoginForm from '@/components/LoginForm';
import Header from '@/components/Header';
import WeeklyDashboard from '@/components/WeeklyDashboard';
import EventModal from '@/components/EventModal';
import { apiUrl } from '@/lib/api';

interface Event {
  id: number;
  title: string;
  event_type: 'desert' | 'gap';
  team: 'A' | 'B';
  event_date: string;
  status: 'open' | 'closed' | 'finished';
  event_group: string;
  lottery_executed?: number;
  google_event_id?: string;
}

export default function PageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: number; name: string } | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [appliedEventIds, setAppliedEventIds] = useState<number[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEvents();
      fetchAppliedEvents();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      // URLクエリから名前を取得
      const nameFromQuery = searchParams.get('name');

      if (nameFromQuery) {
        // クエリパラメータがある場合、自動ログイン
        await fetch(apiUrl('/api/auth'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nameFromQuery }),
        });
      }

      // セッション確認
      const res = await fetch(apiUrl('/api/auth'));
      const data = await res.json();

      if (data.authenticated) {
        setIsAuthenticated(true);
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch(apiUrl('/api/events'));
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const fetchAppliedEvents = async () => {
    try {
      const res = await fetch(apiUrl('/api/my-applications'));
      const data = await res.json();
      if (res.ok) {
        setAppliedEventIds(data.eventIds);
      }
    } catch (error) {
      console.error('Failed to fetch applied events:', error);
    }
  };

  const handleLogin = (userData: { id: number; name: string }) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleEventsChange = () => {
    fetchEvents();
    fetchAppliedEvents();
    setRefreshKey(prev => prev + 1); // WeeklyDashboardを更新
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
  };

  const handleResultClick = (event: Event) => {
    router.push(`/admin/results/${event.id}`);
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
    handleEventsChange();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* 週次ダッシュボード */}
          <WeeklyDashboard
            onEventClick={handleEventClick}
            onResultClick={handleResultClick}
            refreshKey={refreshKey}
          />

          {/* カレンダービュー */}
          <div>
            <h2 className="text-xl font-bold mb-4">📅 カレンダー</h2>
            <UserCalendar
              events={events}
              appliedEventIds={appliedEventIds}
              onEventsChange={handleEventsChange}
            />
          </div>
        </div>
      </main>

      {/* イベント詳細モーダル */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={handleCloseModal}
          onRefresh={handleEventsChange}
        />
      )}
    </div>
  );
}
