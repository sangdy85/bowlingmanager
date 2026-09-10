import Link from 'next/link';

export const metadata = {
  title: '개인정보처리방침 | BowlingManager',
  description: 'BowlingManager 서비스의 개인정보 수집, 이용 목적, 구글 애드센스 쿠키 사용 고지 및 보호 정책 안내입니다.',
};

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <div className="border-b border-slate-200 pb-6 mb-8">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">LEGAL & PRIVACY</span>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">개인정보처리방침</h1>
        <p className="text-slate-500 text-sm mt-2">
          BowlingManager(이하 '회사' 또는 '본 서비스')는 이용자의 개인정보 및 권익을 보호하고 관련 법령을 준수하기 위해 최선을 다하고 있습니다.
        </p>
      </div>

      <section className="space-y-8 text-sm leading-relaxed text-slate-700">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            1. 수집하는 개인정보 항목 및 수집 방법
          </h3>
          <p className="mb-2">회사는 회원가입, 고객 문의, 서비스 제공을 위해 아래와 같은 минима 수의 개인정보를 수집하고 있습니다.</p>
          <ul className="list-disc ml-6 space-y-1 text-slate-600">
            <li><strong>필수 수집 항목</strong>: 이메일 주소, 비밀번호, 닉네임/이름, 사용자 역할(일반/관리자)</li>
            <li><strong>소셜 가입 시</strong>: 구글/네이버 고유 식별자(ID), 프로필 이메일</li>
            <li><strong>서비스 이용 과정 자동 생성 항목</strong>: IP 주소, 서비스 방문 및 이용 기록, 접속 로그, 쿠키(Cookie), 기기 브라우저 정보</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            2. 개인정보의 수집 및 이용 목적
          </h3>
          <p className="mb-2">수집된 개인정보는 다음의 목적 이외의 용도로는 사용되지 않으며, 이용 목적이 변경될 시 사전 동의를 구할 예정입니다.</p>
          <ul className="list-disc ml-6 space-y-1 text-slate-600">
            <li><strong>본인 확인 및 서비스 관리</strong>: 회원제 서비스 제공, 개인 스코어 아카이빙, 동호회 및 대회 리더보드 연동</li>
            <li><strong>고객 지원</strong>: 1:1 고객 문의 응대, 공지사항 전달, 서비스 이용 관련 안내</li>
            <li><strong>서비스 분석 및 품질 향상</strong>: 서비스 접속 빈도 파악, 맞춤형 정보 제공 및 서비스 이용 통계 분석</li>
          </ul>
        </div>

        {/* GOOGLE ADSENSE MANDATORY CLAUSE */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3">
          <h3 className="text-lg font-extrabold text-blue-900 mb-2 border-l-4 border-blue-600 pl-3">
            3. 구글(Google) 애드센스 및 제3자 광고 사업자 쿠키(Cookie) 게재 고지 (필수 고지)
          </h3>
          <p className="text-slate-700 text-sm leading-relaxed">
            본 웹사이트는 이용자에게 최선의 무료 정보 콘텐츠를 제공하기 위해 **Google Inc.의 웹 분석 및 맞춤형 광고 게재 서비스인 구글 애드센스(Google AdSense)**를 활용합니다.
          </p>
          <ul className="list-disc ml-6 space-y-2 text-slate-600 text-xs md:text-sm">
            <li>
              **제3자 제공업체 및 광고 네트워크**: 구글을 포함한 제3자 제공업체는 쿠키(Cookie)를 사용하여 사용자의 이전 웹사이트 방문 기록을 바탕으로 맞춤형 광고를 제공합니다.
            </li>
            <li>
              **DART 쿠키 사용 고지**: 구글은 광고 쿠키를 사용하여 본 사이트 및 인터넷상의 다른 사이트 방문 정보를 기반으로 사용자에게 적절한 광고를 제공할 수 있습니다.
            </li>
            <li>
              **맞춤형 광고 수신 거부 (Opt-Out)**: 이용자는 구글 광고 설정 페이지(
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline font-bold"
              >
                https://adssettings.google.com
              </a>
              )를 방문하여 맞춤형 광고 게재 기능을 언제든지 거부(비활성화)하실 수 있습니다. 또는 네트워크 광고 이니셔티브(
              <a
                href="https://www.aboutads.info/choices"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline font-bold"
              >
                www.aboutads.info
              </a>
              ) 웹사이트를 통해 제3자 제공업체의 쿠키 사용을 차단하실 수 있습니다.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            4. 쿠키(Cookie)의 설치·운영 및 거부 방법
          </h3>
          <p className="text-slate-600 mb-2">
            이용자는 웹 브라우저의 옵션을 설정함으로써 모든 쿠키를 허용하거나, 쿠키가 저장될 때마다 확인을 거치거나, 모든 쿠키의 저장을 거부할 수 있습니다.
          </p>
          <div className="bg-slate-100 p-4 rounded-xl text-xs text-slate-600">
            <strong>설정 방법 (Chrome 예시)</strong>: 웹 브라우저 상단 설정 ➜ 개인정보 보호 및 보안 ➜ 쿠키 및 기타 사이트 데이터 ➜ 쿠키 차단 옵션 선택
          </div>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            5. 개인정보의 보유 및 파기 절차
          </h3>
          <p className="text-slate-600">
            이용자의 개인정보는 회원 탈퇴 시 또는 수집 목적이 달성된 후 지체 없이 전자적 방법으로 안전하게 파기됩니다. 단, 상법 및 관련 법령의 규정에 의하여 보존할 필요가 있는 경우 해당 법정 보관 기간 동안 별도 DB로 분리 보관됩니다.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            6. 이용자의 권리와 행사 방법
          </h3>
          <p className="text-slate-600">
            이용자는 언제든지 본인의 개인정보 열람, 정지, 수정, 삭제(회원 탈퇴)를 요구할 수 있으며, 서비스 내 [계정 설정] 또는 [고객 문의] 페이지를 통해 신청하시면 지체 없이 처리해 드립니다.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-slate-900 mb-3 border-l-4 border-blue-600 pl-3">
            7. 개인정보 보호책임자 및 담당자 안내
          </h3>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-700">
            <p><strong>개인정보 보호책임자</strong>: BowlingManager 운영 관리팀</p>
            <p><strong>이메일 문의</strong>: info@bowlingmanager.co.kr</p>
            <p><strong>고객지원 페이지</strong>: <Link href="/inquiry" className="text-blue-600 underline">1:1 문의하기 센터 바로가기</Link></p>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs text-slate-400">
          <p>공고 일자: 2024년 01월 01일 | 개정 일자: 2026년 08월 24일</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:underline">이용약관</Link>
            <Link href="/disclaimer" className="hover:underline">책임 한계 및 법적 고지</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
