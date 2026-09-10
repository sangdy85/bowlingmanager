import Link from 'next/link';

export const metadata = {
  title: '서비스 이용약관 | BowlingManager',
  description: 'BowlingManager 서비스 이용 조건, 이용자와 회사의 권리 및 의무, 책임사항에 관한 공식 약관 규정입니다.',
};

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="border-b border-slate-200 pb-6 mb-8">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">TERMS & CONDITIONS</span>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">서비스 이용약관</h1>
        <p className="text-slate-500 text-sm mt-2">
          BowlingManager 서비스 이용에 대한 회사와 회원 간의 권리, 의무 및 제반 책임사항을 규정합니다.
        </p>
      </div>

      <section className="space-y-8 text-sm leading-relaxed text-slate-700">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            제 1 조 (목적)
          </h3>
          <p className="text-slate-600">
            본 약관은 BowlingManager(이하 '회사' 또는 '본 서비스')가 제공하는 웹사이트, 모바일 웹 서비스, 동호회/대회 관리 플랫폼 및 제반 정보 서비스(이하 '서비스')의 이용조건, 절차, 이용자와 회사의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            제 2 조 (약관의 효력 및 개정)
          </h3>
          <ul className="list-disc ml-6 space-y-2 text-slate-600">
            <li>본 약관은 서비스 웹사이트 초기 화면 또는 하단 링크에 게시함으로써 효력이 발생합니다.</li>
            <li>회사는 관련 법률(전자상거래법, 약관규제법, 정보통신망법 등)을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 약관을 개정할 경우 적용일자 7일 전부터 서비스 내에 공지합니다.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            제 3 조 (서비스의 제공 및 변경)
          </h3>
          <p className="text-slate-600 mb-2">회사는 이용자에게 다음과 같은 서비스를 제공합니다.</p>
          <ul className="list-disc ml-6 space-y-1 text-slate-600">
            <li>개인 볼링 점수 기록 아카이빙 및 에버리지/5대 기량 통계 리포트 제공</li>
            <li>동호회(팀) 생성, 회원 초대 코드 연동, 정기전 점수 집계 및 출석 관리</li>
            <li>볼링장 센터 및 상주리그/공식 챔프전 대진표 작성 및 실시간 리더보드 서비스</li>
            <li>볼링 백과사전, 규정 안내, 마이볼 지공 스펙 및 가이드 정보 서비스</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            제 4 조 (회원의 의무 및 금지행위)
          </h3>
          <p className="text-slate-600 mb-2">회원은 서비스 이용 시 다음 각 호의 행위를 하여서는 안 됩니다.</p>
          <ul className="list-disc ml-6 space-y-1 text-slate-600">
            <li>타인의 이메일, 계정 정보를 도용하거나 허위 사실을 등록하는 행위</li>
            <li>동호회 및 대회 점수를 고의적으로 허위 기재하거나 조작하는 행위</li>
            <li>회사의 지적재산권 또는 제3자의 저작권을 침해하는 무단 복제 및 상업적 재배포</li>
            <li>서비스의 안정적 운영을 방해하는 해킹, 컴퓨터 바이러스 유포, 자동 접속 프로그램을 이용한 시스템 과부하 유발 행위</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            제 5 조 (게시물의 저작권 및 서비스 이용 제한)
          </h3>
          <ul className="list-disc ml-6 space-y-2 text-slate-600">
            <li>회원이 서비스 내에 게시한 게시물의 저작권은 해당 회원에게 귀속되며, 회사는 서비스 내 노출 및 홍보 목적으로 사용할 수 있습니다.</li>
            <li>회원이 본 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우, 회사는 경고, 일시정지, 영구이용정지 등의 단계별 이용 제한 조치를 취할 수 있습니다.</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            제 6 조 (면책 조항)
          </h3>
          <ul className="list-disc ml-6 space-y-2 text-slate-600">
            <li>회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중단 등 불가항력으로 인하여 서비스를 제공할 수 없는 경우 서비스 제공에 대한 책임이 면제됩니다.</li>
            <li>회사는 이용자의 귀책사유로 인한 서비스 이용의 장애 및 데이터 손실에 대해 책임을 지지 않으며, 무료로 제공되는 정보 서비스에 대해서는 법령에 특별한 규정이 없는 한 책임을 지지 않습니다.</li>
          </ul>
        </div>

        <div className="pt-8 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs text-slate-400">
          <p>공고 일자: 2024년 01월 01일 | 개정 일자: 2026년 08월 24일</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
            <Link href="/disclaimer" className="hover:underline">책임 한계 및 법적 고지</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
