import { google } from 'googleapis';
import { addDays } from 'date-fns';

// Google Calendar APIクライアントの初期化
function getCalendarClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  return google.calendar({ version: 'v3', auth });
}

// イベントの種別を判定
export function parseEventType(title: string): {
  type: 'desert' | 'gap' | null;
  team: 'A' | 'B' | null;
  group: string | null;
} {
  const titleLower = title.toLowerCase();

  // 砂漠A
  if (title.includes('砂漠A') || titleLower.includes('sabakua')) {
    return { type: 'desert', team: 'A', group: '砂漠' };
  }

  // 砂漠B
  if (title.includes('砂漠B') || titleLower.includes('sabakub')) {
    return { type: 'desert', team: 'B', group: '砂漠' };
  }

  // 狭間A
  if (title.includes('狭間A') || titleLower.includes('hasamaa')) {
    return { type: 'gap', team: 'A', group: '狭間' };
  }

  // 狭間B
  if (title.includes('狭間B') || titleLower.includes('hasamab')) {
    return { type: 'gap', team: 'B', group: '狭間' };
  }

  return { type: null, team: null, group: null };
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
        const parsed = parseEventType(title);

        if (!parsed.type || !parsed.team) {
          return null; // 対象外のイベントは無視
        }

        const startDateTime = event.start?.dateTime || event.start?.date;
        if (!startDateTime) {
          return null;
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
