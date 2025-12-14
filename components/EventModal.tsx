'use client';

import { useState, useEffect } from 'react';
import DiceRoller from './DiceRoller';

interface Event {
  id: number;
  title: string;
  event_type: 'desert' | 'gap' | 'irregular';
  event_date: string;
  team?: 'A' | 'B' | null;
  event_group?: string;
  status: 'open' | 'closed' | 'finished';
  lottery_executed?: number;
  google_event_id?: string;
}

interface Application {
  id: number;
  dice1: number;
  dice2: number;
  dice3?: number;
  dice_score: number;
  used_ticket: number;
  total_score: number;
  is_doubles: number;
  rerolled: number;
  preferred_team?: 'A' | 'B' | null;
  result_team?: string;
  result_status?: string;
  result_rank?: number;
}

interface EventModalProps {
  event: Event;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function EventModal({ event, onClose, onRefresh }: EventModalProps) {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDiceRoller, setShowDiceRoller] = useState(false);

  const isIrregular = event.event_type === 'irregular';

  useEffect(() => {
    fetchApplication();
  }, [event.id]);

  const fetchApplication = async () => {
    try {
      const res = await fetch(`/api/applications?eventId=${event.id}`);
      const data = await res.json();
      if (res.ok && data.application) {
        setApplication(data.application);
      }
    } catch (error) {
      console.error('Failed to fetch application:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClick = () => {
    setShowDiceRoller(true);
  };

  const handleApplicationComplete = (newApplication: Application) => {
    setApplication(newApplication);
    setShowDiceRoller(false);
    // 親コンポーネントに変更を通知
    if (onRefresh) {
      onRefresh();
    }
    // モーダルを閉じる
    onClose();
  };

  const handleCancelApplication = async () => {
    if (!application) return;

    if (!confirm('申し込みを取り消しますか？\n\n※この週のサイコロスコアは保持されるため、同じ週の別のイベントに申し込む場合は同じスコアが使用されます。')) {
      return;
    }

    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setApplication(null);
        // 親コンポーネントに変更を通知
        if (onRefresh) {
          onRefresh();
        }
        // モーダルを閉じる
        onClose();
      } else {
        const data = await res.json();
        alert(data.error || '取り消しに失敗しました');
      }
    } catch (error) {
      console.error('Failed to cancel application:', error);
      alert('エラーが発生しました');
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;

    const badges = {
      participant: { text: '参加者', color: 'bg-green-500' },
      candidate: { text: '候補者', color: 'bg-yellow-500' },
      rejected: { text: '落選', color: 'bg-red-500' },
    };

    const badge = badges[status as keyof typeof badges];
    return (
      <span className={`${badge.color} text-white px-3 py-1 rounded-full text-sm font-bold`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">{event.title}</h2>
              <div className="flex gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-white text-sm ${
                  isIrregular
                    ? 'bg-pink-500'
                    : event.event_type === 'desert' ? 'bg-orange-500' : 'bg-purple-500'
                }`}>
                  {isIrregular
                    ? '不定期イベント'
                    : event.event_type === 'desert' ? '砂漠の戦場' : '狭間の戦場'}
                </span>
                <span className={`px-3 py-1 rounded-full text-white text-sm ${
                  event.status === 'open' ? 'bg-green-500' : 'bg-gray-500'
                }`}>
                  {event.status === 'open' ? '受付中' : '受付終了'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          <div className="mb-6 space-y-2">
            <p className="text-gray-600">
              📅 開催日: {new Date(event.event_date).toLocaleString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            {isIrregular ? (
              <div className="text-sm text-pink-600 font-medium">
                <p>⏰ 申込締切: イベント開始時刻まで</p>
                <p className="text-xs text-gray-500 mt-1">
                  ※このイベントはサイコロ3つで順位を決定します。同点の場合は自動抽選で順位が決まります。
                </p>
              </div>
            ) : (
              <p className="text-sm text-orange-600 font-medium">
                ⏰ 申込締切: {(() => {
                  const eventDate = new Date(event.event_date);
                  const eventDateTime = new Date(eventDate);
                  const dayOfWeek = eventDateTime.getDay();
                  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                  const weekStart = new Date(eventDateTime);
                  weekStart.setDate(weekStart.getDate() + daysToMonday);
                  weekStart.setHours(0, 0, 0, 0);

                  // イベントタイプに応じた締切
                  const deadline = new Date(weekStart);
                  if (event.event_type === 'gap') {
                    // 狭間: 日曜日 23:59（週の最後 = 月曜 + 6日）
                    deadline.setDate(deadline.getDate() + 6);
                    deadline.setHours(23, 59, 59, 999);
                  } else {
                    // 砂漠: 火曜日 23:59（月曜 + 1日）
                    deadline.setDate(deadline.getDate() + 1);
                    deadline.setHours(23, 59, 59, 999);
                  }

                  const deadlineText = event.event_type === 'gap' ? '日曜日23:59' : '火曜日23:59';

                  return deadline.toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) + `（連盟ルール: ${deadlineText}）`;
                })()}
              </p>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : application ? (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-4 text-gray-900">あなたの申込内容</h3>

              {/* 定期イベントのチーム表示 */}
              {!isIrregular && application.preferred_team && (
                <div className="mb-3 bg-blue-50 border-2 border-blue-300 p-3 rounded-lg">
                  <span className="font-bold text-gray-900">希望チーム: チーム{application.preferred_team}</span>
                </div>
              )}

              {/* 非定期イベントの順位表示 */}
              {isIrregular && application.result_rank && (
                <div className="mb-3 bg-pink-50 border-2 border-pink-400 p-4 rounded-lg">
                  <div className="text-center">
                    <div className="text-sm text-gray-600">現在の順位</div>
                    <div className="text-3xl font-bold text-pink-600">{application.result_rank}位</div>
                    <div className="text-xs text-gray-500 mt-1">
                      ※同点の場合、最終結果で自動抽選が行われます
                    </div>
                  </div>
                </div>
              )}

              {/* 定期イベントのステータス表示 */}
              {!isIrregular && application.result_status && (
                <div className={`mb-3 p-4 rounded-lg border-2 ${
                  application.result_status === 'participant' ? 'bg-green-50 border-green-400' :
                  application.result_status === 'candidate' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-red-50 border-red-400'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600">現在の状態</div>
                      <div className="text-lg font-bold text-gray-900">
                        {application.result_status === 'participant' && (
                          event.lottery_executed ? '🎉 参加者（確定）' : '✅ 申込済（参加予定）'
                        )}
                        {application.result_status === 'candidate' && '⏳ 候補者'}
                        {application.result_status === 'rejected' && '❌ 落選'}
                      </div>
                    </div>
                    {getStatusBadge(application.result_status)}
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    {application.result_status === 'participant' && (
                      event.lottery_executed
                        ? '参加者として確定しています！'
                        : '申し込みを受け付けました。締切後に抽選または自動確定されます。'
                    )}
                    {application.result_status === 'candidate' && '候補者です。上位者がキャンセルした場合、参加できる可能性があります。'}
                    {application.result_status === 'rejected' && '申込者が多く、残念ながら落選しました。'}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🎲</span>
                  <div>
                    <div className="text-2xl font-bold">
                      [{application.dice1}] [{application.dice2}]
                      {isIrregular && application.dice3 && ` [${application.dice3}]`}
                      {isIrregular ? (
                        <>
                          {application.is_doubles === 2 && (
                            <span className="ml-2 text-red-600">トリプル! ×3</span>
                          )}
                          {application.is_doubles === 1 && (
                            <span className="ml-2 text-orange-600">ゾロ目! ×2</span>
                          )}
                        </>
                      ) : (
                        application.is_doubles === 1 && (
                          <span className="ml-2 text-red-600">ゾロ目! ×2</span>
                        )
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      サイコロスコア: {application.dice_score}点
                    </div>
                  </div>
                </div>

                {!isIrregular && application.used_ticket === 1 && (
                  <div className="bg-yellow-100 border-2 border-yellow-400 p-3 rounded-lg">
                    <span className="text-lg font-bold text-gray-900">🎟️ チケット使用 +12点</span>
                  </div>
                )}

                <div className={`${isIrregular ? 'bg-pink-100 border-pink-400' : 'bg-blue-100 border-blue-400'} border-2 p-4 rounded-lg`}>
                  <div className="text-xl font-bold text-gray-900">
                    合計スコア: {application.total_score}点
                  </div>
                </div>

                {!isIrregular && application.result_status && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="font-semibold">抽選結果:</span>
                    {getStatusBadge(application.result_status)}
                    {application.result_team && (
                      <span className="font-bold">チーム{application.result_team}</span>
                    )}
                  </div>
                )}

                {event.status === 'open' && !event.lottery_executed && (
                  <button
                    onClick={handleCancelApplication}
                    className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition"
                  >
                    ❌ 申し込みを取り消す
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              {event.status === 'open' ? (
                <div className="space-y-4">
                  {isIrregular ? (
                    <>
                      {/* 非定期イベント */}
                      <div className="bg-pink-50 p-4 rounded-lg mb-4">
                        <p className="text-sm text-gray-600 mb-2">このイベントは</p>
                        <div className="inline-block px-6 py-3 rounded-full bg-pink-500 text-white text-xl font-bold">
                          順位決定イベント
                        </div>
                        <p className="text-sm text-gray-600 mt-2">サイコロ3つで順位が決まります</p>
                      </div>
                      <button
                        onClick={handleApplyClick}
                        className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition w-full max-w-md"
                      >
                        🎲 サイコロを3つ振る
                      </button>
                    </>
                  ) : (
                    <>
                      {/* 定期イベント */}
                      <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <p className="text-sm text-gray-600 mb-2">このイベントは</p>
                        <div className={`inline-block px-6 py-3 rounded-full text-white text-xl font-bold ${
                          event.team === 'A' ? 'bg-blue-500' : 'bg-purple-500'
                        }`}>
                          チーム{event.team}
                        </div>
                        <p className="text-sm text-gray-600 mt-2">での参加となります</p>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        ※{event.event_group?.split('-')[0]}の{event.team === 'A' ? 'B' : 'A'}には申し込めません
                      </p>
                      <button
                        onClick={handleApplyClick}
                        className={`${
                          event.team === 'A' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                        } text-white font-bold py-4 px-8 rounded-lg text-xl transition w-full max-w-md`}
                      >
                        🎲 チーム{event.team}に申し込む
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">このイベントは受付を終了しています</p>
              )}
            </div>
          )}

          {showDiceRoller && (
            <DiceRoller
              eventId={event.id}
              selectedTeam={isIrregular ? null : (application?.preferred_team || event.team)}
              eventDate={event.event_date}
              eventType={event.event_type}
              onComplete={handleApplicationComplete}
              onCancel={() => setShowDiceRoller(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
