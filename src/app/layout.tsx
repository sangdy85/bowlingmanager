import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "볼링 점수 관리",
  description: "개인 및 팀 볼링 점수 관리 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, backgroundColor: '#0f172a', color: 'white' }}>{children}</body>
    </html>
  );
}
