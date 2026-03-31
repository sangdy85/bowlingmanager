import Link from "next/link";

export default function Footer() {
    return (
        <footer className="w-full bg-slate-50 border-t border-slate-200 mt-20">
            <div className="container mx-auto px-4 py-12 max-w-6xl">
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <h4 className="text-xl font-bold text-slate-900 mb-4 tracking-tighter">BowlingManager</h4>
                        <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                            볼링 점수 기록, 분석, 대회 운영까지 — 데이터를 활용해 볼링 실력을 업그레이드하고 팀의 소중한 순간을 아카이빙하세요.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">서비스</h5>
                            <ul className="space-y-3 text-sm font-medium text-slate-600">
                                <li><Link href="/about" className="hover:text-blue-600 transition-colors">서비스 소개</Link></li>
                                <li><Link href="/score" className="hover:text-blue-600 transition-colors">점수 통계</Link></li>
                                <li><Link href="/team" className="hover:text-blue-600 transition-colors">팀 관리</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">정책</h5>
                            <ul className="space-y-3 text-sm font-medium text-slate-600">
                                <li><Link href="/privacy" className="hover:text-blue-600 transition-colors">개인정보처리방침</Link></li>
                                <li><Link href="/terms" className="hover:text-blue-600 transition-colors">이용약관</Link></li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium">
                    <p>© {new Date().getFullYear()} BowlingManager. All rights reserved.</p>
                    <div className="flex gap-6">
                        <span>대표: 관리자</span>
                        <span>문의: info@bowlingmanager.co.kr</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
