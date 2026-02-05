import type { Metadata } from "next";
import "./globals.css";
// import Navbar from "@/components/Navbar";

// export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Bowling Score Manager",
  description: "Manage your bowling team scores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {/* <Navbar /> */}
        <main className="container mt-4">
          {children}
        </main>
      </body>
    </html>
  );
}
