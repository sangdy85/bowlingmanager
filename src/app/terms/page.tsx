'use client';

export default function TermsOfService() {
    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-8">서비스 이용약관</h1>
            
            <section className="space-y-6 text-sm leading-relaxed text-slate-700">
                <p>
                    <strong>BowlingManager</strong>(이하 '회사')는 이용자에게 볼링 점수 관리 서비스를 제공하며, 본 약관은 서비스 이용에 관한 권리와 의무, 책임사항을 규정함을 목적으로 합니다.
                </p>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">제1조 (목적)</h3>
                    <p>본 약관은 회사가 제공하는 웹 사이트 및 관련 제반 서비스(이하 '서비스')를 이용함에 있어 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">제2조 (약관의 효력 및 변경)</h3>
                    <ul className="list-disc ml-5 mt-2">
                        <li>회사는 본 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다.</li>
                        <li>회사는 관련 법령을 위배하지 않는 범위 내에서 이 약관을 개정할 수 있습니다.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">제3조 (서비스 이용계약의 체결)</h3>
                    <p>이용자가 약관의 내용에 대하여 동의를 하고 회원가입 신청을 한 후 회사가 승낙함으로써 체결됩니다.</p>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">제4조 (회사의 의무)</h3>
                    <p>회사는 지속적이고 안정적인 서비스 제공을 위하여 최선을 다하며, 이용자의 개인정보 보호를 위한 보안 시스템을 갖추어야 합니다.</p>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">제5조 (이용자의 의무)</h3>
                    <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
                    <ul className="list-disc ml-5 mt-2">
                        <li>신청 또는 변경 시 허위 내용의 등록</li>
                        <li>타인의 정보 도용</li>
                        <li>회사가 게시한 정보의 변경</li>
                        <li>회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">제6조 (면책 조항)</h3>
                    <ul className="list-disc ml-5 mt-2">
                        <li>회사는 천재지변 또는 불가항력으로 인하여 서비스를 제공할 수 없는 경우 서비스 제공에 대한 책임이 면제됩니다.</li>
                        <li>회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.</li>
                    </ul>
                </div>

                <div className="pt-8 border-t">
                    <p className="text-xs text-slate-400 italic">공고일자: 2024년 01월 01일 | 시행일자: 2024년 01월 01일</p>
                </div>
            </section>
        </div>
    );
}
