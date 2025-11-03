'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

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

interface Application {
  id: number;
  event_id: number;
  result_status?: string;
}

interface WeeklyDashboardProps {
  onEventClick: (event: Event) => void;
  onResultClick: (event: Event) => void;
}

export default function WeeklyDashboard({ onEventClick, onResultClick }: WeeklyDashboardProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsCount, setApplicationsCount] = useState<{ [key: number]: number }>({});
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // イベント取得
      const eventsRes = await fetch('/api/events');
      const eventsData = await eventsRes.json();

      // 自分の申し込み取得
      const appsRes = await fetch('/api/my-applications');
      const appsData = await appsRes.json();

      if (eventsRes.ok) {
        setEvents(eventsData.events || []);

        // 申込者数を取得
        const counts: { [key: number]: number } = {};
        for (const event of eventsData.events || []) {
          const countRes = await fetch(`/api/events/${event.id}`);
          const countData = await countRes.json();
          if (countRes.ok) {
            counts[event.id] = countData.applicationsCount || 0;
          }
        }
        setApplicationsCount(counts);
      }

      if (appsRes.ok) {
        setApplications(appsData.applications || []);
      }

      // 締切日時を計算（今週の火曜23:59）
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysUntilTuesday = dayOfWeek === 0 ? 2 : (2 - dayOfWeek + 7) % 7;

      let tuesday = new Date(now);
      tuesday.setDate(now.getDate() + daysUntilTuesday);

      // 月曜11:00前の場合は前週の火曜
      if (dayOfWeek === 1 && now.getHours() < 11) {
        tuesday.setDate(tuesday.getDate() - 7);
      }

      tuesday.setHours(23, 59, 59, 999);
      setDeadline(tuesday);

    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 今週のイベントをフィルター
  const thisWeekEvents = events.filter(event => {
    const eventDate = new Date(event.event_date);
    const now = new Date();

    // 簡易的な週判定（月曜基準）
    const eventWeekStart = new Date(eventDate);
    eventWeekStart.setDate(eventDate.getDate() - ((eventDate.getDay() + 6) % 7));
    eventWeekStart.setHours(11, 0, 0, 0);

    const nowWeekStart = new Date(now);
    nowWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    nowWeekStart.setHours(11, 0, 0, 0);

    // 月曜11:00前の場合は前週扱い
    if (now.getDay() === 1 && now.getHours() < 11) {
      nowWeekStart.setDate(nowWeekStart.getDate() - 7);
    }

    return eventWeekStart.getTime() === nowWeekStart.getTime();
  });

  // 砂漠・狭間別にグループ化
  const desertEvents = thisWeekEvents.filter(e => e.event_type === 'desert');
  const gapEvents = thisWeekEvents.filter(e => e.event_type === 'gap');

  const desertA = desertEvents.find(e => e.team === 'A');
  const desertB = desertEvents.find(e => e.team === 'B');
  const gapA = gapEvents.find(e => e.team === 'A');
  const gapB = gapEvents.find(e => e.team === 'B');

  // 自分の申し込み状況を取得
  const getMyApplication = (eventId?: number) => {
    if (!eventId) return null;
    return applications.find(app => app.event_id === eventId);
  };

  // 砂漠で申し込んでいるチーム
  const desertApplication = applications.find(app =>
    desertEvents.some(e => e.id === app.event_id)
  );

  // 狭間で申し込んでいるチーム
  const gapApplication = applications.find(app =>
    gapEvents.some(e => e.id === app.event_id)
  );

  // エントリー状況を判定
  const getEntryStatus = (events: Event[]) => {
    if (events.length === 0) return '未開催';
    const hasOpen = events.some(e => e.status === 'open');
    if (hasOpen) return 'エントリー中';
    return '締切済';
  };

  const renderSquadCard = (
    event: Event | undefined,
    team: 'A' | 'B',
    myApplication: Application | null,
    otherTeamApplication: Application | null
  ) => {
    if (!event) {
      return (
        <div className="flex-1 min-w-0 bg-gray-100 rounded-lg p-4 text-center text-gray-500">
          小隊{team}: 未設定
        </div>
      );
    }

    const eventDate = new Date(event.event_date);
    const count = applicationsCount[event.id] || 0;
    const isClosed = event.status !== 'open';
    const myApp = getMyApplication(event.id);

    return (
      <div className="flex-1 min-w-0 bg-white border-2 border-gray-200 rounded-lg p-4">
        <div className="font-bold text-lg mb-2">小隊{team}</div>
        <div className="text-sm text-gray-600 mb-1">
          {format(eventDate, 'M/d(E) HH:mm', { locale: ja })}
        </div>
        <div className="text-sm text-gray-600 mb-3">
          エントリー人数: {count}人
        </div>

        {!isClosed && !myApp && !otherTeamApplication && (
          <button
            onClick={() => onEventClick(event)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm"
          >
            エントリー
          </button>
        )}

        {!isClosed && myApp && (
          <button
            onClick={() => onEventClick(event)}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm"
          >
            エントリーを取り消す
          </button>
        )}

        {!isClosed && otherTeamApplication && !myApp && (
          <div className="text-sm text-gray-500 text-center py-2">
            別小隊にエントリー済み
          </div>
        )}

        {isClosed && myApp && (
          <div className="space-y-2">
            <div className={`text-center font-bold py-2 rounded ${
              myApp.result_status === 'participant' ? 'bg-green-100 text-green-800' :
              myApp.result_status === 'candidate' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {myApp.result_status === 'participant' && '参加者に確定'}
              {myApp.result_status === 'candidate' && '候補者に確定'}
              {myApp.result_status === 'rejected' && '落選'}
            </div>
            <button
              onClick={() => onResultClick(event)}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm"
            >
              参加者・候補者一覧
            </button>
          </div>
        )}

        {isClosed && !myApp && (
          <div className="space-y-2">
            <div className="text-center text-gray-600 py-2">
              未エントリー
            </div>
            <button
              onClick={() => onResultClick(event)}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm"
            >
              参加者・候補者一覧
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  if (thisWeekEvents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center text-gray-500">
        今週のイベントはありません
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-lg">
        <h2 className="text-2xl font-bold mb-2">今週のエントリー状況</h2>
        {deadline && (
          <div className="text-sm opacity-90">
            締切日時: {format(deadline, 'yyyy年M月d日(E) HH:mm', { locale: ja })}
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* 砂漠の戦場 */}
        {desertEvents.length > 0 && (
          <div className="border-l-4 border-orange-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xl font-bold">🏜️ 砂漠の戦場</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                getEntryStatus(desertEvents) === 'エントリー中'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {getEntryStatus(desertEvents)}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {renderSquadCard(desertA, 'A', desertApplication || null, desertB && desertApplication?.event_id === desertB.id ? desertApplication : null)}
              {renderSquadCard(desertB, 'B', desertApplication || null, desertA && desertApplication?.event_id === desertA.id ? desertApplication : null)}
            </div>
          </div>
        )}

        {/* 狭間の戦場 */}
        {gapEvents.length > 0 && (
          <div className="border-l-4 border-purple-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xl font-bold">⚔️ 狭間の戦場</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                getEntryStatus(gapEvents) === 'エントリー中'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {getEntryStatus(gapEvents)}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {renderSquadCard(gapA, 'A', gapApplication || null, gapB && gapApplication?.event_id === gapB.id ? gapApplication : null)}
              {renderSquadCard(gapB, 'B', gapApplication || null, gapA && gapApplication?.event_id === gapA.id ? gapApplication : null)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
