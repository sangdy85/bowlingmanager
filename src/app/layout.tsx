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
