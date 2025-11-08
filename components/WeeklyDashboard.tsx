'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, isWithinInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import EntryListModal from './EntryListModal';
import { getCurrentEventWeek, getGapEventTargetWeek, isInEntryPeriod } from '@/lib/event-week';

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
  refreshKey?: number;
}

export default function WeeklyDashboard({ onEventClick, onResultClick, refreshKey }: WeeklyDashboardProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsCount, setApplicationsCount] = useState<{ [key: number]: number }>({});
  const [loading, setLoading] = useState(true);
  const [showEntryList, setShowEntryList] = useState<{ type: 'desert' | 'gap', eventIds: number[] } | null>(null);

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

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

      // 締切日時は各戦場タイプで異なるため、セクション別に表示
      // 砂漠: 火曜23:59、狭間: 日曜23:59

    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 砂漠イベント：今週のイベント
  const currentWeek = getCurrentEventWeek();
  const desertEvents = events.filter(event => {
    if (event.event_type !== 'desert') return false;
    const eventDate = new Date(event.event_date);
    return isWithinInterval(eventDate, { start: currentWeek.start, end: currentWeek.end });
  });

  // 狭間イベント：土日エントリー期間中は来週、それ以外は今週
  const gapTargetWeek = getGapEventTargetWeek();
  const gapEvents = events.filter(event => {
    if (event.event_type !== 'gap') return false;
    const eventDate = new Date(event.event_date);
    return isWithinInterval(eventDate, { start: gapTargetWeek.start, end: gapTargetWeek.end });
  });

  const desertA = desertEvents.find(e => e.team === 'A');
  const desertB = desertEvents.find(e => e.team === 'B');
  const gapA = gapEvents.find(e => e.team === 'A');
  const gapB = gapEvents.find(e => e.team === 'B');

  // エントリー期間チェック
  // 砂漠：月曜11:00～火曜23:59
  // 狭間：土曜11:00～日曜23:59
  const isEntryOpen = (eventType: 'desert' | 'gap'): boolean => {
    return isInEntryPeriod(eventType);
  };

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

  // エントリー状況を判定（エントリー期間で判定）
  const getEntryStatus = (eventType: 'desert' | 'gap', events: Event[]) => {
    if (events.length === 0) return '未開催';
    // エントリー期間内なら「受付中」、それ以外は「締切済」
    if (isEntryOpen(eventType)) return '受付中';
    return '締切済';
  };

  const renderSquadCard = (
    event: Event | undefined,
    team: 'A' | 'B',
    myApplication: Application | null,
    otherTeamApplication: Application | null,
    eventType: 'desert' | 'gap',
    allEvents: Event[]
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
    const isClosed = !isEntryOpen(event.event_type);

    return (
      <div className="flex-1 min-w-0 bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-lg p-2 sm:p-3 shadow-sm hover:shadow-md transition-shadow">
        <div className="font-bold text-base sm:text-lg mb-1 text-gray-800">小隊{team}</div>
        <div className="text-xs sm:text-sm text-gray-600 mb-1">
          {format(eventDate, 'M/d(E) HH:mm', { locale: ja })}
        </div>
        <div className="text-xs sm:text-sm text-gray-600 mb-2">
          エントリー済:{count}人
        </div>

        {!isClosed && !myApplication && !otherTeamApplication && (
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onEventClick(event)}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-1.5 px-2 rounded-lg transition shadow-md text-xs sm:text-sm"
            >
              エントリー
            </button>
            <button
              onClick={() => setShowEntryList({
                type: eventType,
                eventIds: [event.id]
              })}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-1.5 px-2 rounded-lg transition border border-gray-300 text-xs sm:text-sm"
            >
              一覧
            </button>
          </div>
        )}

        {!isClosed && myApplication && (
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onEventClick(event)}
              className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold py-1.5 px-2 rounded-lg transition shadow-md text-xs sm:text-sm"
            >
              取消
            </button>
            <button
              onClick={() => setShowEntryList({
                type: eventType,
                eventIds: [event.id]
              })}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-1.5 px-2 rounded-lg transition border border-gray-300 text-xs sm:text-sm"
            >
              一覧
            </button>
          </div>
        )}

        {!isClosed && otherTeamApplication && !myApplication && (
          <div className="flex flex-col gap-1">
            <div className="text-xs text-gray-500 text-center py-1 bg-gray-50 rounded-lg">
              別小隊済
            </div>
            <button
              onClick={() => setShowEntryList({
                type: eventType,
                eventIds: [event.id]
              })}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-1.5 px-2 rounded-lg transition border border-gray-300 text-xs sm:text-sm"
            >
              一覧
            </button>
          </div>
        )}

        {isClosed && myApplication && (
          <div className="flex flex-col gap-1">
            <div className={`text-center font-bold py-1 text-xs sm:text-sm rounded-lg shadow-sm border ${
              myApplication.result_status === 'participant' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
              myApplication.result_status === 'candidate' ? 'bg-amber-100 text-amber-800 border-amber-300' :
              'bg-rose-100 text-rose-800 border-rose-300'
            }`}>
              {myApplication.result_status === 'participant' && '✓ 参加者'}
              {myApplication.result_status === 'candidate' && '⏳ 候補者'}
              {myApplication.result_status === 'rejected' && '✗ 落選'}
            </div>
            <button
              onClick={() => setShowEntryList({
                type: eventType,
                eventIds: [event.id]
              })}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white font-semibold py-1.5 px-2 rounded-lg transition shadow-sm text-xs sm:text-sm"
            >
              一覧
            </button>
          </div>
        )}

        {isClosed && !myApplication && (
          <div className="flex flex-col gap-1">
            <div className="text-center text-gray-600 text-xs py-1 bg-gray-50 rounded-lg">
              未エントリー
            </div>
            <button
              onClick={() => setShowEntryList({
                type: eventType,
                eventIds: [event.id]
              })}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white font-semibold py-1.5 px-2 rounded-lg transition shadow-sm text-xs sm:text-sm"
            >
              一覧
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  if (desertEvents.length === 0 && gapEvents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center text-gray-500">
        エントリー可能なイベントがありません
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-lg shadow-md">
        <h2 className="text-2xl font-bold mb-2">今週のエントリー状況</h2>
        <div className="text-sm opacity-90">
          <div>🏜️ 砂漠: 日曜21:00～火曜21:00</div>
          <div>⚔️ 狭間: 金曜21:00～日曜21:00</div>
        </div>
      </div>

      <div className="p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white">
        {/* 砂漠の戦場 */}
        {desertEvents.length > 0 && (
          <div className="border-l-4 border-amber-500 pl-4 bg-white rounded-r-lg py-3 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xl font-bold text-gray-800">🏜️ 砂漠の戦場</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold shadow-sm ${
                getEntryStatus('desert', desertEvents) === '受付中'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}>
                {getEntryStatus('desert', desertEvents)}
              </span>
            </div>

            <div className="flex flex-row gap-2 sm:gap-4">
              {renderSquadCard(
                desertA,
                'A',
                desertApplication && desertApplication.event_id === desertA?.id ? desertApplication : null,
                desertApplication && desertApplication.event_id === desertB?.id ? desertApplication : null,
                'desert',
                desertEvents
              )}
              {renderSquadCard(
                desertB,
                'B',
                desertApplication && desertApplication.event_id === desertB?.id ? desertApplication : null,
                desertApplication && desertApplication.event_id === desertA?.id ? desertApplication : null,
                'desert',
                desertEvents
              )}
            </div>
          </div>
        )}

        {/* 狭間の戦場 */}
        {gapEvents.length > 0 && (
          <div className="border-l-4 border-violet-500 pl-4 bg-white rounded-r-lg py-3 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xl font-bold text-gray-800">⚔️ 狭間の戦場</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold shadow-sm ${
                getEntryStatus('gap', gapEvents) === '受付中'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}>
                {getEntryStatus('gap', gapEvents)}
              </span>
            </div>

            <div className="flex flex-row gap-2 sm:gap-4">
              {renderSquadCard(
                gapA,
                'A',
                gapApplication && gapApplication.event_id === gapA?.id ? gapApplication : null,
                gapApplication && gapApplication.event_id === gapB?.id ? gapApplication : null,
                'gap',
                gapEvents
              )}
              {renderSquadCard(
                gapB,
                'B',
                gapApplication && gapApplication.event_id === gapB?.id ? gapApplication : null,
                gapApplication && gapApplication.event_id === gapA?.id ? gapApplication : null,
                'gap',
                gapEvents
              )}
            </div>
          </div>
        )}
      </div>

      {/* エントリー一覧モーダル */}
      {showEntryList && (
        <EntryListModal
          eventIds={showEntryList.eventIds}
          eventType={showEntryList.type}
          onClose={() => setShowEntryList(null)}
        />
      )}
    </div>
  );
}
