'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createInquiry, answerInquiry, deleteInquiry } from '@/app/actions/inquiry-actions';

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
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('intro');
    const [inquiries, setInquiries] = useState<InquiryWithAuthor[]>(initialInquiries);
    const [isPending, startTransition] = useTransition();

    const [adminFilter, setAdminFilter] = useState<'all' | 'pending'>('pending');

    // Sort and filter inquiries
    const sortedInquiries = [...inquiries].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const filteredInquiries = isAdmin && adminFilter === 'pending'
        ? sortedInquiries.filter(i => i.status === 'PENDING')
        : sortedInquiries;

    const [form, setForm] = useState({ title: '', content: '' });

    const handleSubmitInquiry = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const res = await createInquiry(form);
            if (res.success) {
                alert('문의가 등록되었습니다.');
                setForm({ title: '', content: '' });
                router.refresh();
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
                router.refresh();
            } else {
                alert(res.error);
            }
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        startTransition(async () => {
            const res = await deleteInquiry(id);
            if (res.success) {
                router.refresh();
            } else {
                alert(res.error);
            }
        });
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-center text-gray-900">사이트 소개</h1>

            {/* Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-8 border-b">
                {[
                    { id: 'intro', label: '사이트 소개' },
                    { id: 'guide', label: '사용 방법' },
                    { id: 'inquiry', label: '문의 게시판' },
                    { id: 'terms', label: '약관 및 정책' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-3 font-semibold transition-colors ${activeTab === tab.id ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Sections */}
            <div className="bg-white rounded-lg shadow-sm p-6 md:p-10 border border-gray-200">
                {activeTab === 'intro' && (
                    <div className="prose max-w-none">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">BowlingManager에 오신 것을 환영합니다</h2>
                        <p className="text-lg text-gray-700 leading-relaxed mb-6">
                            BowlingManager는 볼링 매니아와 동호회를 위한 올인원 점수 관리 및 토너먼트 플랫폼입니다.
                            복잡한 수기 기록이나 엑셀 관리에서 벗어나, 데이터 기반의 체계적인 볼링 라이프를 경험하세요.
                        </p>
                        <div className="grid md:grid-cols-2 gap-6 mt-10">
                            {[
                                { title: '개인 점수 관리', desc: '지속적인 점수 기록을 통해 자신의 실력 향상 추이를 확인하고 통계 데이터를 분석할 수 있습니다.', color: 'blue' },
                                { title: '팀 및 동호회 운영', desc: '팀원을 초대하고 정기전 점수를 함께 관리하며, 실시간 랭킹과 기록을 공유합니다.', color: 'green' },
                                { title: '토너먼트 및 상주리그', desc: '볼링장에서 주최하는 대회를 신청하고, 실시간 스코어보드와 결과를 투명하게 확인하세요.', color: 'purple' },
                                { title: '스마트한 기록 입력', desc: 'OCR 이미지 업로드, 엑셀 업로드 등 다양한 방식을 통해 수십 명의 점수도 순식간에 입력할 수 있습니다.', color: 'orange' }
                            ].map((feat, i) => (
                                <div key={i} className={`p-6 bg-${feat.color}-50 rounded-xl border border-${feat.color}-100`}>
                                    <h3 className={`text-xl font-bold text-${feat.color}-800 mb-3`}>{feat.title}</h3>
                                    <p className="text-gray-600">{feat.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'guide' && (
                    <div className="prose max-w-none">
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">회원 주요 기능 사용법</h2>
                        <div className="space-y-10">
                            {[
                                { title: '1. 개인 점수 기록하기', body: <><p className="text-gray-600 mb-2">상단 메뉴의 <strong>'점수 기록'</strong> 버튼을 클릭하세요.</p><ul className="list-disc pl-6 text-gray-600 space-y-1"><li>직접 입력: 날짜와 게임 점수를 하나씩 입력합니다.</li><li>스마트 업로드: 모니터 점수판 사진을 찍어 올리면 AI가 자동으로 점수를 추출합니다.</li></ul></> },
                                { title: '2. 팀(동호회) 생성 및 관리', body: <><p className="text-gray-600 mb-2"><strong>'팀 관리'</strong> 메뉴에서 우리 팀만의 공간을 만드세요.</p><ul className="list-disc pl-6 text-gray-600 space-y-1"><li>팀 생성 후 발급되는 <strong>팀 코드</strong>를 팀원들에게 공유하세요.</li><li>팀원 관리: 팀원이 코드로 가입 신청을 하면 관리자가 승인할 수 있습니다.</li><li>팀 게시판: 공지사항이나 활동 사진을 공유하세요.</li></ul></> },
                                { title: '3. 볼링장 및 대회 참여', body: <><p className="text-gray-600 mb-2"><strong>'볼링장/대회'</strong> 메뉴를 통해 주변 볼링장을 확인하세요.</p><ul className="list-disc pl-6 text-gray-600 space-y-1"><li>단골 볼링장에 가입하면 해당 볼링장의 이벤트 및 대회 소식을 받을 수 있습니다.</li><li>진행 중인 상주리그나 이벤트 대회에 원클릭으로 참가 신청이 가능합니다.</li></ul></> }
                            ].map((item, i) => (
                                <section key={i}>
                                    <h3 className="text-xl font-semibold border-l-4 border-primary pl-4 mb-4 text-gray-800">{item.title}</h3>
                                    {item.body}
                                </section>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'inquiry' && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-800">문의 게시판</h2>

                        {isLoggedIn ? (
                            <form onSubmit={handleSubmitInquiry} className="mb-10 p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                <h3 className="font-semibold mb-4 text-gray-700">새로운 문의사항 작성</h3>
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="제목을 입력하세요"
                                        required
                                        className="w-full p-3 border rounded-md focus:ring-2 focus:ring-primary outline-none text-gray-900"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                    />
                                    <textarea
                                        placeholder="내용을 상세히 적어주시면 빠르게 답변해 드리겠습니다."
                                        required
                                        rows={4}
                                        className="w-full p-3 border rounded-md focus:ring-2 focus:ring-primary outline-none text-gray-900"
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

                        <div className="space-y-6">
                            <div className="flex justify-between items-center border-b pb-4">
                                <h3 className="font-bold text-lg text-gray-800">문의 내역</h3>
                                {isAdmin && (
                                    <div className="flex bg-gray-100 p-1 rounded-md text-sm border border-gray-200">
                                        <button
                                            onClick={() => setAdminFilter('pending')}
                                            className={`px-4 py-1.5 rounded-sm transition-all ${adminFilter === 'pending' ? 'bg-white shadow-sm font-bold text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            미답변
                                        </button>
                                        <button
                                            onClick={() => setAdminFilter('all')}
                                            className={`px-4 py-1.5 rounded-sm transition-all ${adminFilter === 'all' ? 'bg-white shadow-sm font-bold text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            전체
                                        </button>
                                    </div>
                                )}
                            </div>

                            {filteredInquiries.length === 0 ? (
                                <p className="text-center py-20 text-gray-400">등록된 문의사항이 없습니다.</p>
                            ) : (
                                filteredInquiries.map(inq => (
                                    <div key={inq.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
                                        <div className="p-5 flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${inq.status === 'ANSWERED' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                                                        {inq.status === 'ANSWERED' ? '답변완료' : '검토중'}
                                                    </span>
                                                    <h4 className="font-bold text-gray-900 text-lg leading-tight">{inq.title}</h4>
                                                </div>
                                                <div className="text-sm text-gray-500 font-medium">
                                                    {inq.author.name} · {new Date(inq.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleDelete(inq.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    title="문의 삭제"
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
                                                </button>
                                            )}
                                        </div>
                                        <div className="px-5 pb-5 text-gray-700 text-base leading-relaxed whitespace-pre-wrap border-b border-gray-50">
                                            {inq.content}
                                        </div>
                                        {inq.answer && (
                                            <div className="p-5 bg-blue-50/50">
                                                <div className="flex items-center gap-2 mb-2 font-black text-blue-800 text-sm">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                                    관리자 답변
                                                </div>
                                                <p className="text-blue-900 leading-relaxed whitespace-pre-wrap">{inq.answer}</p>
                                            </div>
                                        )}
                                        {isAdmin && inq.status === 'PENDING' && (
                                            <div className="p-5 border-t border-gray-100 bg-gray-50">
                                                <textarea
                                                    id={`answer-${inq.id}`}
                                                    placeholder="질문에 대한 답변을 입력하세요..."
                                                    className="w-full p-4 border border-gray-200 rounded-xl mb-3 focus:ring-2 focus:ring-primary outline-none text-gray-900 bg-white"
                                                    rows={3}
                                                />
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={() => {
                                                            const el = document.getElementById(`answer-${inq.id}`) as HTMLTextAreaElement;
                                                            handleAnswer(inq.id, el.value);
                                                        }}
                                                        disabled={isPending}
                                                        className="btn btn-primary px-8"
                                                    >
                                                        답변 등록하기
                                                    </button>
                                                </div>
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
                        <div className="mb-12">
                            <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b pb-2">이용 약관</h2>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto p-5 border border-gray-200 bg-gray-50 rounded-xl scrollbar-thin">
                                <p><strong>제 1조 (목적)</strong><br />본 약관은 BowlingManager(이하 "회사")가 제공하는 서비스의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
                                <p><strong>제 2조 (서비스의 내용)</strong><br />회사는 회원에게 볼링 점수 기록, 팀 관리, 대회 정보 제공 등의 서비스를 제공합니다.</p>
                                <p><strong>제 3조 (회원가입)</strong><br />사용자는 회사가 정한 양식에 따라 회원정보를 기입함으로써 회원가입을 신청합니다.</p>
                                <p><strong>제 4조 (서비스의 중단)</strong><br />회사는 컴퓨터 등 정보통신설비의 보수점검·교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.</p>
                                <p>... (약관 전문 생략 - AdSense 제출 시 정식 약관으로 대체하십시오)</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b pb-2">개인정보 처리방침</h2>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto p-5 border border-gray-200 bg-gray-50 rounded-xl scrollbar-thin">
                                <p><strong>1. 수집하는 개인정보 항목</strong><br />회사는 회원가입, 상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.<br />- 수집항목: 이름, 이메일, 암호화된 비밀번호 등</p>
                                <p><strong>2. 개인정보의 수집 및 이용목적</strong><br />회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.<br />- 서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금정산, 회원 관리</p>
                                <p><strong>3. 개인정보의 보유 및 이용기간</strong><br />원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.</p>
                                <p><strong>4. 개인정보 보호를 위한 기술적 대책</strong><br />회사는 해킹이나 컴퓨터 바이러스 등에 의한 개인정보 유출 및 훼손을 막기 위하여 보안 프로그램을 설치하고 주기적인 갱신·점검을 합니다.</p>
                                <p>... (방침 전문 생략 - AdSense 제출 시 정식 방침으로 대체하십시오)</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
