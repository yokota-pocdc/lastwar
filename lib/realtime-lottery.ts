import db from './db';

export interface ApplicationWithRanking {
  id: number;
  user_id: number;
  total_score: number;
  created_at: string;
  preferred_team: 'A' | 'B';
  rank: number;
  result_status: 'participant' | 'candidate' | 'rejected';
}

/**
 * イベントの全申込をリアルタイムで順位付けし、参加者/候補者/落選を自動決定
 */
export function calculateRealtimeRankings(eventId: number): ApplicationWithRanking[] {
  // イベント情報を取得
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
  if (!event) {
    throw new Error('Event not found');
  }

  // 全申込を取得（スコア降順、同点の場合は申込日時昇順）
  const applications = db.prepare(`
    SELECT * FROM applications
    WHERE event_id = ?
    ORDER BY total_score DESC, created_at ASC
  `).all(eventId) as any[];

  const participantsLimit = event.participants_limit || 20;
  const capacity = event.capacity || 30;

  // 順位を計算し、ステータスを決定
  const rankedApplications: ApplicationWithRanking[] = applications.map((app, index) => {
    const rank = index + 1;
    let result_status: 'participant' | 'candidate' | 'rejected';

    if (rank <= participantsLimit) {
      result_status = 'participant';
    } else if (rank <= capacity) {
      result_status = 'candidate';
    } else {
      result_status = 'rejected';
    }

    return {
      ...app,
      rank,
      result_status,
    };
  });

  return rankedApplications;
}

/**
 * 申込後に全員の順位とステータスをDBに更新
 */
export function updateRealtimeRankings(eventId: number) {
  const rankings = calculateRealtimeRankings(eventId);

  // トランザクションで一括更新
  const updateStmt = db.prepare(`
    UPDATE applications
    SET result_status = ?, result_team = ?
    WHERE id = ?
  `);

  const updateMany = db.transaction((apps: ApplicationWithRanking[]) => {
    for (const app of apps) {
      updateStmt.run(app.result_status, app.preferred_team, app.id);
    }
  });

  updateMany(rankings);

  return rankings;
}

/**
 * 特定のユーザーの現在の順位を取得
 */
export function getUserRanking(eventId: number, userId: number): ApplicationWithRanking | null {
  const rankings = calculateRealtimeRankings(eventId);
  return rankings.find(r => r.user_id === userId) || null;
}
