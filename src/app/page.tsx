import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <h1 className="text-center page-title mb-4" style={{ fontSize: '4rem' }}>
        볼링 점수 관리
      </h1>
      <p className="text-center mb-12" style={{ fontSize: '1.25rem', color: '#94a3b8', maxWidth: '600px' }}>
        팀을 만들고, 점수를 기록하고, 친구들과 경쟁하세요.<br />
        쉽고 간편한 볼링 점수 관리 서비스입니다.
      </p>

      <div className="grid grid-cols-3 w-full max-w-5xl">
        <Link href="/login" className="card text-center">
          <span className="icon">🎳</span>
          <h3>점수 기록</h3>
          <p>매 게임 점수를 간편하게 기록하고 저장하세요.</p>
        </Link>
        <Link href="/login" className="card text-center">
          <span className="icon">🏆</span>
          <h3>팀 관리</h3>
          <p>동호회 팀을 만들고 팀원들과 함께하세요.</p>
        </Link>
        <Link href="/login" className="card text-center">
          <span className="icon">📊</span>
          <h3>통계/순위</h3>
          <p>팀 내 순위와 개인 기록 추이를 확인하세요.</p>
        </Link>
      </div>
    </div>
  );
}
