import Link from "next/link";

export default function Home() {
  const session: any = null;

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <h1 className="text-center page-title" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
        볼링 점수 관리
      </h1>
      <p className="text-center mb-6" style={{ fontSize: '1.25rem', color: 'var(--secondary-foreground)', maxWidth: '600px' }}>
        팀을 만들고, 점수를 기록하고, 친구들과 경쟁하세요.<br />
        쉽고 간편한 볼링 점수 관리 서비스입니다.
      </p>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
        <Link
          href={session?.user ? "/personal" : "/login"}
          prefetch={false}
          className="card text-center hover:bg-secondary/20 transition-colors cursor-pointer block no-underline text-inherit"
        >
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎳</div>
          <h3 className="mb-2">점수 기록</h3>
          <p style={{ color: 'var(--secondary-foreground)' }}>매 게임 점수를 간편하게 기록하고 저장하세요.</p>
        </Link>
        <Link
          href={session?.user ? "/team" : "/login"}
          prefetch={false}
          className="card text-center hover:bg-secondary/20 transition-colors cursor-pointer block no-underline text-inherit"
        >
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏆</div>
          <h3 className="mb-2">팀 관리</h3>
          <p style={{ color: 'var(--secondary-foreground)' }}>동호회 팀을 만들고 팀원들과 함께하세요.</p>
        </Link>
        <Link
          href={session?.user ? "/stats" : "/login"}
          prefetch={false}
          className="card text-center hover:bg-secondary/20 transition-colors cursor-pointer block no-underline text-inherit"
        >
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
          <h3 className="mb-2">통계/순위</h3>
          <p style={{ color: 'var(--secondary-foreground)' }}>팀 내 순위와 개인 기록 추이를 확인하세요.</p>
        </Link>
      </div>
    </div>
  );
}
