'use client';

import { useState, useEffect } from 'react';
import DiceRoller from './DiceRoller';

interface Event {
  id: number;
  title: string;
  event_type: 'desert' | 'gap';
  event_date: string;
  status: 'open' | 'closed' | 'finished';
  use_team_b: number;
}

interface Application {
  id: number;
  dice1: number;
  dice2: number;
  dice_score: number;
  used_ticket: number;
  total_score: number;
  is_doubles: number;
  rerolled: number;
  result_team?: string;
  result_status?: string;
}

interface EventModalProps {
  event: Event;
  onClose: () => void;
}

export default function EventModal({ event, onClose }: EventModalProps) {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDiceRoller, setShowDiceRoller] = useState(false);

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
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-white text-sm ${
                  event.event_type === 'desert' ? 'bg-orange-500' : 'bg-purple-500'
                }`}>
                  {event.event_type === 'desert' ? '砂漠の戦場' : '狭間の戦場'}
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

          <div className="mb-6">
            <p className="text-gray-600">
              📅 開催日: {new Date(event.event_date).toLocaleDateString('ja-JP')}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : application ? (
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold mb-4">あなたの申込内容</h3>

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🎲</span>
                  <div>
                    <div className="text-2xl font-bold">
                      [{application.dice1}] [{application.dice2}]
                      {application.is_doubles === 1 && (
                        <span className="ml-2 text-red-600">ゾロ目! ×2</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      サイコロスコア: {application.dice_score}点
                    </div>
                  </div>
                </div>

                {application.used_ticket === 1 && (
                  <div className="bg-yellow-100 border-2 border-yellow-400 p-3 rounded-lg">
                    <span className="text-lg font-bold">🎟️ チケット使用 +12点</span>
                  </div>
                )}

                <div className="bg-blue-100 border-2 border-blue-400 p-4 rounded-lg">
                  <div className="text-xl font-bold">
                    合計スコア: {application.total_score}点
                  </div>
                </div>

                {application.result_status && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="font-semibold">抽選結果:</span>
                    {getStatusBadge(application.result_status)}
                    {application.result_team && (
                      <span className="font-bold">チーム{application.result_team}</span>
                    )}
                  </div>
                )}

                {!application.rerolled && event.status === 'open' && (
                  <button
                    onClick={() => setShowDiceRoller(true)}
                    className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition"
                  >
                    🎲 サイコロ振り直し（1回のみ）
                  </button>
                )}

                {application.rerolled && (
                  <div className="text-sm text-gray-500 text-center">
                    既に振り直し済みです
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              {event.status === 'open' ? (
                <button
                  onClick={handleApplyClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition"
                >
                  参加申し込み
                </button>
              ) : (
                <p className="text-gray-500">このイベントは受付を終了しています</p>
              )}
            </div>
          )}

          {showDiceRoller && (
            <DiceRoller
              eventId={event.id}
              applicationId={application?.id}
              onComplete={handleApplicationComplete}
              onCancel={() => setShowDiceRoller(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
