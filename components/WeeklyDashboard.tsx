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
}

export default function WeeklyDashboard({ onEventClick, onResultClick }: WeeklyDashboardProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsCount, setApplicationsCount] = useState<{ [key: number]: number }>({});
  const [loading, setLoading] = useState(true);
  const [showEntryList, setShowEntryList] = useState<{ type: 'desert' | 'gap', eventIds: number[] } | null>(null);

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
    // エントリー期間内なら「エントリー中」、それ以外は「締切済」
    if (isEntryOpen(eventType)) return 'エントリー中';
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
    const isClosed = !isEntryOpen(event.event_type);

    return (
      <div className="flex-1 min-w-0 bg-white border-2 border-gray-200 rounded-lg p-4">
        <div className="font-bold text-lg mb-2">小隊{team}</div>
        <div className="text-sm text-gray-600 mb-1">
          {format(eventDate, 'M/d(E) HH:mm', { locale: ja })}
        </div>
        <div className="text-sm text-gray-600 mb-3">
          エントリー人数: {count}人
        </div>

        {!isClosed && !myApplication && !otherTeamApplication && (
          <button
            onClick={() => onEventClick(event)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm"
          >
            エントリー
          </button>
        )}

        {!isClosed && myApplication && (
          <button
            onClick={() => onEventClick(event)}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm"
          >
            エントリーを取り消す
          </button>
        )}

        {!isClosed && otherTeamApplication && !myApplication && (
          <div className="text-sm text-gray-500 text-center py-2">
            別小隊にエントリー済み
          </div>
        )}

        {isClosed && myApplication && (
          <div className="space-y-2">
            <div className={`text-center font-bold py-2 rounded ${
              myApplication.result_status === 'participant' ? 'bg-green-100 text-green-800' :
              myApplication.result_status === 'candidate' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {myApplication.result_status === 'participant' && '参加者に確定'}
              {myApplication.result_status === 'candidate' && '候補者に確定'}
              {myApplication.result_status === 'rejected' && '落選'}
            </div>
            <button
              onClick={() => onResultClick(event)}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm"
            >
              参加者・候補者一覧
            </button>
          </div>
        )}

        {isClosed && !myApplication && (
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
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-lg">
        <h2 className="text-2xl font-bold mb-2">今週のエントリー状況</h2>
        <div className="text-sm opacity-90">
          <div>🏜️ 砂漠: 月曜11:00～火曜23:59</div>
          <div>⚔️ 狭間: 土曜11:00～日曜23:59（翌週イベント）</div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 砂漠の戦場 */}
        {desertEvents.length > 0 && (
          <div className="border-l-4 border-orange-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xl font-bold">🏜️ 砂漠の戦場</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                getEntryStatus('desert', desertEvents) === 'エントリー中'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {getEntryStatus('desert', desertEvents)}
              </span>
              {getEntryStatus('desert', desertEvents) === 'エントリー中' && (
                <button
                  onClick={() => setShowEntryList({
                    type: 'desert',
                    eventIds: desertEvents.map(e => e.id)
                  })}
                  className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition"
                >
                  📋 エントリー一覧
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {renderSquadCard(
                desertA,
                'A',
                desertApplication && desertApplication.event_id === desertA?.id ? desertApplication : null,
                desertApplication && desertApplication.event_id === desertB?.id ? desertApplication : null
              )}
              {renderSquadCard(
                desertB,
                'B',
                desertApplication && desertApplication.event_id === desertB?.id ? desertApplication : null,
                desertApplication && desertApplication.event_id === desertA?.id ? desertApplication : null
              )}
            </div>
          </div>
        )}

        {/* 狭間の戦場 */}
        {gapEvents.length > 0 && (
          <div className="border-l-4 border-purple-500 pl-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xl font-bold">⚔️ 狭間の戦場</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                getEntryStatus('gap', gapEvents) === 'エントリー中'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {getEntryStatus('gap', gapEvents)}
              </span>
              {getEntryStatus('gap', gapEvents) === 'エントリー中' && (
                <button
                  onClick={() => setShowEntryList({
                    type: 'gap',
                    eventIds: gapEvents.map(e => e.id)
                  })}
                  className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition"
                >
                  📋 エントリー一覧
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {renderSquadCard(
                gapA,
                'A',
                gapApplication && gapApplication.event_id === gapA?.id ? gapApplication : null,
                gapApplication && gapApplication.event_id === gapB?.id ? gapApplication : null
              )}
              {renderSquadCard(
                gapB,
                'B',
                gapApplication && gapApplication.event_id === gapB?.id ? gapApplication : null,
                gapApplication && gapApplication.event_id === gapA?.id ? gapApplication : null
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
