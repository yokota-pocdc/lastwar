// API呼び出し用のベースパス
// next.config.jsのbasePathと同じ値を設定
export const BASE_PATH = '/stage2';

// APIエンドポイントのURLを生成
export function apiUrl(path: string): string {
  // pathが/で始まっていない場合は追加
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${normalizedPath}`;
}
