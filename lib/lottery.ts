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
  allow_alternative_team?: number;
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
  let teamACount = 0;
  let teamBCount = 0;

  // 第1フェーズ: 希望チームに割り当て
  for (const app of sorted) {
    let assigned = false;

    // ユーザーが選択したチームにのみ割り当てる
    if (app.preferred_team === 'A') {
      if (teamACount < teamAParticipants) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'participant' });
        teamACount++;
        assigned = true;
      } else if (teamACount < teamACapacity) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'candidate' });
        teamACount++;
        assigned = true;
      }
    } else if (app.preferred_team === 'B' && useTeamB) {
      if (teamBCount < teamBParticipants) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'participant' });
        teamBCount++;
        assigned = true;
      } else if (teamBCount < teamBCapacity) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'candidate' });
        teamBCount++;
        assigned = true;
      }
    }

    // 選択したチームが満員の場合は落選
    if (!assigned) {
      results.set(app.id, { applicationId: app.id, resultTeam: app.preferred_team, resultStatus: 'rejected' });
    }
  }

  // 第2フェーズ: allow_alternative_team=true のユーザーを別チームの余裕枠に割り当て
  for (const app of sorted) {
    if (!app.allow_alternative_team) continue;

    const currentResult = results.get(app.id);
    if (!currentResult) continue;

    const alternativeTeam = app.preferred_team === 'A' ? 'B' : 'A';

    // 落選者の場合：別チームの参加者枠または候補者枠に移動
    if (currentResult.resultStatus === 'rejected') {
      if (alternativeTeam === 'A') {
        if (teamACount < teamAParticipants) {
          results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'participant' });
          teamACount++;
        } else if (teamACount < teamACapacity) {
          results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'candidate' });
          teamACount++;
        }
      } else if (alternativeTeam === 'B' && useTeamB) {
        if (teamBCount < teamBParticipants) {
          results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'participant' });
          teamBCount++;
        } else if (teamBCount < teamBCapacity) {
          results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'candidate' });
          teamBCount++;
        }
      }
    }
    // 候補者の場合：別チームの参加者枠に移動
    else if (currentResult.resultStatus === 'candidate') {
      if (alternativeTeam === 'A' && teamACount < teamAParticipants) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'A', resultStatus: 'participant' });
        teamACount++;
      } else if (alternativeTeam === 'B' && useTeamB && teamBCount < teamBParticipants) {
        results.set(app.id, { applicationId: app.id, resultTeam: 'B', resultStatus: 'participant' });
        teamBCount++;
      }
    }
  }

  return Array.from(results.values());
}
