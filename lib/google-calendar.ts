import { google } from 'googleapis';
import { addDays, format, getWeek, getYear } from 'date-fns';

// Google Calendar APIクライアントの初期化
function getCalendarClient(readOnly = true) {
  const scopes = readOnly
    ? ['https://www.googleapis.com/auth/calendar.readonly']
    : ['https://www.googleapis.com/auth/calendar'];

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes,
  });

  return google.calendar({ version: 'v3', auth });
}

// イベントの種別を判定（週情報を含む）
export function parseEventType(title: string, eventDate?: string): {
  type: 'desert' | 'gap' | null;
  team: 'A' | 'B' | null;
  group: string | null;
  baseGroup: string | null;
} {
  const titleLower = title.toLowerCase();
  let baseGroup: string | null = null;
  let type: 'desert' | 'gap' | null = null;
  let team: 'A' | 'B' | null = null;

  // 括弧内のパターンを優先的にチェック: (砂漠A), (狭間B) など
  const bracketMatch = title.match(/\(([^)]+)\)/);
  const bracketContent = bracketMatch ? bracketMatch[1] : '';

  // 括弧内、または全体のタイトルから判定
  const checkText = bracketContent || title;

  // 砂漠A
  if (checkText.includes('砂漠A') || checkText.toLowerCase().includes('sabakua')) {
    type = 'desert';
    team = 'A';
    baseGroup = '砂漠';
  }
  // 砂漠B
  else if (checkText.includes('砂漠B') || checkText.toLowerCase().includes('sabakub')) {
    type = 'desert';
    team = 'B';
    baseGroup = '砂漠';
  }
  // 狭間A
  else if (checkText.includes('狭間A') || checkText.toLowerCase().includes('hasamaa')) {
    type = 'gap';
    team = 'A';
    baseGroup = '狭間';
  }
  // 狭間B
  else if (checkText.includes('狭間B') || checkText.toLowerCase().includes('hasamab')) {
    type = 'gap';
    team = 'B';
    baseGroup = '狭間';
  }

  // 週情報を含めたグループ名を生成
  let group: string | null = null;
  if (baseGroup && eventDate) {
    const date = new Date(eventDate);
    const year = getYear(date);
    const week = getWeek(date, { weekStartsOn: 1 }); // 月曜日を週の開始とする
    group = `${baseGroup}-${year}W${week.toString().padStart(2, '0')}`;
  } else {
    group = baseGroup;
  }

  return { type, team, group, baseGroup };
}

// Googleカレンダーからイベントを取得
export async function fetchCalendarEvents() {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID is not set');
    }

    // 今日から120日後（約4ヶ月）までのイベントを取得
    const now = new Date();
    const endDate = addDays(now, 120);

    const response = await calendar.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // イベントをフィルタリングして変換
    const parsedEvents = events
      .map((event) => {
        const title = event.summary || '';
        const startDateTime = event.start?.dateTime || event.start?.date;
        if (!startDateTime) {
          return null;
        }

        const parsed = parseEventType(title, startDateTime);

        if (!parsed.type || !parsed.team) {
          return null; // 対象外のイベントは無視
        }

        return {
          title,
          eventType: parsed.type,
          team: parsed.team,
          group: parsed.group,
          eventDate: startDateTime,
          googleEventId: event.id,
          description: event.description || '',
        };
      })
      .filter((e) => e !== null);

    return parsedEvents;
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    throw error;
  }
}

// イベントをデータベースに同期
export async function syncCalendarEvents(db: any) {
  const events = await fetchCalendarEvents();

  for (const event of events) {
    if (!event) continue;

    // 既存のイベントを確認
    const existing = db
      .prepare('SELECT * FROM events WHERE google_event_id = ?')
      .get(event.googleEventId);

    if (!existing) {
      // 新規作成
      db.prepare(`
        INSERT INTO events (
          title, event_type, team, event_group, event_date,
          google_event_id, status, use_team_b
        ) VALUES (?, ?, ?, ?, ?, ?, 'open', 0)
      `).run(
        event.title,
        event.eventType,
        event.team,
        event.group,
        event.eventDate,
        event.googleEventId
      );
    } else {
      // 更新
      db.prepare(`
        UPDATE events
        SET title = ?, event_date = ?, event_type = ?, team = ?, event_group = ?
        WHERE google_event_id = ?
      `).run(
        event.title,
        event.eventDate,
        event.eventType,
        event.team,
        event.group,
        event.googleEventId
      );
    }
  }

  console.log(`Synced ${events.length} events from Google Calendar`);
  return events;
}

