'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Application {
  id: number;
  user_id: number;
  user_name: string;
  dice1: number;
  dice2: number;
  dice_score: number;
  total_score: number;
  used_ticket: number;
  created_at: string;
  result_status?: string;
}

interface EntryListModalProps {
  eventIds: number[];
  eventType: 'desert' | 'gap';
  onClose: () => void;
}

export default function EntryListModal({ eventIds, eventType, onClose }: EntryListModalProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, [eventIds]);

  const fetchApplications = async () => {
    try {
      // 両チームのイベントIDを取得
      const allApplications: Application[] = [];

      for (const eventId of eventIds) {
        const res = await fetch(`/api/admin/results?eventId=${eventId}`);
        const data = await res.json();
        if (res.ok && data.results) {
          allApplications.push(...data.results);
        }
      }

      // スコア順にソート（降順）、同点の場合は申込日時順（昇順）
      allApplications.sort((a, b) => {
        // スコアで降順
        if (b.total_score !== a.total_score) {
          return b.total_score - a.total_score;
        }
        // スコアが同じ場合は申込日時で昇順
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      setApplications(allApplications);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">
              {eventType === 'desert' ? '🏜️ 砂漠の戦場' : '⚔️ 狭間の戦場'} エントリー一覧
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : applications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              エントリーがありません
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                全{applications.length}件のエントリー
              </div>

              {/* PC用テーブル */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">順位</th>
                      <th className="border p-2 text-left">ユーザー名</th>
                      <th className="border p-2 text-center">点数</th>
                      <th className="border p-2 text-center">サイコロ</th>
                      <th className="border p-2 text-center">チケット</th>
                      <th className="border p-2 text-left">申し込み日時</th>
                      <th className="border p-2 text-center">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app, index) => (
                      <tr key={app.id} className="hover:bg-gray-50">
                        <td className="border p-2 text-center font-bold">
                          {index + 1}
                        </td>
                        <td className="border p-2">{app.user_name}</td>
                        <td className="border p-2 text-center font-bold text-lg">
                          {app.total_score}点
                        </td>
                        <td className="border p-2 text-center">
                          [{app.dice1}] [{app.dice2}]
                        </td>
                        <td className="border p-2 text-center">
                          {app.used_ticket ? '🎟️' : '-'}
                        </td>
                        <td className="border p-2 text-sm">
                          {format(new Date(app.created_at), 'M/d HH:mm', { locale: ja })}
                        </td>
                        <td className="border p-2 text-center">
                          {app.result_status === 'participant' && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">
                              参加者
                            </span>
                          )}
                          {app.result_status === 'candidate' && (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">
                              候補者
                            </span>
                          )}
                          {app.result_status === 'rejected' && (
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                              落選
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* スマホ用カード表示 */}
              <div className="md:hidden space-y-3">
                {applications.map((app, index) => (
                  <div key={app.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-lg">#{index + 1} {app.user_name}</div>
                        <div className="text-xs text-gray-600">
                          {format(new Date(app.created_at), 'M/d HH:mm', { locale: ja })}
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        {app.total_score}点
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        サイコロ: [{app.dice1}] [{app.dice2}]
                      </div>
                      {app.used_ticket === 1 && (
                        <div className="text-yellow-600">🎟️ チケット使用</div>
                      )}
                    </div>
                    {app.result_status && (
                      <div className="mt-2">
                        {app.result_status === 'participant' && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">
                            参加者
                          </span>
                        )}
                        {app.result_status === 'candidate' && (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">
                            候補者
                          </span>
                        )}
                        {app.result_status === 'rejected' && (
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                            落選
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-8 rounded-lg transition"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
