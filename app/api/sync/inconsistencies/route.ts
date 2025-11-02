import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { detectInconsistencies, performBidirectionalSync } from '@/lib/bidirectional-sync';

export const dynamic = 'force-dynamic';

// 不整合の検出
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const inconsistencies = await detectInconsistencies();

    // 検出された不整合のサマリー
    const summary = {
      missingInGoogle: inconsistencies.missingInGoogle.length,
      missingInDB: inconsistencies.missingInDB.length,
      orphanEvents: inconsistencies.orphanEvents.length,
      dataMismatches: inconsistencies.dataMismatches.length,
      total:
        inconsistencies.missingInGoogle.length +
        inconsistencies.missingInDB.length +
        inconsistencies.orphanEvents.length +
        inconsistencies.dataMismatches.length,
    };

    // 不整合の詳細データ
    const details = {
      missingInGoogle: inconsistencies.missingInGoogle.map(e => ({
        id: e.id,
        title: e.title,
        event_date: e.event_date,
        google_event_id: e.google_event_id,
      })),
      missingInDB: inconsistencies.missingInDB.map(e => ({
        googleEventId: e?.googleEventId,
        title: e?.title,
        eventDate: e?.eventDate,
      })),
      orphanEvents: inconsistencies.orphanEvents.map(e => ({
        id: e.id,
        title: e.title,
        event_date: e.event_date,
      })),
      dataMismatches: inconsistencies.dataMismatches.map(m => ({
        id: m.db.id,
        dbTitle: m.db.title,
        googleTitle: m.google.title,
        dbDate: m.db.event_date,
        googleDate: m.google.eventDate,
      })),
    };

    return NextResponse.json({
      summary,
      details,
    });
  } catch (error: any) {
    console.error('Inconsistency detection error:', error);
    return NextResponse.json(
      { error: '不整合検出に失敗しました', message: error.message },
      { status: 500 }
    );
  }
}

// 双方向同期の実行
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const result = await performBidirectionalSync();

    return NextResponse.json({
      success: true,
      googleToDB: {
        created: result.googleToDB.created,
        updated: result.googleToDB.updated,
        errors: result.googleToDB.errors.length,
      },
      dbToGoogle: {
        created: result.dbToGoogle.created,
        updated: result.dbToGoogle.updated,
        errors: result.dbToGoogle.errors.length,
      },
      inconsistencies: {
        missingInGoogle: result.inconsistencies.missingInGoogle.length,
        missingInDB: result.inconsistencies.missingInDB.length,
        orphanEvents: result.inconsistencies.orphanEvents.length,
        dataMismatches: result.inconsistencies.dataMismatches.length,
      },
      details: result,
    });
  } catch (error: any) {
    console.error('Bidirectional sync error:', error);
    return NextResponse.json(
      { error: '双方向同期に失敗しました', message: error.message },
      { status: 500 }
    );
  }
}
