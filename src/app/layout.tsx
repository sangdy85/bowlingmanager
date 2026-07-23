import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/NavbarWrapper";
import AuthContext from '@/components/AuthContext';
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "볼링매니저 | 동호회 및 대회 자동화 서비스",
  description: "개인 및 동호회(팀) 볼링 점수 기록 관리, 상주리그 및 볼링장 대회 운영 자동화, 실시간 순위 리더보드 서비스",
  other: {
    "google-adsense-account": "ca-pub-6753153221253393",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6753153221253393"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body className={inter.className}>
        <AuthContext>
          <div className="min-h-screen bg-background text-foreground">
            <Navbar />
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
          </div>
        </AuthContext>
      </body>
    </html>
  );
}
