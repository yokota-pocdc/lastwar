// サイコロロジック
export function rollDice(): { dice1: number; dice2: number; score: number; isDoubles: boolean } {
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const isDoubles = dice1 === dice2;
  const baseScore = dice1 + dice2;
  const score = isDoubles ? baseScore * 2 : baseScore;

  return { dice1, dice2, score, isDoubles };
}

// 合計スコア計算
export function calculateTotalScore(diceScore: number, usedTicket: boolean): number {
  return diceScore + (usedTicket ? 12 : 0);
}

// 抽選実行
export interface Application {
  id: number;
  user_id: number;
  total_score: number;
  created_at: string;
  preferred_team: 'A' | 'B';
  allow_alternative_if_rejected?: number;
  allow_alternative_if_candidate?: number;
}

export interface LotteryResult {
  applicationId: number;
  resultTeam: 'A' | 'B';
  resultStatus: 'participant' | 'candidate' | 'rejected';
}

export function executeLottery(
  applications: Application[],
  teamACapacity: number,
  teamBCapacity: number,
  teamAParticipants: number,
  teamBParticipants: number,
  useTeamB: boolean
): LotteryResult[] {
  // スコア降順、同点の場合は登録時刻昇順でソート
  const sorted = [...applications].sort((a, b) => {
    if (b.total_score !== a.total_score) {
      return b.total_score - a.total_score;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const results: Map<number, LotteryResult> = new Map();

  // 各チームの参加者数と候補者数を個別に追跡
  let teamAParticipantCount = 0;
  let teamACandidateCount = 0;
  let teamBParticipantCount = 0;
  let teamBCandidateCount = 0;

  // 第1フェーズ: 希望チームに割り当て
  for (const app of sorted) {
    let assigned = false;

    if (app.preferred_team === 'A') {
      if (teamAParticipantCount < teamAParticipants) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'participant' });
        teamAParticipantCount++;
        assigned = true;
      } else if (teamACandidateCount < (teamACapacity - teamAParticipants)) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'candidate' });
        teamACandidateCount++;
        assigned = true;
      }
    } else if (app.preferred_team === 'B' && useTeamB) {
      if (teamBParticipantCount < teamBParticipants) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'participant' });
        teamBParticipantCount++;
        assigned = true;
      } else if (teamBCandidateCount < (teamBCapacity - teamBParticipants)) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'candidate' });
        teamBCandidateCount++;
        assigned = true;
      }
    }

    if (!assigned) {
      results.set(app.id, { applicationId: app.id, resultTeam: app.preferred_team, resultStatus: 'rejected' });
    }
  }

  // 第2フェーズ: 反復的な移動処理（収束するまで繰り返す）
  const MAX_ITERATIONS = 10;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let changed = false;

    // ステップA: 候補者→別小隊の参加者枠への移動（スコア順）
    for (const app of sorted) {
      if (!app.allow_alternative_if_candidate) continue;

      const current = results.get(app.id);
      if (!current || current.resultStatus !== 'candidate') continue;

      const alternativeTeam = app.preferred_team === 'A' ? 'B' : 'A';

      // 別小隊の参加者枠に空きがあるか確認
      if (alternativeTeam === 'A' && teamAParticipantCount < teamAParticipants) {
        // 元のチームの候補者枠を解放
        if (current.resultTeam === 'B') {
          teamBCandidateCount--;
        } else {
          teamACandidateCount--;
        }
        // 別小隊の参加者として移動
        results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'participant' });
        teamAParticipantCount++;
        changed = true;
      } else if (alternativeTeam === 'B' && useTeamB && teamBParticipantCount < teamBParticipants) {
        // 元のチームの候補者枠を解放
        if (current.resultTeam === 'A') {
          teamACandidateCount--;
        } else {
          teamBCandidateCount--;
        }
        // 別小隊の参加者として移動
        results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'participant' });
        teamBParticipantCount++;
        changed = true;
      }
    }

    // ステップB: 空いた候補者枠を落選者で埋める（スコア順）
    for (const app of sorted) {
      const current = results.get(app.id);
      if (!current || current.resultStatus !== 'rejected') continue;

      // 希望チームの候補者枠に空きがあれば昇格
      if (app.preferred_team === 'A' && teamACandidateCount < (teamACapacity - teamAParticipants)) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'candidate' });
        teamACandidateCount++;
        changed = true;
      } else if (app.preferred_team === 'B' && useTeamB && teamBCandidateCount < (teamBCapacity - teamBParticipants)) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'candidate' });
        teamBCandidateCount++;
        changed = true;
      }
    }

    // ステップC: 落選者→別小隊への移動（スコア順）
    for (const app of sorted) {
      if (!app.allow_alternative_if_rejected) continue;

      const current = results.get(app.id);
      if (!current || current.resultStatus !== 'rejected') continue;

      const alternativeTeam = app.preferred_team === 'A' ? 'B' : 'A';

      // 別小隊の参加者枠を優先的に試す
      if (alternativeTeam === 'A') {
        if (teamAParticipantCount < teamAParticipants) {
          results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'participant' });
          teamAParticipantCount++;
          changed = true;
        } else if (teamACandidateCount < (teamACapacity - teamAParticipants)) {
          results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'candidate' });
          teamACandidateCount++;
          changed = true;
        }
      } else if (alternativeTeam === 'B' && useTeamB) {
        if (teamBParticipantCount < teamBParticipants) {
          results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'participant' });
          teamBParticipantCount++;
          changed = true;
        } else if (teamBCandidateCount < (teamBCapacity - teamBParticipants)) {
          results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'candidate' });
          teamBCandidateCount++;
          changed = true;
        }
      }
    }

    // 変更がなければ収束したので終了
    if (!changed) {
      console.log(`抽選処理が${iteration + 1}回の反復で収束しました`);
      break;
    }
  }

  return Array.from(results.values());
}
