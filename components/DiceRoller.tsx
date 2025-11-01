'use client';

import { useState, useEffect } from 'react';

interface DiceRollerProps {
  eventId: number;
  applicationId?: number;
  selectedTeam: 'A' | 'B';
  onComplete: (application: any) => void;
  onCancel: () => void;
}

export default function DiceRoller({ eventId, applicationId, selectedTeam, onComplete, onCancel }: DiceRollerProps) {
  const [tickets, setTickets] = useState(0);
  const [useTicket, setUseTicket] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets');
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    }
  };

  const handleRoll = async () => {
    setRolling(true);

    try {
      if (applicationId) {
        // 振り直し
        const res = await fetch(`/api/applications/${applicationId}/reroll`, {
          method: 'POST',
        });
        const data = await res.json();

        if (res.ok) {
          setResult(data);
          setTimeout(() => {
            onComplete(data.application);
          }, 3000);
        } else {
          alert(data.error || '振り直しに失敗しました');
          setRolling(false);
        }
      } else {
        // 新規申込
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            useTicket,
            preferredTeam: selectedTeam,
          }),
        });
        const data = await res.json();

        if (res.ok) {
          setResult({ application: data.application, improved: true });
          setTimeout(() => {
            onComplete(data.application);
          }, 3000);
        } else {
          alert(data.error || '申込に失敗しました');
          setRolling(false);
        }
      }
    } catch (error) {
      console.error('Roll failed:', error);
      alert('エラーが発生しました');
      setRolling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        {!rolling && !result && (
          <>
            <h3 className="text-2xl font-bold mb-4 text-center">
              {applicationId ? 'サイコロ振り直し' : 'サイコロを振る'}
            </h3>

            <div className="mb-4 bg-blue-50 border-2 border-blue-300 p-3 rounded-lg text-center">
              <span className="font-bold">チーム{selectedTeam}に申し込みます</span>
            </div>

            {!applicationId && tickets > 0 && (
              <div className="mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useTicket}
                    onChange={(e) => setUseTicket(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <div>
                    <div className="font-bold">🎟️ 絶対参加チケットを使用</div>
                    <div className="text-sm text-gray-600">
                      +12点ボーナス（残り{tickets}枚）
                    </div>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRoll}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition"
              >
                🎲 振る
              </button>
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition"
              >
                キャンセル
              </button>
            </div>
          </>
        )}

        {rolling && !result && (
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">🎲🎲</div>
            <div className="text-xl font-bold">振っています...</div>
          </div>
        )}

        {result && (
          <div className="text-center">
            <div className="text-6xl mb-4">
              [{result.application?.dice1 || result.newDice?.dice1}]{' '}
              [{result.application?.dice2 || result.newDice?.dice2}]
            </div>

            {result.application?.is_doubles === 1 && (
              <div className="text-2xl font-bold text-red-600 mb-2">
                ゾロ目! スコア2倍!!
              </div>
            )}

            <div className="text-xl font-bold mb-2">
              サイコロスコア: {result.application?.dice_score || result.newDice?.score}点
            </div>

            {result.application?.used_ticket === 1 && (
              <div className="bg-yellow-100 border-2 border-yellow-400 p-2 rounded-lg mb-2">
                🎟️ チケットボーナス +12点
              </div>
            )}

            <div className="bg-blue-100 border-2 border-blue-400 p-3 rounded-lg mb-4">
              <div className="text-2xl font-bold">
                合計スコア: {result.application?.total_score}点
              </div>
            </div>

            {result.improved === false && (
              <div className="text-sm text-orange-600">
                前回のスコアの方が高かったため、そのまま維持されました
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
