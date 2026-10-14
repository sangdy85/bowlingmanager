import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/NavbarWrapper";
import Footer from "@/components/Footer";
import AuthContext from '@/components/AuthContext';


const inter = Inter({ subsets: ["latin"] });
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "볼링매니저 | 동호회 · 볼링장 운영과 볼링 정보",
  description: "동호회 정기전과 기록, 볼링장 리그와 대회 운영부터 볼링 정보와 커뮤니티까지 한곳에서 이용하세요.",
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
      <body className={inter.className}>
        <AuthContext>
          <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
            <div>
              <Navbar />
              <main className="container mx-auto px-4 py-8">
                {children}
              </main>
            </div>
            <Footer />
          </div>
        </AuthContext>
      </body>
    </html>
  );
}
