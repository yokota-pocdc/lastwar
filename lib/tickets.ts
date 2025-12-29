import db from './db';
import { startOfMonth, addMonths } from 'date-fns';

// チケットリセット確認・実行
export function checkAndResetTickets(userId: number): void {
  const user = db.prepare('SELECT tickets_reset_date FROM users WHERE id = ?').get(userId) as { tickets_reset_date: string } | undefined;

  if (!user) return;

  const now = new Date();
  const resetDate = new Date(user.tickets_reset_date);

  if (now >= resetDate) {
    // チケットをリセット
    const nextResetDate = addMonths(startOfMonth(now), 1).toISOString().split('T')[0];
    db.prepare(`
      UPDATE users
      SET tickets_remaining = 2,
          tickets_reset_date = ?
      WHERE id = ?
    `).run(nextResetDate, userId);
  }
}

// チケット残数取得
export function getRemainingTickets(userId: number): number {
  checkAndResetTickets(userId);
  const user = db.prepare('SELECT tickets_remaining FROM users WHERE id = ?').get(userId) as { tickets_remaining: number } | undefined;
  return user?.tickets_remaining || 0;
}

// チケット使用
export function useTicket(userId: number): boolean {
  checkAndResetTickets(userId);
  const remaining = getRemainingTickets(userId);

  if (remaining > 0) {
    db.prepare('UPDATE users SET tickets_remaining = tickets_remaining - 1 WHERE id = ?').run(userId);
    return true;
  }
  return false;
}

// チケット返却（エントリー削除時に使用）
export function refundTicket(userId: number): void {
  db.prepare('UPDATE users SET tickets_remaining = tickets_remaining + 1 WHERE id = ?').run(userId);
}
