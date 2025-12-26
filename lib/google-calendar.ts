import { google } from 'googleapis';

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

// RFC 3339形式に変換
function formatToRFC3339(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

// Googleカレンダーからイベントを削除
export async function deleteCalendarEvent(googleEventId: string) {
  try {
    const calendar = getCalendarClient(false);
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

// イベントをGoogleカレンダーに作成
export async function createIrregularCalendarEvent(params: {
  title: string;
  eventDate: string;
  deadline: string;
  description?: string;
}) {
  try {
    const calendar = getCalendarClient(false);
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
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    // 締切情報を説明に追加
    const deadlineDate = new Date(params.deadline);
    const deadlineStr = deadlineDate.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const fullDescription = `【イベント】\n申込締切: ${deadlineStr}\n\n${params.description || ''}`.trim();

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
      colorId: '10', // 緑色
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

// イベントをGoogleカレンダーで更新
export async function updateIrregularCalendarEvent(params: {
  googleEventId: string;
  title: string;
  eventDate: string;
  deadline: string;
  description?: string;
}) {
  try {
    const calendar = getCalendarClient(false);
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
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    // 締切情報を説明に追加
    const deadlineDate = new Date(params.deadline);
    const deadlineStr = deadlineDate.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const fullDescription = `【イベント】\n申込締切: ${deadlineStr}\n\n${params.description || ''}`.trim();

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
      colorId: '10', // 緑色
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
