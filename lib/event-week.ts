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

/**
 * エントリー期間かどうかをチェック
 * 砂漠：日曜21:00～火曜21:00
 * 狭間：金曜21:00～日曜21:00
 */
export function isInEntryPeriod(eventType: 'desert' | 'gap', now: Date = new Date()): boolean {
  const dayOfWeek = now.getDay(); // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (eventType === 'desert') {
    // 砂漠：日曜21:00～火曜21:00
    if (dayOfWeek === 0 && hours >= 21) {
      // 日曜21:00以降
      return true;
    }
    if (dayOfWeek === 1) {
      // 月曜日全体
      return true;
    }
    if (dayOfWeek === 2 && hours < 21) {
      // 火曜0:00～20:59
      return true;
    }
    return false;
  } else {
    // 狭間：金曜21:00～日曜21:00
    if (dayOfWeek === 5 && hours >= 21) {
      // 金曜21:00以降
      return true;
    }
    if (dayOfWeek === 6) {
      // 土曜日全体
      return true;
    }
    if (dayOfWeek === 0 && hours < 21) {
      // 日曜0:00～20:59
      return true;
    }
    return false;
  }
}

/**
 * 砂漠イベント用：表示対象週を取得
 * 日曜21:00～月曜10:59の間は翌週のイベントを表示
 * それ以外は今週のイベントを表示
 */
export function getDesertEventTargetWeek(now: Date = new Date()): { start: Date; end: Date } {
  const currentWeek = getCurrentEventWeek();
  const dayOfWeek = now.getDay(); // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  const hours = now.getHours();

  // 日曜21:00～月曜10:59の間は翌週のイベントを対象
  const showNextWeek =
    (dayOfWeek === 0 && hours >= 21) || // 日曜21:00以降
    (dayOfWeek === 1 && hours < 11);    // 月曜0:00～10:59

  if (showNextWeek) {
    // 翌週のイベントを対象
    return {
      start: addWeeks(currentWeek.start, 1),
      end: addWeeks(currentWeek.end, 1),
    };
  } else {
    // 今週のイベント
    return currentWeek;
  }
}

/**
 * 狭間イベント用：表示対象週を取得
 * 金曜21:00～月曜10:59の間は翌週のイベントを表示
 * それ以外は今週のイベントを表示
 */
export function getGapEventTargetWeek(now: Date = new Date()): { start: Date; end: Date } {
  const currentWeek = getCurrentEventWeek();
  const dayOfWeek = now.getDay(); // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  const hours = now.getHours();

  // 金曜21:00～月曜10:59の間は翌週のイベントを対象
  const showNextWeek =
    (dayOfWeek === 5 && hours >= 21) || // 金曜21:00以降
    (dayOfWeek === 6) ||                 // 土曜日全体
    (dayOfWeek === 0) ||                 // 日曜日全体
    (dayOfWeek === 1 && hours < 11);    // 月曜0:00～10:59

  if (showNextWeek) {
    // 翌週のイベントを対象
    return {
      start: addWeeks(currentWeek.start, 1),
      end: addWeeks(currentWeek.end, 1),
    };
  } else {
    // 今週のイベント
    return currentWeek;
  }
}

/**
 * イベントが申し込み可能かチェック
 * 砂漠：日曜21:00～火曜21:00の間に対象週のイベントに申し込める
 * 狭間：金曜21:00～日曜21:00の間に対象週のイベントに申し込める
 */
export function canApplyToEvent(eventDate: string, eventType: 'desert' | 'gap', now: Date = new Date()): boolean {
  // エントリー期間外なら申し込み不可
  if (!isInEntryPeriod(eventType, now)) {
    return false;
  }

  const event = new Date(eventDate);

  if (eventType === 'desert') {
    // 砂漠：対象週のイベントに申し込める
    const targetWeek = getDesertEventTargetWeek(now);
    return isWithinInterval(event, { start: targetWeek.start, end: targetWeek.end });
  } else {
    // 狭間：対象週のイベントに申し込める
    const targetWeek = getGapEventTargetWeek(now);
    return isWithinInterval(event, { start: targetWeek.start, end: targetWeek.end });
  }
}
