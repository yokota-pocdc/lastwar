'use client';

import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';

interface SyncStats {
  googleToDB: { created: number; updated: number; errors: any[] };
  dbToGoogle: { created: number; updated: number; errors: any[] };
  inconsistencies: {
    missingInGoogle: any[];
    missingInDB: any[];
    orphanEvents: any[];
    dataMismatches: any[];
  };
}

interface InconsistenciesSummary {
  summary: {
    missingInGoogle: number;
    missingInDB: number;
    orphanEvents: number;
    dataMismatches: number;
    total: number;
  };
  details: {
    missingInGoogle: any[];
    missingInDB: any[];
    orphanEvents: any[];
    dataMismatches: any[];
  };
}

interface WebhookStatus {
  active: boolean;
  webhooks: Array<{
    id: number;
    channel_id: string;
    resource_id: string;
    expiration: string;
    status: string;
  }>;
}

export default function SyncManagement() {
  const [inconsistencies, setInconsistencies] = useState<InconsistenciesSummary | null>(null);
  const [syncResult, setSyncResult] = useState<SyncStats | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');

  // 不整合をチェック
  const checkInconsistencies = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/sync/inconsistencies'));
      const data = await res.json();
      setInconsistencies(data);
    } catch (error) {
      console.error('不整合チェック失敗:', error);
      alert('不整合のチェックに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 同期を実行
  const executiveSync = async () => {
    if (!confirm('双方向同期を実行しますか？\nこの操作により、DBとGoogle Calendarの不整合が修復されます。')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/sync/inconsistencies'), { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);

      // 同期後、再度不整合をチェック
      await checkInconsistencies();

      alert('同期が完了しました');
    } catch (error) {
      console.error('同期実行失敗:', error);
      alert('同期の実行に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // Webhookステータスを確認
  const checkWebhookStatus = async () => {
    try {
      const res = await fetch(apiUrl('/api/sync/webhook'));
      const data = await res.json();
      setWebhookStatus(data);
    } catch (error) {
      console.error('Webhook状態確認失敗:', error);
    }
  };

  // 初回ロード
  useEffect(() => {
    checkInconsistencies();
    checkWebhookStatus();
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">同期管理</h2>

      {/* タブ */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'overview'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          概要
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'details'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('details')}
        >
          詳細
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* 不整合サマリー */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">不整合状態</h3>
              <button
                onClick={checkInconsistencies}
                disabled={loading}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300"
              >
                {loading ? '確認中...' : '再確認'}
              </button>
            </div>

            {inconsistencies && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="text-3xl font-bold text-orange-600">
                    {inconsistencies.summary.missingInGoogle}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Google欠落</div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-3xl font-bold text-blue-600">
                    {inconsistencies.summary.missingInDB}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">DB欠落</div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-600">
                    {inconsistencies.summary.orphanEvents}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">孤立イベント</div>
                </div>

                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="text-3xl font-bold text-red-600">
                    {inconsistencies.summary.dataMismatches}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">データ不一致</div>
                </div>
              </div>
            )}

            {inconsistencies && inconsistencies.summary.total > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">
                  ⚠️ {inconsistencies.summary.total}件の不整合が検出されました
                </p>
                <button
                  onClick={executiveSync}
                  disabled={loading}
                  className="mt-3 px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300"
                >
                  {loading ? '同期中...' : '同期を実行して修復'}
                </button>
              </div>
            )}

            {inconsistencies && inconsistencies.summary.total === 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  ✅ 不整合は検出されませんでした
                </p>
              </div>
            )}
          </div>

          {/* 最後の同期結果 */}
          {syncResult && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-4">最後の同期結果</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Google → DB</h4>
                  <div className="space-y-1 text-sm">
                    <div>作成: {syncResult.googleToDB.created}件</div>
                    <div>更新: {syncResult.googleToDB.updated}件</div>
                    <div className="text-red-600">
                      エラー: {syncResult.googleToDB.errors.length}件
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">DB → Google</h4>
                  <div className="space-y-1 text-sm">
                    <div>作成: {syncResult.dbToGoogle.created}件</div>
                    <div>更新: {syncResult.dbToGoogle.updated}件</div>
                    <div className="text-red-600">
                      エラー: {syncResult.dbToGoogle.errors.length}件
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Webhook状態 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Webhook状態</h3>
              <button
                onClick={checkWebhookStatus}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                更新
              </button>
            </div>

            {webhookStatus && (
              <div className="border rounded-lg p-4">
                {webhookStatus.active ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="font-medium text-green-700">アクティブ</span>
                    </div>
                    {webhookStatus.webhooks.map((webhook) => {
                      const expiration = new Date(webhook.expiration);
                      const now = new Date();
                      const daysLeft = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                      return (
                        <div key={webhook.id} className="text-sm text-gray-600 pl-5">
                          <div>Channel ID: {webhook.channel_id.substring(0, 20)}...</div>
                          <div>
                            有効期限: {expiration.toLocaleString('ja-JP')}
                            {daysLeft < 2 && (
                              <span className="ml-2 text-red-600 font-medium">
                                (残り{daysLeft}日)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="font-medium text-gray-700">非アクティブ</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      リアルタイム同期を有効にするには、SYNC_SETUP.mdを参照してWebhookを設定してください。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'details' && inconsistencies && (
        <div className="space-y-6">
          {/* Google欠落 */}
          {inconsistencies.details.missingInGoogle.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-orange-700">
                Google Calendarに欠落しているイベント ({inconsistencies.details.missingInGoogle.length}件)
              </h3>
              <div className="space-y-2">
                {inconsistencies.details.missingInGoogle.map((event: any) => (
                  <div key={event.id} className="border border-orange-200 rounded p-3 bg-orange-50">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm text-gray-600">
                      日時: {new Date(event.event_date).toLocaleString('ja-JP')} |
                      タイプ: {event.event_type} | チーム: {event.team}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DB欠落 */}
          {inconsistencies.details.missingInDB.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-blue-700">
                DBに欠落しているイベント ({inconsistencies.details.missingInDB.length}件)
              </h3>
              <div className="space-y-2">
                {inconsistencies.details.missingInDB.map((event: any, index: number) => (
                  <div key={index} className="border border-blue-200 rounded p-3 bg-blue-50">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm text-gray-600">
                      日時: {new Date(event.eventDate).toLocaleString('ja-JP')}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Google Event ID: {event.googleEventId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 孤立イベント */}
          {inconsistencies.details.orphanEvents.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-yellow-700">
                孤立イベント ({inconsistencies.details.orphanEvents.length}件)
              </h3>
              <div className="space-y-2">
                {inconsistencies.details.orphanEvents.map((event: any) => (
                  <div key={event.id} className="border border-yellow-200 rounded p-3 bg-yellow-50">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm text-gray-600">
                      日時: {new Date(event.event_date).toLocaleString('ja-JP')} |
                      タイプ: {event.event_type} | チーム: {event.team}
                    </div>
                    <div className="text-xs text-yellow-700 mt-1">
                      Google Event IDがありません（同期実行で自動修復されます）
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* データ不一致 */}
          {inconsistencies.details.dataMismatches.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-red-700">
                データ不一致 ({inconsistencies.details.dataMismatches.length}件)
              </h3>
              <div className="space-y-2">
                {inconsistencies.details.dataMismatches.map((mismatch: any, index: number) => (
                  <div key={index} className="border border-red-200 rounded p-3 bg-red-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-semibold text-gray-700 mb-1">DB</div>
                        <div className="font-medium">{mismatch.db.title}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(mismatch.db.event_date).toLocaleString('ja-JP')}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-700 mb-1">Google</div>
                        <div className="font-medium">{mismatch.google.title}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(mismatch.google.eventDate).toLocaleString('ja-JP')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inconsistencies.summary.total === 0 && (
            <div className="text-center py-8 text-gray-500">
              不整合は検出されていません
            </div>
          )}
        </div>
      )}
    </div>
  );
}
