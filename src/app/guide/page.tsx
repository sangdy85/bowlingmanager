import Link from 'next/link';
import { GUIDE_ARTICLES } from '@/lib/guide-data';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '볼링 가이드 & 지식 센터 | BowlingManager',
  description: '볼링 점수 계산법, 초보자 에티켓, 마이볼 선택 가이드, 에버리지 올리는 팁 등 유용한 볼링 지식과 대회 규칙을 확인해보세요.',
};

export default function GuideListPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header Banner */}
      <div className="text-center mb-16">
        <span className="inline-block bg-blue-100 text-blue-800 font-bold px-4 py-1.5 rounded-full text-sm mb-4">
          🎳 Bowling Knowledge & Guide Center
        </span>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">
          볼링 백과사전 & 실전 가이드
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
          점수 계산법부터 필수 에티켓, 마이볼 선택 가이드 및 대회 운영 규칙까지<br />
          볼링 실력 향상과 즐거운 클럽 활동을 위한 유용한 정보를 한곳에서 만나보세요.
        </p>
      </div>

      {/* Guide Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
        {GUIDE_ARTICLES.map((article) => (
          <article
            key={article.slug}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1"
          >
            <div className="p-7">
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="bg-blue-50 text-blue-600 border border-blue-200 text-xs font-black px-3 py-1 rounded-md">
                  {article.category}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {article.readTime}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                <Link href={`/guide/${article.slug}`}>
                  {article.title}
                </Link>
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 mb-4 font-normal">
                {article.description}
              </p>
            </div>

            <div className="px-7 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                {article.date}
              </span>
              <Link
                href={`/guide/${article.slug}`}
                className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 group-hover:translate-x-1 transition-transform"
              >
                읽어보기 &rarr;
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* Info Callout */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-8 md:p-10 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black mb-2 text-white">데이터 기반으로 내 볼링 기량을 파악하고 싶으신가요?</h3>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            BowlingManager는 개인 및 클럽 동호회의 점수를 아카이빙하고 하이, 로우, 에버리지 및 기복(편차)을 다각도로 분석해 드립니다.
          </p>
        </div>
        <Link
          href="/register"
          className="whitespace-nowrap bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3.5 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 no-underline"
        >
          무료로 시작하기
        </Link>
      </div>
    </div>
  );
}
