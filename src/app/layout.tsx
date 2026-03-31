import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/NavbarWrapper";
import Footer from "@/components/Footer";
import AuthContext from '@/components/AuthContext';
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "볼링 점수 관리",
  description: "개인 및 팀 볼링 점수 관리 서비스",
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
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <main className="container flex-grow mx-auto px-4 py-8">
              {children}
            </main>
            <Footer />
          </div>
        </AuthContext>
      </body>
    </html>
  );
}