// Googleカレンダーにイベントを作成
export async function createCalendarEvent(params: {
  title: string;
  eventType: 'desert' | 'gap';
  team: 'A' | 'B';
  eventDate: string; // ISO 8601形式
  description?: string;
}) {
  try {
    const calendar = getCalendarClient(false); // 書き込み権限
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID is not set');
    }

    // datetime-local形式（例: "2025-11-26T21:57"）を正しいISO 8601形式に変換
    let startDateTime = params.eventDate;
    if (!startDateTime.includes(':00') || startDateTime.length < 19) {
      // 秒が含まれていない場合は追加
      startDateTime = startDateTime.includes('T') ? `${startDateTime}:00` : startDateTime;
    }

    // 開始時刻と終了時刻（30分後）を計算
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30分後

    // RFC 3339形式に変換（Googleカレンダーが要求する形式）
    const formatToRFC3339 = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    const event = {
      summary: params.title,
      description: params.description || '',
      start: {
        dateTime: formatToRFC3339(startDate),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: formatToRFC3339(endDate),
        timeZone: 'Asia/Tokyo',
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    console.log(`Created event in Google Calendar: ${response.data.id}`);

    return {
      googleEventId: response.data.id,
      htmlLink: response.data.htmlLink,
    };
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    throw error;
  }
}

// Googleカレンダーのイベントを更新
export async function updateCalendarEvent(params: {
  googleEventId: string;
  title: string;
  eventType: 'desert' | 'gap';
  team: 'A' | 'B';
  eventDate: string; // ISO 8601形式
  description?: string;
}) {
  try {
    const calendar = getCalendarClient(false); // 書き込み権限
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID is not set');
    }

    // datetime-local形式（例: "2025-11-26T21:57"）を正しいISO 8601形式に変換
    let startDateTime = params.eventDate;
    if (!startDateTime.includes(':00') || startDateTime.length < 19) {
      // 秒が含まれていない場合は追加
      startDateTime = startDateTime.includes('T') ? `${startDateTime}:00` : startDateTime;
    }

    // 開始時刻と終了時刻（30分後）を計算
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30分後

    // RFC 3339形式に変換（Googleカレンダーが要求する形式）
    const formatToRFC3339 = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    const event = {
      summary: params.title,
      description: params.description || '',
      start: {
        dateTime: formatToRFC3339(startDate),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: formatToRFC3339(endDate),
        timeZone: 'Asia/Tokyo',
      },
    };

    const response = await calendar.events.update({
      calendarId,
      eventId: params.googleEventId,
      requestBody: event,
    });

    console.log(`Updated event in Google Calendar: ${response.data.id}`);

    return {
      googleEventId: response.data.id,
      htmlLink: response.data.htmlLink,
    };
  } catch (error) {
    console.error('Failed to update calendar event:', error);
    throw error;
  }
}

// Googleカレンダーからイベントを削除
export async function deleteCalendarEvent(googleEventId: string) {
  try {
    const calendar = getCalendarClient(false); // 書き込み権限
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID is not set');
    }

    await calendar.events.delete({
      calendarId,
      eventId: googleEventId,
    });

    console.log(`Deleted event from Google Calendar: ${googleEventId}`);
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    throw error;
  }
}

// 不定期イベントをGoogleカレンダーに作成
export async function createIrregularCalendarEvent(params: {
  title: string;
  eventDate: string; // ISO 8601形式
  deadline: string; // ISO 8601形式
  description?: string;
}) {
  try {
    const calendar = getCalendarClient(false); // 書き込み権限
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID is not set');
    }

    // datetime-local形式を正しいISO 8601形式に変換
    let startDateTime = params.eventDate;
    if (!startDateTime.includes(':00') || startDateTime.length < 19) {
      startDateTime = startDateTime.includes('T') ? `${startDateTime}:00` : startDateTime;
    }

    // 開始時刻と終了時刻（1時間後）を計算
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1時間後

    // RFC 3339形式に変換
    const formatToRFC3339 = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    // 締切情報を説明に追加
    const deadlineDate = new Date(params.deadline);
    const deadlineStr = deadlineDate.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const fullDescription = `【不定期イベント】\n申込締切: ${deadlineStr}\n\n${params.description || ''}`.trim();

    const event = {
      summary: `🎲 ${params.title}`,
      description: fullDescription,
      start: {
        dateTime: formatToRFC3339(startDate),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: formatToRFC3339(endDate),
        timeZone: 'Asia/Tokyo',
      },
      colorId: '10', // 緑色（不定期イベント用）
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    console.log(`Created irregular event in Google Calendar: ${response.data.id}`);

    return {
      googleEventId: response.data.id,
      htmlLink: response.data.htmlLink,
    };
  } catch (error) {
    console.error('Failed to create irregular calendar event:', error);
    throw error;
  }
}

// 不定期イベントをGoogleカレンダーで更新
export async function updateIrregularCalendarEvent(params: {
  googleEventId: string;
  title: string;
  eventDate: string; // ISO 8601形式
  deadline: string; // ISO 8601形式
  description?: string;
}) {
  try {
    const calendar = getCalendarClient(false); // 書き込み権限
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      throw new Error('GOOGLE_CALENDAR_ID is not set');
    }

    // datetime-local形式を正しいISO 8601形式に変換
    let startDateTime = params.eventDate;
    if (!startDateTime.includes(':00') || startDateTime.length < 19) {
      startDateTime = startDateTime.includes('T') ? `${startDateTime}:00` : startDateTime;
    }

    // 開始時刻と終了時刻（1時間後）を計算
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1時間後

    // RFC 3339形式に変換
    const formatToRFC3339 = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    // 締切情報を説明に追加
    const deadlineDate = new Date(params.deadline);
    const deadlineStr = deadlineDate.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const fullDescription = `【不定期イベント】\n申込締切: ${deadlineStr}\n\n${params.description || ''}`.trim();

    const event = {
      summary: `🎲 ${params.title}`,
      description: fullDescription,
      start: {
        dateTime: formatToRFC3339(startDate),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: formatToRFC3339(endDate),
        timeZone: 'Asia/Tokyo',
      },
      colorId: '10', // 緑色（不定期イベント用）
    };

    const response = await calendar.events.update({
      calendarId,
      eventId: params.googleEventId,
      requestBody: event,
    });

    console.log(`Updated irregular event in Google Calendar: ${response.data.id}`);

    return {
      googleEventId: response.data.id,
      htmlLink: response.data.htmlLink,
    };
  } catch (error) {
    console.error('Failed to update irregular calendar event:', error);
    throw error;
  }
}
