import { auth } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-col items-center justify-center py-10 max-w-6xl mx-auto px-4">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full mb-4">
          🎳 스마트한 볼링 데이터 플랫폼
        </span>
        <h1 className="text-center text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-4">
          BowlingManager
        </h1>
        <p className="text-center text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
          개인 기록 관리부터 동호회 팀 운영, 볼링장 상주리그 및 공식 대회 자동화까지<br />
          스마트하게 내 볼링 기량을 분석하고 경쟁하세요.
        </p>

        {!session?.user && (
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg no-underline"
            >
              무료 회원가입
            </Link>
            <Link
              href="/about"
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-6 py-3 rounded-xl transition-all border border-slate-300 no-underline"
            >
              서비스 상세 가이드 보기
            </Link>
          </div>
        )}
      </div>

      {/* Main Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mb-16">
        <Link
          href={session?.user ? "/personal" : "/login"}
          prefetch={false}
          className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all text-center block no-underline text-inherit group"
        >
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🎳</div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">나의 기록실</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            매 게임 스코어를 간편하게 기록하고 오각형 분석 그래프(에버, 기복, 포텐셜, 수비력)로 진단받으세요.
          </p>
        </Link>

        <Link
          href={session?.user ? "/team" : "/login"}
          prefetch={false}
          className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all text-center block no-underline text-inherit group"
        >
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🏆</div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">동호회 팀 관리</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            클럽 팀 생성 후 수동/엑셀/점수판 사진(OCR) 3가지 방법으로 점수를 기재하고 팀원 출석률을 관리하세요.
          </p>
        </Link>

        <Link
          href={session?.user ? "/tournaments" : "/login"}
          prefetch={false}
          className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all text-center block no-underline text-inherit group"
        >
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🏟️</div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">볼링장 & 대회 운영</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            상주리그, 챔프전, 스카치 대회 대진표 및 자동 핸디캡 계산 로직이 적용된 실시간 모바일 리더보드 서비스.
          </p>
        </Link>
      </div>

      {/* Public Knowledge Banner Section (For Crawlers & Guests) */}
      <div className="w-full bg-slate-900 text-white rounded-2xl p-8 md:p-10 border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="text-blue-400 text-xs font-black uppercase tracking-wider">Public Knowledge Center</span>
          <h3 className="text-2xl font-black text-white">볼링 점수 계산법 & 지식 백과가 필요하신가요?</h3>
          <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
            스페어/스트라이크 점수 공식부터 초보자 필수 에티켓, 마이볼 지공 가이드까지 비회원도 누구나 자유롭게 읽어보실 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 whitespace-nowrap">
          <Link
            href="/guide"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-3 rounded-xl transition-all no-underline text-sm shadow-md"
          >
            볼링 가이드 센터 &rarr;
          </Link>
          <Link
            href="/about"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-3 rounded-xl transition-all no-underline text-sm border border-slate-700"
          >
            이용 방법 안내 &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
