import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

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
      <body className="antialiased">
        <Navbar />
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
