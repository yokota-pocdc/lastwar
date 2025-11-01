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

  // 砂漠A
  if (title.includes('砂漠A') || titleLower.includes('sabakua')) {
    type = 'desert';
    team = 'A';
    baseGroup = '砂漠';
  }
  // 砂漠B
  else if (title.includes('砂漠B') || titleLower.includes('sabakub')) {
    type = 'desert';
    team = 'B';
    baseGroup = '砂漠';
  }
  // 狭間A
  else if (title.includes('狭間A') || titleLower.includes('hasamaa')) {
    type = 'gap';
    team = 'A';
    baseGroup = '狭間';
  }
  // 狭間B
  else if (title.includes('狭間B') || titleLower.includes('hasamab')) {
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

    // 今日から30日後までのイベントを取得
    const now = new Date();
    const endDate = addDays(now, 30);

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

    const event = {
      summary: params.title,
      description: params.description || '',
      start: {
        dateTime: params.eventDate,
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: new Date(new Date(params.eventDate).getTime() + 60 * 60 * 1000).toISOString(), // 1時間後
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
