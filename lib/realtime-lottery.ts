import db from './db';

export interface ApplicationWithRanking {
  id: number;
  user_id: number;
  total_score: number;
  created_at: string;
  preferred_team: 'A' | 'B' | null;
  rank: number;
  result_status: 'participant' | 'candidate' | 'rejected' | null;
}

/**
 * 非定期イベントの順位用インターフェース
 */
export interface IrregularApplicationWithRanking {
  id: number;
  user_id: number;
  total_score: number;
  created_at: string;
  rank: number;
  tiebreaker_value?: number; // 同点時の抽選値
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

  // 非定期イベントの場合は専用のランキング計算を使用
  if (event.event_type === 'irregular') {
    return calculateIrregularRankings(eventId);
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
 * 非定期イベント用のランキング計算
 * 同点の場合は自動抽選（ランダム値）で順位を決定
 * 定員の概念がないため、全員に順位を付ける
 */
export function calculateIrregularRankings(eventId: number): ApplicationWithRanking[] {
  // 全申込を取得
  const applications = db.prepare(`
    SELECT * FROM applications
    WHERE event_id = ?
  `).all(eventId) as any[];

  if (applications.length === 0) {
    return [];
  }

  // スコアでグループ化
  const scoreGroups: { [score: number]: any[] } = {};
  for (const app of applications) {
    const score = app.total_score;
    if (!scoreGroups[score]) {
      scoreGroups[score] = [];
    }
    scoreGroups[score].push(app);
  }

  // スコア降順でソートされた配列を作成
  const sortedScores = Object.keys(scoreGroups)
    .map(Number)
    .sort((a, b) => b - a);

  // 各グループ内で同点の場合はランダムにソート
  const rankedApplications: ApplicationWithRanking[] = [];
  let currentRank = 1;

  for (const score of sortedScores) {
    const group = scoreGroups[score];

    // 同点グループ内でシャッフル（Fisher-Yates）
    const shuffled = [...group];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 順位を付与
    for (const app of shuffled) {
      rankedApplications.push({
        ...app,
        rank: currentRank,
        // 非定期イベントは定員がないので全員null（参加者でも落選でもない）
        result_status: null,
      });
      currentRank++;
    }
  }

  return rankedApplications;
}

/**
 * 申込後に全員の順位とステータスをDBに更新
 */
export function updateRealtimeRankings(eventId: number) {
  const rankings = calculateRealtimeRankings(eventId);

  // イベント情報を取得
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
  const isIrregular = event?.event_type === 'irregular';

  // トランザクションで一括更新
  const updateStmt = db.prepare(`
    UPDATE applications
    SET result_status = ?, result_team = ?, result_rank = ?
    WHERE id = ?
  `);

  const updateMany = db.transaction((apps: ApplicationWithRanking[]) => {
    for (const app of apps) {
      // 非定期イベントの場合はteamはnull
      const resultTeam = isIrregular ? null : app.preferred_team;
      updateStmt.run(app.result_status, resultTeam, app.rank, app.id);
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
