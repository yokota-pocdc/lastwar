import { startOfWeek, addDays, addWeeks, isWithinInterval } from 'date-fns';

/**
 * イベント週の開始時刻を取得（月曜11:00）
 */
export function getEventWeekStart(date: Date): Date {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // 月曜0:00
  weekStart.setHours(11, 0, 0, 0); // 月曜11:00

  // もし現在時刻が月曜0:00～10:59の場合、前週の月曜11:00が開始時刻
  if (date.getDay() === 1 && date.getHours() < 11) {
    return addWeeks(weekStart, -1);
  }

  return weekStart;
}

/**
 * イベント週の終了時刻を取得（次の月曜10:59）
 */
export function getEventWeekEnd(date: Date): Date {
  const weekStart = getEventWeekStart(date);
  const weekEnd = addWeeks(weekStart, 1);
  weekEnd.setHours(10, 59, 59, 999); // 次の月曜10:59

  return weekEnd;
}

/**
 * 今週のイベント期間を取得
 */
export function getCurrentEventWeek(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: getEventWeekStart(now),
    end: getEventWeekEnd(now),
  };
}

/**
 * イベントが今週のものかチェック
 */
export function isEventThisWeek(eventDate: string): boolean {
  const event = new Date(eventDate);
  const { start, end } = getCurrentEventWeek();

  return isWithinInterval(event, { start, end });
}

/**
 * イベントの開催週を取得
 */
export function getEventWeek(eventDate: string): { start: Date; end: Date } {
  const event = new Date(eventDate);
  return {
    start: getEventWeekStart(event),
    end: getEventWeekEnd(event),
  };
}
