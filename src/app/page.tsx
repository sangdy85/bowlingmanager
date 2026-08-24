import { auth } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-col items-center justify-center py-10">
      {/* Title Section */}
      <h1 className="text-center page-title" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
        볼링 점수 관리
      </h1>
      <p className="text-center mb-6" style={{ fontSize: '1.25rem', color: 'var(--secondary-foreground)', maxWidth: '600px' }}>
        팀을 만들고, 점수를 기록하고, 친구들과 경쟁하세요.<br />
        쉽고 간편한 볼링 점수 관리 서비스입니다.
      </p>

      {/* 3 Main Buttons / Cards */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
        <Link
          href={session?.user ? "/personal" : "/login"}
          prefetch={false}
          className="card text-center hover:bg-secondary/20 transition-colors cursor-pointer block no-underline text-inherit"
        >
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎳</div>
          <h3 className="mb-2">나의 기록실</h3>
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
          href={session?.user ? "/tournaments" : "/login"}
          prefetch={false}
          className="card text-center hover:bg-secondary/20 transition-colors cursor-pointer block no-underline text-inherit"
        >
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏟️</div>
          <h3 className="mb-2">볼링장/대회</h3>
          <p style={{ color: 'var(--secondary-foreground)' }}>
            {session?.user?.role === 'CENTER_ADMIN'
              ? '보유하신 볼링장을 관리하고 대회를 개최하세요.'
              : '전국의 볼링장 정보와 진행 중인 대회를 확인하세요.'}
          </p>
        </Link>
      </div>

      {/* Public Knowledge Banner (AdSense Compliance) */}
      <div className="mt-16 w-full max-w-4xl bg-slate-900 text-white rounded-2xl p-8 border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="text-blue-400 text-xs font-black uppercase tracking-wider">Public Knowledge Center</span>
          <h3 className="text-xl font-bold text-white mb-1">볼링 점수 계산법 & 지식 백과가 필요하신가요?</h3>
          <p className="text-slate-300 text-xs leading-relaxed max-w-xl">
            스페어/스트라이크 점수 공식부터 초보자 필수 에티켓, 마이볼 지공 가이드까지 비회원도 누구나 자유롭게 읽어보실 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 whitespace-nowrap">
          <Link
            href="/guide"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl transition-all no-underline text-xs shadow-md"
          >
            볼링 가이드 센터 &rarr;
          </Link>
          <Link
            href="/about"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl transition-all no-underline text-xs border border-slate-700"
          >
            이용 방법 안내 &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
