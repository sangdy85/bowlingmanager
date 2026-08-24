import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 mt-20">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="text-2xl font-black text-white no-underline tracking-tight">
              Bowling<span className="text-blue-500">Manager</span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              개인 점수 기록 아카이빙, 동호회 통합 관리, 볼링장 공식 대회 및 상주리그 자동화 서비스입니다.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">서비스 서비스</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors no-underline">서비스 소개 & 이용 가이드</Link></li>
              <li><Link href="/guide" className="hover:text-white transition-colors no-underline">볼링 백과사전 & 정보 가이드</Link></li>
              <li><Link href="/tournaments" className="hover:text-white transition-colors no-underline">진행 중인 대회 소식</Link></li>
            </ul>
          </div>

          {/* Customer & Policy Links */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">고객 지원 & 정책</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/inquiry" className="hover:text-white transition-colors no-underline">고객 문의하기</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors no-underline">서비스 이용약관</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors no-underline">개인정보처리방침</Link></li>
            </ul>
          </div>

          {/* Service Tech Tag */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">기술 및 문의</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-2">
              점수판 모니터 OCR 자동 인식 기술 및 실시간 리더보드 반영 적용.
            </p>
            <span className="inline-block text-xs font-mono bg-slate-800 text-blue-400 px-2.5 py-1 rounded">
              v1.5.0 Official Stable
            </span>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {currentYear} BowlingManager. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-slate-300 no-underline">개인정보처리방침</Link>
            <Link href="/terms" className="hover:text-slate-300 no-underline">이용약관</Link>
            <Link href="/guide" className="hover:text-slate-300 no-underline">가이드 센터</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
