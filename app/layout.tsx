import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ラストウォー 抽選アプリ',
  description: '砂漠の戦場・狭間の戦場 参加者抽選システム',
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
