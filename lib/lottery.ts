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
  preferred_team: 'A' | 'B' | 'any';
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

  const results: LotteryResult[] = [];
  let teamACount = 0;
  let teamBCount = 0;

  for (const app of sorted) {
    let assigned = false;

    if (useTeamB) {
      // チームA/B両方使用
      if (app.preferred_team === 'A' || app.preferred_team === 'any') {
        if (teamACount < teamAParticipants) {
          results.push({ applicationId: app.id, resultTeam: 'A', resultStatus: 'participant' });
          teamACount++;
          assigned = true;
        } else if (teamACount < teamACapacity) {
          results.push({ applicationId: app.id, resultTeam: 'A', resultStatus: 'candidate' });
          teamACount++;
          assigned = true;
        }
      }

      if (!assigned && (app.preferred_team === 'B' || app.preferred_team === 'any')) {
        if (teamBCount < teamBParticipants) {
          results.push({ applicationId: app.id, resultTeam: 'B', resultStatus: 'participant' });
          teamBCount++;
          assigned = true;
        } else if (teamBCount < teamBCapacity) {
          results.push({ applicationId: app.id, resultTeam: 'B', resultStatus: 'candidate' });
          teamBCount++;
          assigned = true;
        }
      }
    } else {
      // チームAのみ使用
      if (teamACount < teamAParticipants) {
        results.push({ applicationId: app.id, resultTeam: 'A', resultStatus: 'participant' });
        teamACount++;
        assigned = true;
      } else if (teamACount < teamACapacity) {
        results.push({ applicationId: app.id, resultTeam: 'A', resultStatus: 'candidate' });
        teamACount++;
        assigned = true;
      }
    }

    if (!assigned) {
      results.push({ applicationId: app.id, resultTeam: 'A', resultStatus: 'rejected' });
    }
  }

  return results;
}
