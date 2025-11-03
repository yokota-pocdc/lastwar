import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'イベント参加申込システム -jfkh-',
  description: 'イベント参加者抽選・管理システム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
