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
          // アニメーション時間（2秒）後に結果を表示
          setTimeout(() => {
            setResult(data);
            setTimeout(() => {
              onComplete(data.application);
            }, 2000);
          }, 2000);
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
          // アニメーション時間（2秒）後に結果を表示
          setTimeout(() => {
            setResult({ application: data.application, improved: true });
            setTimeout(() => {
              onComplete(data.application);
            }, 2000);
          }, 2000);
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

  // サイコロの目を描画（1は赤、他は黒）
  const renderDots = (number: number) => {
    const dotPositions: { [key: number]: string[] } = {
      1: ['center'],
      2: ['top-left', 'bottom-right'],
      3: ['top-left', 'center', 'bottom-right'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
    };

    const positions = dotPositions[number] || [];
    // 1の目だけ赤、他は黒
    const dotColor = number === 1 ? 'bg-red-600' : 'bg-gray-900';

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="grid grid-cols-3 grid-rows-3 gap-1 w-12 h-12">
          {['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'].map((pos) => (
            <div key={pos} className="flex items-center justify-center">
              {positions.includes(pos) && (
                <div className={`w-2.5 h-2.5 ${dotColor} rounded-full shadow-md`} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        {!rolling && !result && (
          <>
            <h3 className="text-2xl font-bold mb-4 text-center">
              {applicationId ? 'サイコロ振り直し' : 'サイコロを振る'}
            </h3>

            <div className="mb-4 bg-blue-50 border-2 border-blue-300 p-3 rounded-lg text-center">
              <span className="font-bold text-gray-900">チーム{selectedTeam}に申し込みます</span>
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
                    <div className="font-bold text-gray-900">🎟️ 絶対参加チケットを使用</div>
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
          <div className="text-center py-8">
            <div className="text-xl font-bold mb-6">サイコロを振っています...</div>
            <div className="flex justify-center gap-8">
              {/* サイコロ1 */}
              <div className="dice-container">
                <div className="dice rolling">
                  <div className="face front">{renderDots(1)}</div>
                  <div className="face back">{renderDots(6)}</div>
                  <div className="face right">{renderDots(3)}</div>
                  <div className="face left">{renderDots(4)}</div>
                  <div className="face top">{renderDots(2)}</div>
                  <div className="face bottom">{renderDots(5)}</div>
                </div>
              </div>

              {/* サイコロ2 */}
              <div className="dice-container">
                <div className="dice rolling" style={{ animationDelay: '0.3s' }}>
                  <div className="face front">{renderDots(1)}</div>
                  <div className="face back">{renderDots(6)}</div>
                  <div className="face right">{renderDots(3)}</div>
                  <div className="face left">{renderDots(4)}</div>
                  <div className="face top">{renderDots(2)}</div>
                  <div className="face bottom">{renderDots(5)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="text-center">
            <div className="flex justify-center gap-8 mb-6">
              {/* 結果のサイコロ1 */}
              <div className="dice-container">
                <div className={`dice show-${result.application?.dice1 || result.newDice?.dice1}`}>
                  <div className="face front">{renderDots(1)}</div>
                  <div className="face back">{renderDots(6)}</div>
                  <div className="face right">{renderDots(3)}</div>
                  <div className="face left">{renderDots(4)}</div>
                  <div className="face top">{renderDots(2)}</div>
                  <div className="face bottom">{renderDots(5)}</div>
                </div>
              </div>

              {/* 結果のサイコロ2 */}
              <div className="dice-container">
                <div className={`dice show-${result.application?.dice2 || result.newDice?.dice2}`}>
                  <div className="face front">{renderDots(1)}</div>
                  <div className="face back">{renderDots(6)}</div>
                  <div className="face right">{renderDots(3)}</div>
                  <div className="face left">{renderDots(4)}</div>
                  <div className="face top">{renderDots(2)}</div>
                  <div className="face bottom">{renderDots(5)}</div>
                </div>
              </div>
            </div>

            {result.application?.is_doubles === 1 && (
              <div className="text-2xl font-bold text-red-600 mb-2 animate-pulse">
                ゾロ目! スコア2倍!!
              </div>
            )}

            <div className="text-xl font-bold mb-2 text-gray-900">
              サイコロスコア: {result.application?.dice_score || result.newDice?.score}点
            </div>

            {result.application?.used_ticket === 1 && (
              <div className="bg-yellow-100 border-2 border-yellow-400 p-2 rounded-lg mb-2">
                <span className="text-gray-900">🎟️ チケットボーナス +12点</span>
              </div>
            )}

            <div className="bg-blue-100 border-2 border-blue-400 p-3 rounded-lg mb-4">
              <div className="text-2xl font-bold text-gray-900">
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

      <style jsx>{`
        .dice-container {
          perspective: 1000px;
          width: 80px;
          height: 80px;
        }

        .dice {
          width: 80px;
          height: 80px;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.6s ease-out;
        }

        .dice.rolling {
          animation: roll 2s infinite;
        }

        @keyframes roll {
          0% { transform: rotateX(0) rotateY(0) rotateZ(0); }
          25% { transform: rotateX(360deg) rotateY(180deg) rotateZ(90deg); }
          50% { transform: rotateX(720deg) rotateY(360deg) rotateZ(180deg); }
          75% { transform: rotateX(1080deg) rotateY(540deg) rotateZ(270deg); }
          100% { transform: rotateX(1440deg) rotateY(720deg) rotateZ(360deg); }
        }

        .face {
          position: absolute;
          width: 80px;
          height: 80px;
          background: linear-gradient(145deg, #ffffff, #f3f4f6);
          border: 2px solid #d1d5db;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.8);
        }

        .face.front  { transform: rotateY(0deg) translateZ(40px); }
        .face.back   { transform: rotateY(180deg) translateZ(40px); }
        .face.right  { transform: rotateY(90deg) translateZ(40px); }
        .face.left   { transform: rotateY(-90deg) translateZ(40px); }
        .face.top    { transform: rotateX(90deg) translateZ(40px); }
        .face.bottom { transform: rotateX(-90deg) translateZ(40px); }

        /* 結果表示用の回転角度 */
        .dice.show-1 { transform: rotateX(0deg) rotateY(0deg); }
        .dice.show-2 { transform: rotateX(-90deg) rotateY(0deg); }
        .dice.show-3 { transform: rotateX(0deg) rotateY(90deg); }
        .dice.show-4 { transform: rotateX(0deg) rotateY(-90deg); }
        .dice.show-5 { transform: rotateX(90deg) rotateY(0deg); }
        .dice.show-6 { transform: rotateX(0deg) rotateY(180deg); }
      `}</style>
    </div>
  );
}
