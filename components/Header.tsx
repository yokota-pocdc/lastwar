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
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            ラストウォー 抽選アプリ
          </Link>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎟️</span>
              <span className="font-semibold">チケット: {tickets}枚</span>
              <span className="text-xs text-gray-500">(毎月1日リセット)</span>
            </div>

            {user && (
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <span className="font-medium">{user.name}</span>
              </div>
            )}

            <Link
              href="/admin"
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
            >
              管理画面
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
