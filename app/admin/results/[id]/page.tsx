'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';

interface Result {
  id: number;
  user_name: string;
  dice1: number;
  dice2: number;
  dice_score: number;
  used_ticket: number;
  total_score: number;
  is_doubles: number;
  preferred_team: 'A' | 'B';
  result_team?: string;
  result_status?: string;
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState('');

  useEffect(() => {
    fetchResults();
  }, [resolvedParams.id]);

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/admin/results?eventId=${resolvedParams.id}`);
      const data = await res.json();
      if (res.ok) {
        setResults(data.results);
        if (data.results.length > 0) {
          setEventTitle(data.results[0].event_title);
        }
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['順位', '名前', '希望チーム', 'サイコロ1', 'サイコロ2', 'スコア', 'チケット', '合計', '結果チーム', '状態'];
    const rows = results.map((r, idx) => [
      idx + 1,
      r.user_name,
      r.preferred_team,
      r.dice1,
      r.dice2,
      r.dice_score,
      r.used_ticket ? 'あり(+12)' : 'なし',
      r.total_score,
      r.result_team || '-',
      r.result_status === 'participant' ? '参加者' :
        r.result_status === 'candidate' ? '候補者' : '落選'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `抽選結果_${eventTitle}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return '-';

    const badges = {
      participant: { text: '参加者', color: 'bg-green-500' },
      candidate: { text: '候補者', color: 'bg-yellow-500' },
      rejected: { text: '落選', color: 'bg-red-500' },
    };

    const badge = badges[status as keyof typeof badges];
    return (
      <span className={`${badge.color} text-white px-2 py-1 rounded text-sm`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-purple-600">抽選結果</h1>
            <Link href="/admin" className="text-blue-600 hover:underline">
              ← 管理画面に戻る
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{eventTitle}</h2>
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            📥 CSV出力
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">順位</th>
                <th className="px-4 py-3 text-left">名前</th>
                <th className="px-4 py-3 text-left">希望</th>
                <th className="px-4 py-3 text-left">サイコロ</th>
                <th className="px-4 py-3 text-left">スコア</th>
                <th className="px-4 py-3 text-left">チケット</th>
                <th className="px-4 py-3 text-left">合計</th>
                <th className="px-4 py-3 text-left">結果</th>
                <th className="px-4 py-3 text-left">状態</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={result.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold">{index + 1}</td>
                  <td className="px-4 py-3">{result.user_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-white text-sm font-bold ${
                      result.preferred_team === 'A' ? 'bg-blue-500' : 'bg-purple-500'
                    }`}>
                      {result.preferred_team}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono">
                      [{result.dice1}] [{result.dice2}]
                      {result.is_doubles === 1 && (
                        <span className="ml-1 text-red-600 text-xs">×2</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">{result.dice_score}</td>
                  <td className="px-4 py-3">
                    {result.used_ticket === 1 ? (
                      <span className="text-yellow-600 font-bold">+12</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-lg">{result.total_score}</span>
                  </td>
                  <td className="px-4 py-3">
                    {result.result_team ? (
                      <span className="font-bold">チーム{result.result_team}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(result.result_status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {results.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              まだ申込者がいません
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold mb-2">📊 統計</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">総申込者数</div>
              <div className="text-2xl font-bold">{results.length}人</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">参加者</div>
              <div className="text-2xl font-bold text-green-600">
                {results.filter(r => r.result_status === 'participant').length}人
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">候補者</div>
              <div className="text-2xl font-bold text-yellow-600">
                {results.filter(r => r.result_status === 'candidate').length}人
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">落選</div>
              <div className="text-2xl font-bold text-red-600">
                {results.filter(r => r.result_status === 'rejected').length}人
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
