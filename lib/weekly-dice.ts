import db from '@/lib/db';
import { getWeek, getYear } from 'date-fns';

export interface WeeklyDice {
  id: number;
  user_id: number;
  year: number;
  week: number;
  event_type: 'desert' | 'gap';
  dice1: number;
  dice2: number;
  dice_score: number;
  is_doubles: number;
  used_ticket: number;
  total_score: number;
  created_at: string;
  updated_at: string;
}

/**
 * イベント日から週情報を取得
 */
export function getWeekInfo(eventDate: string): { year: number; week: number } {
  const date = new Date(eventDate);
  const year = getYear(date);
  const week = getWeek(date, { weekStartsOn: 1 }); // 月曜日始まり
  return { year, week };
}

/**
 * 特定の週のサイコロを取得
 */
export function getWeeklyDice(userId: number, year: number, week: number, eventType: 'desert' | 'gap'): WeeklyDice | null {
  const dice = db.prepare(`
    SELECT * FROM user_dice_weekly
    WHERE user_id = ? AND year = ? AND week = ? AND event_type = ?
  `).get(userId, year, week, eventType) as WeeklyDice | undefined;

  return dice || null;
}

/**
 * 週単位のサイコロを保存または更新
 */
export function saveWeeklyDice(params: {
  userId: number;
  year: number;
  week: number;
  eventType: 'desert' | 'gap';
  dice1: number;
  dice2: number;
  diceScore: number;
  isDoubles: boolean;
  usedTicket: boolean;
  totalScore: number;
}): WeeklyDice {
  const existing = getWeeklyDice(params.userId, params.year, params.week, params.eventType);

  if (existing) {
    // 更新
    db.prepare(`
      UPDATE user_dice_weekly
      SET dice1 = ?, dice2 = ?, dice_score = ?, is_doubles = ?,
          used_ticket = ?, total_score = ?, updated_at = ?
      WHERE user_id = ? AND year = ? AND week = ? AND event_type = ?
    `).run(
      params.dice1,
      params.dice2,
      params.diceScore,
      params.isDoubles ? 1 : 0,
      params.usedTicket ? 1 : 0,
      params.totalScore,
      new Date().toISOString(),
      params.userId,
      params.year,
      params.week,
      params.eventType
    );

    return getWeeklyDice(params.userId, params.year, params.week, params.eventType)!;
  } else {
    // 新規作成
    const result = db.prepare(`
      INSERT INTO user_dice_weekly (
        user_id, year, week, event_type, dice1, dice2, dice_score,
        is_doubles, used_ticket, total_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.userId,
      params.year,
      params.week,
      params.eventType,
      params.dice1,
      params.dice2,
      params.diceScore,
      params.isDoubles ? 1 : 0,
      params.usedTicket ? 1 : 0,
      params.totalScore
    );

    return db.prepare('SELECT * FROM user_dice_weekly WHERE id = ?').get(result.lastInsertRowid) as WeeklyDice;
  }
}

/**
 * 週単位のサイコロ記録を削除
 */
export function deleteWeeklyDice(userId: number, year: number, week: number, eventType: 'desert' | 'gap'): void {
  db.prepare(`
    DELETE FROM user_dice_weekly
    WHERE user_id = ? AND year = ? AND week = ? AND event_type = ?
  `).run(userId, year, week, eventType);
}
