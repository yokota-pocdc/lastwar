// 不定期イベント用サイコロロジック

/**
 * 3個のサイコロを振り、111-666の3桁数値を生成
 * 各桁は1-6の値を取る
 */
export function rollThreeDice(): { dice1: number; dice2: number; dice3: number; score: number } {
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const dice3 = Math.floor(Math.random() * 6) + 1;
  // 3桁の数値として結合（例: 1,2,3 -> 123）
  const score = dice1 * 100 + dice2 * 10 + dice3;
  return { dice1, dice2, dice3, score };
}

/**
 * システムランダム値を生成（0-999999の範囲）
 * P,Qが同点の場合の最終決定用
 */
export function generateRandomValue(): number {
  return Math.floor(Math.random() * 1000000);
}

export interface IrregularApplication {
  id: number;
  event_id: number;
  user_id: number;
  dice1: number;
  dice2: number;
  dice3: number;
  sub_dice1: number;
  sub_dice2: number;
  sub_dice3: number;
  random_value: number;
  rank?: number;
  created_at: string;
  user_name?: string;
}

/**
 * 参加者のスコアを計算
 * P: メインスコア（111-666）
 * Q: サブスコア（111-666）
 * R: ランダム値（0-999999）
 */
export function calculateScores(app: IrregularApplication): {
  mainScore: number;  // P
  subScore: number;   // Q
  randomValue: number; // R
} {
  const mainScore = app.dice1 * 100 + app.dice2 * 10 + app.dice3;
  const subScore = app.sub_dice1 * 100 + app.sub_dice2 * 10 + app.sub_dice3;
  return {
    mainScore,
    subScore,
    randomValue: app.random_value
  };
}

/**
 * 順位付けを行う
 * P→Q→Rの順で比較し、必ずユニークな順位を付ける
 */
export function calculateRankings(applications: IrregularApplication[]): IrregularApplication[] {
  // スコア計算してソート
  const withScores = applications.map(app => ({
    ...app,
    scores: calculateScores(app)
  }));

  // P降順 → Q降順 → R降順でソート
  withScores.sort((a, b) => {
    // Pで比較
    if (a.scores.mainScore !== b.scores.mainScore) {
      return b.scores.mainScore - a.scores.mainScore;
    }
    // Qで比較
    if (a.scores.subScore !== b.scores.subScore) {
      return b.scores.subScore - a.scores.subScore;
    }
    // Rで比較（必ずユニークなのでここで決定）
    return b.scores.randomValue - a.scores.randomValue;
  });

  // 順位を付与（1から開始）
  return withScores.map((app, index) => ({
    ...app,
    rank: index + 1
  }));
}

/**
 * 表示用のスコア文字列を生成
 */
export function formatScore(dice1: number, dice2: number, dice3: number): string {
  return `${dice1}${dice2}${dice3}`;
}
