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
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <Link href="/" className="flex items-center gap-3 text-lg sm:text-xl font-bold text-white hover:text-gray-100 transition">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg flex items-center justify-center shadow-md">
              <span className="text-2xl sm:text-3xl">🎮</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
              <span className="text-base sm:text-xl">イベント参加申込システム</span>
              <span className="text-sm sm:text-base font-normal opacity-90">-jfkh-</span>
            </div>
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-white bg-opacity-20 rounded-lg px-3 py-2">
              <span className="text-base sm:text-lg">🎟️</span>
              <span className="font-semibold text-sm sm:text-base text-white">チケット: {tickets}枚</span>
              <span className="text-xs text-gray-200 hidden sm:inline">(毎月1日リセット)</span>
            </div>

            {user && (
              <div className="flex items-center gap-2 bg-white bg-opacity-20 rounded-lg px-3 py-2">
                <span className="text-base sm:text-lg">👤</span>
                <span className="font-medium text-sm sm:text-base text-white">{user.name}</span>
              </div>
            )}

            <Link
              href="/admin"
              className="bg-white text-indigo-600 hover:bg-gray-100 px-3 sm:px-4 py-2 rounded-lg transition text-sm sm:text-base whitespace-nowrap font-semibold shadow-md"
            >
              管理画面
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
