'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

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
      const res = await fetch(apiUrl('/api/tickets'));
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    }
  };

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <Link href="/" className="text-lg sm:text-2xl font-bold text-blue-600">
            ラストウォー 抽選アプリ
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">🎟️</span>
              <span className="font-semibold text-sm sm:text-base">チケット: {tickets}枚</span>
              <span className="text-xs text-gray-500 hidden sm:inline">(毎月1日リセット)</span>
            </div>

            {user && (
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg">👤</span>
                <span className="font-medium text-sm sm:text-base">{user.name}</span>
              </div>
            )}

            <Link
              href="/admin"
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded-lg transition text-sm sm:text-base whitespace-nowrap"
            >
              管理画面
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
