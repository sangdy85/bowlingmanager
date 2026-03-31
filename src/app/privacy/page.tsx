'use client';

export default function PrivacyPolicy() {
    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-8">개인정보처리방침</h1>
            
            <section className="space-y-6 text-sm leading-relaxed text-slate-700">
                <p>
                    <strong>BowlingManager</strong>(이하 '회사')는 이용자의 개인정보를 보호하고 관련 법령을 준수하며, 개인정보와 관련한 이용자의 고충을 원활하게 처리할 수 있도록 다음과 같은 처리방침을 두고 있습니다.
                </p>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">1. 수집하는 개인정보 항목</h3>
                    <p>회사는 회원가입, 서비스 제공 등을 위해 다음과 같은 개인정보를 수집합니다.</p>
                    <ul className="list-disc ml-5 mt-2">
                        <li>필수항목: 이름, 이메일 주소, 로그인 아이디, 비밀번호</li>
                        <li>자동수집항목: IP 주소, 쿠키, 서비스 이용 기록, 접속 로그</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">2. 개인정보의 수집 및 이용 목적</h3>
                    <p>회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
                    <ul className="list-disc ml-5 mt-2">
                        <li>서비스 제공 및 관리: 본인 식별, 가입 의사 확인, 점수 기록 보관 등</li>
                        <li>고객 문의 처리: 1:1 문의 응대 및 안내</li>
                        <li>서비스 개선 및 마케팅: 신규 서비스 개발, 접속 빈도 파악, 통계학적 특성에 따른 서비스 제공</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">3. 개인정보의 보유 및 이용기간</h3>
                    <p>이용자의 개인정보는 원칙적으로 개인정보의 수집 및 이용목적이 달성되면 지체없이 파기합니다. 단, 관련 법령의 규정에 의하여 보존할 필요가 있는 경우 해당 법령에서 정한 일정 기간 동안 회원정보를 보관합니다.</p>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">4. 개인정보의 파기절차 및 방법</h3>
                    <p>회사는 목적이 달성된 개인정보를 전자적 파일 형태인 경우 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제하며, 종이에 출력된 개인정보는 분쇄기로 분쇄하거나 소각하여 파기합니다.</p>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">5. 이용자의 권리와 그 행사방법</h3>
                    <p>이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며 가입해지를 요청할 수도 있습니다. 서면, 전화 또는 이메일로 연락하시면 지체 없이 조치하겠습니다.</p>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">6. 개인정보 보호책임자</h3>
                    <p>회사는 개인정보를 보호하고 개인정보와 관련한 불만을 처리하기 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
                    <ul className="list-disc ml-5 mt-2">
                        <li>담당자: 관리자 (Admin)</li>
                        <li>이메일: info@bowlingmanager.co.kr</li>
                    </ul>
                </div>

                <div className="pt-8 border-t">
                    <p className="text-xs text-slate-400 italic">공고일자: 2024년 01월 01일 | 시행일자: 2024년 01월 01일</p>
                </div>
            </section>
        </div>
    );
}
