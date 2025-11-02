import db from '@/lib/db';
import { getWeek, getYear } from 'date-fns';

export interface WeeklyDice {
  id: number;
  user_id: number;
  year: number;
  week: number;
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
export function getWeeklyDice(userId: number, year: number, week: number): WeeklyDice | null {
  const dice = db.prepare(`
    SELECT * FROM user_dice_weekly
    WHERE user_id = ? AND year = ? AND week = ?
  `).get(userId, year, week) as WeeklyDice | undefined;

  return dice || null;
}

/**
 * イベント日から週のサイコロを取得
 */
export function getWeeklyDiceByEventDate(userId: number, eventDate: string): WeeklyDice | null {
  const { year, week } = getWeekInfo(eventDate);
  return getWeeklyDice(userId, year, week);
}

/**
 * 週単位のサイコロを保存または更新
 */
export function saveWeeklyDice(params: {
  userId: number;
  year: number;
  week: number;
  dice1: number;
  dice2: number;
  diceScore: number;
  isDoubles: boolean;
  usedTicket: boolean;
  totalScore: number;
}): WeeklyDice {
  const existing = getWeeklyDice(params.userId, params.year, params.week);

  if (existing) {
    // 更新
    db.prepare(`
      UPDATE user_dice_weekly
      SET dice1 = ?, dice2 = ?, dice_score = ?, is_doubles = ?,
          used_ticket = ?, total_score = ?, updated_at = ?
      WHERE user_id = ? AND year = ? AND week = ?
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
      params.week
    );

    return getWeeklyDice(params.userId, params.year, params.week)!;
  } else {
    // 新規作成
    const result = db.prepare(`
      INSERT INTO user_dice_weekly (
        user_id, year, week, dice1, dice2, dice_score,
        is_doubles, used_ticket, total_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.userId,
      params.year,
      params.week,
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
 * イベント日から週のサイコロを保存
 */
export function saveWeeklyDiceByEventDate(params: {
  userId: number;
  eventDate: string;
  dice1: number;
  dice2: number;
  diceScore: number;
  isDoubles: boolean;
  usedTicket: boolean;
  totalScore: number;
}): WeeklyDice {
  const { year, week } = getWeekInfo(params.eventDate);

  return saveWeeklyDice({
    userId: params.userId,
    year,
    week,
    dice1: params.dice1,
    dice2: params.dice2,
    diceScore: params.diceScore,
    isDoubles: params.isDoubles,
    usedTicket: params.usedTicket,
    totalScore: params.totalScore,
  });
}
