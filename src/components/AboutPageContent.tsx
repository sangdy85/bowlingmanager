'use client';

import { useState, useTransition } from 'react';
import { createInquiry, answerInquiry } from '@/app/actions/inquiry-actions';

interface InquiryWithAuthor {
    id: string;
    title: string;
    content: string;
    status: string;
    answer: string | null;
    createdAt: Date;
    author: { name: string };
}

export default function AboutPageContent({
    initialInquiries,
    isAdmin,
    isLoggedIn
}: {
    initialInquiries: any[],
    isAdmin: boolean,
    isLoggedIn: boolean
}) {
    const [activeTab, setActiveTab] = useState('intro');
    const [inquiries, setInquiries] = useState<InquiryWithAuthor[]>(initialInquiries);
    const [isPending, startTransition] = useTransition();

    const [form, setForm] = useState({ title: '', content: '' });

    const handleSubmitInquiry = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const res = await createInquiry(form);
            if (res.success) {
                alert('문의가 등록되었습니다.');
                setForm({ title: '', content: '' });
                // Note: In real app, we'd refetch or update state
                window.location.reload();
            } else {
                alert(res.error);
            }
        });
    };

    const handleAnswer = async (id: string, answer: string) => {
        if (!answer.trim()) return;
        startTransition(async () => {
            const res = await answerInquiry(id, answer);
            if (res.success) {
                alert('답변이 등록되었습니다.');
                window.location.reload();
            } else {
                alert(res.error);
            }
        });
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-center">사이트 소개</h1>

            {/* Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-8 border-b">
                <button
                    onClick={() => setActiveTab('intro')}
                    className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'intro' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    사이트 소개
                </button>
                <button
                    onClick={() => setActiveTab('guide')}
                    className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'guide' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    사용 방법
                </button>
                <button
                    onClick={() => setActiveTab('inquiry')}
                    className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'inquiry' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    문의 게시판
                </button>
                <button
                    onClick={() => setActiveTab('terms')}
                    className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'terms' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    약관 및 정책
                </button>
            </div>

            {/* Content Sections */}
            <div className="bg-white rounded-lg shadow-sm p-6 md:p-10 border">
                {activeTab === 'intro' && (
                    <div className="prose max-w-none">
                        <h2 className="text-2xl font-bold mb-6">BowlingManager에 오신 것을 환영합니다</h2>
                        <p className="text-lg text-gray-700 leading-relaxed mb-4">
                            BowlingManager는 볼링 매니아와 동호회를 위한 올인원 점수 관리 및 토너먼트 플랫폼입니다.
                            복잡한 수기 기록이나 엑셀 관리에서 벗어나, 데이터 기반의 체계적인 볼링 라이프를 경험하세요.
                        </p>
                        <div className="grid md:grid-cols-2 gap-8 mt-10">
                            <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
                                <h3 className="text-xl font-bold text-blue-800 mb-3">개인 점수 관리</h3>
                                <p className="text-gray-600">지속적인 점수 기록을 통해 자신의 실력 향상 추이를 확인하고 통계 데이터를 분석할 수 있습니다.</p>
                            </div>
                            <div className="p-6 bg-green-50 rounded-xl border border-green-100">
                                <h3 className="text-xl font-bold text-green-800 mb-3">팀 및 동호회 운영</h3>
                                <p className="text-gray-600">팀원을 초대하고 정기전 점수를 함께 관리하며, 실시간 랭킹과 기록을 공유합니다.</p>
                            </div>
                            <div className="p-6 bg-purple-50 rounded-xl border border-purple-100">
                                <h3 className="text-xl font-bold text-purple-800 mb-3">토너먼트 및 상주리그</h3>
                                <p className="text-gray-600">볼링장에서 주최하는 대회를 신청하고, 실시간 스코어보드와 결과를 투명하게 확인하세요.</p>
                            </div>
                            <div className="p-6 bg-orange-50 rounded-xl border border-orange-100">
                                <h3 className="text-xl font-bold text-orange-800 mb-3">스마트한 기록 입력</h3>
                                <p className="text-gray-600">OCR 이미지 업로드, 엑셀 업로드 등 다양한 방식을 통해 수십 명의 점수도 순식간에 입력할 수 있습니다.</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'guide' && (
                    <div className="prose max-w-none">
                        <h2 className="text-2xl font-bold mb-6">회원 주요 기능 사용법</h2>

                        <div className="space-y-10">
                            <section>
                                <h3 className="text-xl font-semibold border-l-4 border-primary pl-4 mb-4">1. 개인 점수 기록하기</h3>
                                <p className="text-gray-600 mb-2">상단 메뉴의 <strong>'점수 기록'</strong> 버튼을 클릭하세요.</p>
                                <ul className="list-disc pl-6 text-gray-600 space-y-1">
                                    <li>직접 입력: 날짜와 게임 점수를 하나씩 입력합니다.</li>
                                    <li>스마트 업로드: 모니터 점수판 사진을 찍어 올리면 AI가 자동으로 점수를 추출합니다.</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold border-l-4 border-primary pl-4 mb-4">2. 팀(동호회) 생성 및 관리</h3>
                                <p className="text-gray-600 mb-2"><strong>'팀 관리'</strong> 메뉴에서 우리 팀만의 공간을 만드세요.</p>
                                <ul className="list-disc pl-6 text-gray-600 space-y-1">
                                    <li>팀 생성 후 발급되는 <strong>팀 코드</strong>를 팀원들에게 공유하세요.</li>
                                    <li>팀원 관리: 팀원이 코드로 가입 신청을 하면 관리자가 승인할 수 있습니다.</li>
                                    <li>팀 게시판: 공지사항이나 활동 사진을 공유하세요.</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold border-l-4 border-primary pl-4 mb-4">3. 볼링장 및 대회 참여</h3>
                                <p className="text-gray-600 mb-2"><strong>'볼링장/대회'</strong> 메뉴를 통해 주변 볼링장을 확인하세요.</p>
                                <ul className="list-disc pl-6 text-gray-600 space-y-1">
                                    <li>단골 볼링장에 가입하면 해당 볼링장의 이벤트 및 대회 소식을 받을 수 있습니다.</li>
                                    <li>진행 중인 상주리그나 이벤트 대회에 원클릭으로 참가 신청이 가능합니다.</li>
                                </ul>
                            </section>
                        </div>
                    </div>
                )}

                {activeTab === 'inquiry' && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">문의 게시판</h2>

                        {isLoggedIn ? (
                            <form onSubmit={handleSubmitInquiry} className="mb-10 p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <h3 className="font-semibold mb-4">새로운 문의사항 작성</h3>
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="제목을 입력하세요"
                                        required
                                        className="w-full p-3 border rounded-md focus:ring-2 focus:ring-primary outline-none"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                    />
                                    <textarea
                                        placeholder="내용을 상세히 적어주시면 빠르게 답변해 드리겠습니다."
                                        required
                                        rows={4}
                                        className="w-full p-3 border rounded-md focus:ring-2 focus:ring-primary outline-none"
                                        value={form.content}
                                        onChange={e => setForm({ ...form, content: e.target.value })}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isPending}
                                        className="btn btn-primary w-full md:w-auto px-10"
                                    >
                                        {isPending ? '등록 중...' : '문의하기'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="mb-10 p-6 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-100 text-center">
                                문의사항을 작성하려면 먼저 로그인이 필요합니다.
                            </div>
                        )}

                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg border-b pb-2">문의 내역</h3>
                            {inquiries.length === 0 ? (
                                <p className="text-center py-10 text-gray-400">등록된 문의사항이 없습니다.</p>
                            ) : (
                                inquiries.map(inq => (
                                    <div key={inq.id} className="border rounded-lg overflow-hidden group">
                                        <div className="p-4 bg-white flex justify-between items-center">
                                            <div>
                                                <span className={`inline-block px-2 py-1 rounded text-xs font-bold mr-2 ${inq.status === 'ANSWERED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {inq.status === 'ANSWERED' ? '답변완료' : '검토중'}
                                                </span>
                                                <span className="font-medium">{inq.title}</span>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {inq.author.name} | {new Date(inq.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-gray-50 text-gray-700 border-t whitespace-pre-wrap">
                                            {inq.content}
                                        </div>
                                        {inq.answer && (
                                            <div className="p-4 bg-blue-50 border-t">
                                                <div className="flex items-center gap-2 mb-2 font-bold text-blue-800">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                                    관리자 답변
                                                </div>
                                                <p className="text-blue-900 whitespace-pre-wrap">{inq.answer}</p>
                                            </div>
                                        )}
                                        {isAdmin && inq.status === 'PENDING' && (
                                            <div className="p-4 border-t bg-gray-100">
                                                <textarea
                                                    id={`answer-${inq.id}`}
                                                    placeholder="답변 내용을 입력하세요..."
                                                    className="w-full p-2 border rounded mb-2"
                                                    rows={2}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const el = document.getElementById(`answer-${inq.id}`) as HTMLTextAreaElement;
                                                        handleAnswer(inq.id, el.value);
                                                    }}
                                                    className="btn btn-primary btn-sm"
                                                >
                                                    답변 등록
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'terms' && (
                    <div className="prose max-w-none text-sm text-gray-700">
                        <div className="mb-10">
                            <h2 className="text-2xl font-bold mb-6 text-black">이용 약관</h2>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto p-4 border bg-gray-50 rounded">
                                <p><strong>제 1조 (목적)</strong><br />본 약관은 BowlingManager(이하 "회사")가 제공하는 서비스의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
                                <p><strong>제 2조 (서비스의 내용)</strong><br />회사는 회원에게 볼링 점수 기록, 팀 관리, 대회 정보 제공 등의 서비스를 제공합니다.</p>
                                <p><strong>제 3조 (회원가입)</strong><br />사용자는 회사가 정한 양식에 따라 회원정보를 기입함으로써 회원가입을 신청합니다.</p>
                                <p><strong>제 4조 (서비스의 중단)</strong><br />회사는 컴퓨터 등 정보통신설비의 보수점검·교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.</p>
                                <p>... (생략)</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold mb-6 text-black">개인정보 처리방침</h2>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto p-4 border bg-gray-50 rounded">
                                <p><strong>1. 수집하는 개인정보 항목</strong><br />회사는 회원가입, 상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.<br />- 수집항목: 이름, 이메일, 암호화된 비밀번호 등</p>
                                <p><strong>2. 개인정보의 수집 및 이용목적</strong><br />회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.<br />- 서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금정산, 회원 관리</p>
                                <p><strong>3. 개인정보의 보유 및 이용기간</strong><br />원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.</p>
                                <p><strong>4. 개인정보 보호를 위한 기술적 대책</strong><br />회사는 해킹이나 컴퓨터 바이러스 등에 의한 개인정보 유출 및 훼손을 막기 위하여 보안 프로그램을 설치하고 주기적인 갱신·점검을 합니다.</p>
                                <p>... (생략)</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
