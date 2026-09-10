import Link from 'next/link';

export const metadata = {
  title: '책임 한계 및 법적 고지 | BowlingManager',
  description: 'BowlingManager 서비스의 스포츠 데이터 정보 제공, 제3자 웹사이트 링크 및 법적 책임 한계에 관한 고지 사항입니다.',
};

export default function DisclaimerPage() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="border-b border-slate-200 pb-6 mb-8">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">LEGAL & DISCLAIMER</span>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">책임 한계 및 법적 고지</h1>
        <p className="text-slate-500 text-sm mt-2">
          BowlingManager가 제공하는 정보 서비스의 목적과 제반 법적 책임 한계에 대해 안내해 드립니다.
        </p>
      </div>

      <section className="space-y-8 text-sm leading-relaxed text-slate-700">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            1. 스포츠 백과사전 및 경기 규정 정보의 목적
          </h3>
          <p className="text-slate-600 leading-relaxed">
            본 웹사이트에서 제공하는 볼링 가이드, 볼링공 기술 스펙, KPBA 경기 규정 요약, 점수 산출 공식 등의 정보는 일반 이용자 및 동호인분들의 **이해를 돕기 위한 교육용 참고 자료**로 제작되었습니다.
            각 볼링장 센터, 주관 동호회, 스포츠 상주 협회의 개별 규정 및 대회 운영 방식에 따라 실제 현장 규칙은 일부 상이할 수 있으므로, 참가 전 해당 주관사의 공식 대회 요강을 반드시 확인하시기 바랍니다.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            2. 정보의 정확성 및 서비스 변경에 관한 고지
          </h3>
          <p className="text-slate-600 leading-relaxed">
            회사는 제공되는 정보의 정확성과 최신성을 유지하기 위해 최선을 다하고 있으나, 정보의 절대적 완전성이나 특정 목적에 대한 적합성을 완벽하게 보증하지는 않습니다.
            시스템 업데이트, 관련 법령 개정, 협회 규정 변경 등에 따라 사전 통지 없이 콘텐츠 내용이 보완 및 수정될 수 있습니다.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            3. 제3자 웹사이트 및 외부 하이퍼링크 관련 고지
          </h3>
          <p className="text-slate-600 leading-relaxed">
            본 웹사이트는 이용자의 편의를 위해 제3자의 웹사이트, 공공기관 사이트 또는 외부 하이퍼링크를 포함할 수 있습니다.
            회사는 제3자가 운영하는 외부 웹사이트의 콘텐츠, 개인정보 보호정책, 서비스의 신뢰성에 대해 직접적인 제어권이 없으며, 이에 따른 어떠한 손해에 대해서도 책임을 지지 않습니다.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            4. 지적재산권 및 콘텐츠 재배포 제한
          </h3>
          <p className="text-slate-600 leading-relaxed">
            BowlingManager 웹사이트 내에 작성된 모든 자체 제작 정보 아티클, 가이드 글, 시스템 설명 텍스트 및 저작물에 대한 저작권 및 지적재산권은 본 서비스에 귀속됩니다.
            서면에 의한 사전 승인 없이 본 사이트의 콘텐츠를 무단 복제, 상업적 재배포, 크롤링 조작하는 행위를 금합니다.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            5. 문의 및 정보 수정 요청
          </h3>
          <p className="text-slate-600 leading-relaxed mb-3">
            제공된 정보에 대한 오류 제보, 정정 요청, 권리 침해 신고 또는 법적 문의사항이 있으신 경우 언제든지 고객 문의 센터로 연락해 주시기 바랍니다.
          </p>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-700">
            <p><strong>담당 문의처</strong>: info@bowlingmanager.co.kr</p>
            <p><strong>1:1 문의 페이지</strong>: <Link href="/inquiry" className="text-blue-600 underline">고객 문의 센터 바로가기</Link></p>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs text-slate-400">
          <p>공고 일자: 2026년 08월 24일 | 시행 일자: 2026년 08월 24일</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
            <Link href="/terms" className="hover:underline">이용약관</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
