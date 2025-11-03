'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface HeaderProps {
  user: { id: number; name: string } | null;
}

export default function Header({ user }: HeaderProps) {
  const [tickets, setTickets] = useState(0);

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

  return (
    <header className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg">
      <div className="container mx-auto px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
          {/* タイトル部分 */}
          <Link href="/" className="flex items-center gap-2 text-white hover:text-gray-100 transition">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-white rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-xl sm:text-3xl">🎮</span>
            </div>
            <div className="flex flex-col leading-tight">
              {/* スマホ時は短縮表示 */}
              <span className="text-sm font-bold sm:hidden">申込システム</span>
              <span className="text-xs font-normal opacity-90 sm:hidden">-jfkh-</span>
              {/* PC時は完全表示 */}
              <span className="hidden sm:block text-xl font-bold">イベント参加申込システム <span className="text-base font-normal opacity-90">-jfkh-</span></span>
            </div>
          </Link>

          {/* 右側の情報エリア - スマホでも横並び */}
          <div className="flex flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 bg-white bg-opacity-20 rounded-lg px-2 py-1 sm:px-3 sm:py-2">
              <span className="text-sm sm:text-lg">🎟️</span>
              <span className="font-semibold text-xs sm:text-base text-white whitespace-nowrap">{tickets}枚</span>
            </div>

            {user && (
              <div className="flex items-center gap-1.5 bg-white bg-opacity-20 rounded-lg px-2 py-1 sm:px-3 sm:py-2">
                <span className="text-sm sm:text-lg">👤</span>
                <span className="font-medium text-xs sm:text-base text-white truncate max-w-[80px] sm:max-w-none">{user.name}</span>
              </div>
            )}

            <Link
              href="/admin"
              className="bg-white text-indigo-600 hover:bg-gray-100 px-2 py-1 sm:px-4 sm:py-2 rounded-lg transition text-xs sm:text-base whitespace-nowrap font-semibold shadow-md"
            >
              管理
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
