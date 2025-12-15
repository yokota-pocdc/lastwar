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
 * 砂漠：月曜11:00～火曜23:59
 * 狭間：土曜11:00～日曜23:59
 */
export function isInEntryPeriod(eventType: 'desert' | 'gap', now: Date = new Date()): boolean {
  const dayOfWeek = now.getDay(); // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (eventType === 'desert') {
    // 砂漠：月曜11:00～火曜23:59
    if (dayOfWeek === 1 && hours >= 11) {
      // 月曜11:00以降
      return true;
    }
    if (dayOfWeek === 2) {
      // 火曜日全体（23:59まで）
      return true;
    }
    return false;
  } else {
    // 狭間：土曜11:00～日曜23:59
    if (dayOfWeek === 6 && hours >= 11) {
      // 土曜11:00以降
      return true;
    }
    if (dayOfWeek === 0) {
      // 日曜日全体（23:59まで）
      return true;
    }
    return false;
  }
}

/**
 * 狭間イベント用：表示対象週を取得
 * 土曜11:00～日曜23:59の間は翌週のイベントを表示
 * それ以外は今週のイベントを表示
 */
export function getGapEventTargetWeek(now: Date = new Date()): { start: Date; end: Date } {
  const currentWeek = getCurrentEventWeek();

  if (isInEntryPeriod('gap', now)) {
    // エントリー期間中（土曜11:00～日曜23:59）は翌週のイベントを対象
    return {
      start: addWeeks(currentWeek.start, 1),
      end: addWeeks(currentWeek.end, 1),
    };
  } else {
    // それ以外は今週のイベント
    return currentWeek;
  }
}

/**
 * イベントが申し込み可能かチェック
 * 砂漠：月曜11:00～火曜23:59の間に今週のイベントに申し込める
 * 狭間：土曜11:00～日曜23:59の間に来週のイベントに申し込める
 * 不定期：イベント開始時刻まで申し込み可能
 */
export function canApplyToEvent(eventDate: string, eventType: 'desert' | 'gap' | 'irregular', now: Date = new Date()): boolean {
  // 不定期イベントの場合はイベント開始時刻まで申し込み可能
  if (eventType === 'irregular') {
    return canApplyToIrregularEvent(eventDate, now);
  }

  // エントリー期間外なら申し込み不可
  if (!isInEntryPeriod(eventType, now)) {
    return false;
  }

  const event = new Date(eventDate);

  if (eventType === 'desert') {
    // 砂漠：今週のイベントに申し込める
    const currentWeek = getCurrentEventWeek();
    return isWithinInterval(event, { start: currentWeek.start, end: currentWeek.end });
  } else {
    // 狭間：来週のイベントに申し込める
    const currentWeek = getCurrentEventWeek();
    const nextWeek = {
      start: addWeeks(currentWeek.start, 1),
      end: addWeeks(currentWeek.end, 1),
    };
    return isWithinInterval(event, { start: nextWeek.start, end: nextWeek.end });
  }
}

/**
 * 不定期イベントに申し込み可能かチェック
 * イベント開始時刻まで申し込み可能
 */
export function canApplyToIrregularEvent(eventDate: string, now: Date = new Date()): boolean {
  const eventDateTime = new Date(eventDate);
  return now < eventDateTime;
}

/**
 * 不定期イベントが表示対象かチェック
 * イベント日時を過ぎたら非表示
 */
export function shouldShowIrregularEvent(eventDate: string, now: Date = new Date()): boolean {
  const eventDateTime = new Date(eventDate);
  return now < eventDateTime;
}
