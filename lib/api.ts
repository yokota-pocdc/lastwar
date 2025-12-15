// API呼び出し用ユーティリティ
// basePathを考慮したfetch関数

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function apiUrl(path: string): string {
  // pathが/で始まる場合、basePathを付加
  if (path.startsWith('/')) {
    return `${basePath}${path}`;
  }
  return `${basePath}/${path}`;
}

// fetch wrapper
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), options);
}
