import { auth } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <h1 className="text-center page-title" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
        볼링 점수 관리
      </h1>
      <p className="text-center mb-6" style={{ fontSize: '1.25rem', color: 'var(--secondary-foreground)', maxWidth: '600px' }}>
        팀을 만들고, 점수를 기록하고, 친구들과 경쟁하세요.<br />
        쉽고 간편한 볼링 점수 관리 서비스입니다.
      </p>

      {/* Features Grid */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        <Link
          href={session?.user ? "/personal" : "/login"}
          prefetch={false}
          className="card text-center hover:bg-secondary/20 transition-all cursor-pointer block no-underline text-inherit p-8 border border-slate-100 shadow-sm"
        >
          <div className="text-4xl mb-4">🎳</div>
          <h3 className="text-xl font-bold mb-3">개인 점수 기록</h3>
          <p className="text-sm leading-relaxed text-slate-500">
            매 게임마다 점수를 간편하게 기록하고 클라우드에 영구 보관하세요. 
            단순 수치 저장을 넘어 에버리지 추이와 최고 점수 기록을 한눈에 확인할 수 있습니다.
          </p>
        </Link>
        <Link
          href={session?.user ? "/team" : "/login"}
          prefetch={false}
          className="card text-center hover:bg-secondary/20 transition-all cursor-pointer block no-underline text-inherit p-8 border border-slate-100 shadow-sm"
        >
          <div className="text-4xl mb-4">🏆</div>
          <h3 className="text-xl font-bold mb-3">팀 및 동호회 관리</h3>
          <p className="text-sm leading-relaxed text-slate-500">
            동호회 동료들과 함께 팀을 구성하고 실시간으로 순위를 공유하세요. 
            정기전, 교류전 등 다양한 게임 형식을 지원하여 체계적인 팀 운영이 가능합니다.
          </p>
        </Link>
        <Link
          href={session?.user ? "/tournaments" : "/login"}
          prefetch={false}
          className="card text-center hover:bg-secondary/20 transition-all cursor-pointer block no-underline text-inherit p-8 border border-slate-100 shadow-sm"
        >
          <div className="text-4xl mb-4">Stadium</div>
          <h3 className="text-xl font-bold mb-3">볼링장 정보 및 대회</h3>
          <p className="text-sm leading-relaxed text-slate-500">
            주변 볼링장의 시설 정보와 진행 중인 아마추어 대회를 찾아보세요. 
            볼링장 운영자라면 직접 대회를 개최하고 참가자 점수를 관리할 수 있습니다.
          </p>
        </Link>
      </div>

      {/* SEO Content Section */}
      <div className="mt-32 w-full max-w-4xl bg-slate-50 rounded-3xl p-12 border border-slate-200">
        <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight text-center">왜 BowlingManager인가요?</h2>
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-blue-600">스마트한 데이터 분석</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              단순한 숫자의 나열이 아닌, 당신의 볼링 스타일을 분석합니다. 
              스트라이크 확률, 커버 성공률 등 정밀한 통계를 통해 당신의 약점을 강점으로 바꾸는 인사이트를 제공합니다.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-blue-600">편리한 기록 방식</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              점수판 사진 한 장으로 끝내는 AI 점수 인식 시스템을 경험하세요. 
              일일이 숫자를 입력할 필요 없이 엑셀 업로드나 사진 촬영만으로 신속하게 기록을 업데이트할 수 있습니다.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-blue-600">공정한 경쟁 문화</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              투명한 핸디캡 산출 로직을 통해 누구나 공정하게 즐기는 대회를 지향합니다. 
              실시간 업데이트되는 리더보드로 경기의 박진감을 더해보세요.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-blue-600">영구적인 기록 아카이빙</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              몇 년 전 동호회 활동 기록까지 완벽하게 보존됩니다. 
              당신의 소중한 볼링 여정을 BowlingManager가 함께 기록하고 기억하겠습니다.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-20 text-center text-slate-400 text-sm font-medium">
        현재 전국 수천 명의 볼러들이 BowlingManager와 함께 성장하고 있습니다.
      </div>
    </div>
  );
}
