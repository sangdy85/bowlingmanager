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
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-extrabold mb-4 text-gray-900">당신의 볼링 라이프를 데이터로 혁신합니다</h2>
                            <p className="text-xl text-gray-600">BowlingManager는 볼링의 스릴과 데이터의 정교함을 연결하는 국내 최고의 점수 관리 및 토너먼트 플랫폼입니다.</p>
                        </div>

                        <div className="space-y-12">
                            <section>
                                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                                    <span className="w-2 h-8 bg-primary rounded-full"></span>
                                    왜 BowlingManager인가요?
                                </h3>
                                <p className="text-lg text-gray-700 leading-relaxed">
                                    기존의 아날로그 방식이나 단순 기록 앱은 데이터의 활용에 한계가 있었습니다.
                                    우리는 단순히 점수를 '저장'하는 것을 넘어, 기록을 '분석'하고 동료들과 '공유'하며
                                    볼링장과 '연결'되는 통합 기술 생태계를 제공합니다.
                                    상주리그 운영의 투명성, 팀 관리의 효율성, 그리고 개인 기록의 성취감을 한 곳에서 경험하세요.
                                </p>
                            </section>

                            <div className="grid md:grid-cols-2 gap-8 mt-10">
                                <div className="p-8 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
                                    <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-6 text-white text-2xl">📊</div>
                                    <h3 className="text-xl font-bold text-blue-900 mb-3">정밀한 개인 데이터 분석</h3>
                                    <p className="text-gray-600 leading-relaxed">단순 에버리지를 넘어 최고/최저 점수, 변화 추이, 기간별 통계 등을 통해 당신의 약점을 분석하고 성장 로드맵을 그려줍니다.</p>
                                </div>
                                <div className="p-8 bg-green-50 rounded-2xl border border-green-100 shadow-sm">
                                    <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-6 text-white text-2xl">👥</div>
                                    <h3 className="text-xl font-bold text-green-900 mb-3">차세대 팀 매니지먼트</h3>
                                    <p className="text-gray-600 leading-relaxed">동호회 운영진을 위한 자동화 도구를 제공합니다. 팀원 가입 승인, 정기전 기록 합산, 팀 내 랭킹 산출 등을 클릭 몇 번으로 해결하세요.</p>
                                </div>
                                <div className="p-8 bg-purple-50 rounded-2xl border border-purple-100 shadow-sm">
                                    <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-6 text-white text-2xl">🎳</div>
                                    <h3 className="text-xl font-bold text-purple-900 mb-3">투명한 리그 & 토너먼트</h3>
                                    <p className="text-gray-600 leading-relaxed">볼링장 관리자와 실시간으로 시스템이 연동됩니다. 대진표 자동 배정, 실시간 스코어 업데이트, 상주리그 순위 실시간 집계를 경험하세요.</p>
                                </div>
                                <div className="p-8 bg-orange-50 rounded-2xl border border-orange-100 shadow-sm">
                                    <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-6 text-white text-2xl">📸</div>
                                    <h3 className="text-xl font-bold text-orange-900 mb-3">AI 스마트 기록 입력</h3>
                                    <p className="text-gray-600 leading-relaxed">수기 입력의 번거로움을 획기적으로 줄였습니다. OCR 기술로 점수판 사진 한 장이면 모든 게임 숫자가 라이브러리에 바로 저장됩니다.</p>
                                </div>
                            </div>

                            <div className="bg-gray-900 text-white p-10 rounded-3xl mt-12 overflow-hidden relative">
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-bold mb-4">지금 바로 시작하고 성장을 기록하세요</h3>
                                    <p className="text-gray-400 mb-6 max-w-2xl">이미 수많은 볼러들이 BowlingManager를 통해 더 똑똑한 볼링 라이프를 즐기고 있습니다. 당신의 다음 스트라이크, 우리가 기록하겠습니다.</p>
                                    <button onClick={() => setActiveTab('guide')} className="bg-white text-gray-900 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition-colors">기능 가이드 보기</button>
                                </div>
                                <div className="absolute top-0 right-0 opacity-10 scale-150 rotate-12 pointer-events-none">
                                    <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'guide' && (
                    <div className="prose max-w-none">
                        <h2 className="text-3xl font-bold mb-8 text-gray-900">BowlingManager 스마트 활용 가이드</h2>

                        <div className="space-y-12">
                            <section className="bg-gray-50 p-8 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg">01</div>
                                    <h3 className="text-2xl font-bold text-gray-800 m-0">개인 점수 관리하기</h3>
                                </div>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="bg-white p-5 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-lg mb-2 text-primary">점수 기록하기</h4>
                                        <p className="text-gray-600 text-sm mb-3">상단 '점수 기록' 메뉴에서 수기 입력, 엑셀 업로드, 사진 업로드 중 하나를 선택하세요.</p>
                                        <ul className="list-disc pl-5 text-gray-500 text-sm space-y-1 m-0">
                                            <li>AI 사진 업로드: 점수판 사진을 올리면 텍스트를 자동 인식합니다.</li>
                                            <li>엑셀 일괄 업로드: 많은 게임을 한꺼번에 등록할 때 유용합니다.</li>
                                        </ul>
                                    </div>
                                    <div className="bg-white p-5 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-lg mb-2 text-primary">데이터 분석 확인</h4>
                                        <p className="text-gray-600 text-sm mb-3">'통계/순위' 메뉴에서 나의 성장을 시각화된 그래프로 확인하세요.</p>
                                        <ul className="list-disc pl-5 text-gray-500 text-sm space-y-1 m-0">
                                            <li>연도별/월별 에버리지 추이</li>
                                            <li>최고 점수 및 게임당 평균 통계</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            <section className="bg-gray-50 p-8 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg">02</div>
                                    <h3 className="text-2xl font-bold text-gray-800 m-0">팀 및 동호회 마스터하기</h3>
                                </div>
                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-lg mb-3">팀 생성 및 팀원 모집</h4>
                                        <p className="text-gray-700 leading-relaxed mb-4">
                                            '팀 관리' 메뉴에서 [팀 생성] 버튼을 클릭해 새로운 팀을 만드세요.
                                            생성 후 발급되는 6자리의 <strong>팀 코드</strong>를 팀원들에게 공유하면, 팀원들이 코드를 입력해 가입 신청을 할 수 있습니다.
                                            관리자는 신청 목록에서 승인/거절을 선택할 수 있습니다.
                                        </p>
                                    </div>
                                    <div className="bg-white p-6 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-lg mb-3">팀 게시판 & 소통</h4>
                                        <p className="text-gray-700 leading-relaxed">
                                            우리 팀만의 전용 게시판을 활용하세요.
                                            이미지 업로드 기능을 통해 정기전 단체 사진이나 공지사항을 공유하고, 댓글로 소통할 수 있습니다.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="bg-gray-50 p-8 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg">03</div>
                                    <h3 className="text-2xl font-bold text-gray-800 m-0">볼링장 가입 및 대회 신청</h3>
                                </div>
                                <div className="bg-white p-6 rounded-xl border border-gray-200">
                                    <p className="text-gray-700 leading-relaxed mb-4">
                                        '볼링장/대회' 메뉴에서 가고 싶은 볼링장을 검색하여 '가입하기'를 누르세요.
                                        단골 볼링장으로 등록되면 해당 볼링장에서 개최하는 <strong>상주리그, 이벤트 대회</strong>의 알림을 받고 간편하게 신청할 수 있습니다.
                                    </p>
                                    <div className="p-4 bg-orange-50 border-l-4 border-orange-400 rounded">
                                        <p className="text-orange-900 text-sm m-0"><strong>Tip:</strong> 대회 신청 시 사전에 본인의 핸디캡 정보가 입력되어 있으면 더욱 정확하게 신청이 진행됩니다.</p>
                                    </div>
                                </div>
                            </section>
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
                    <div className="max-w-none text-gray-700">
                        <section className="mb-14">
                            <h2 className="text-2xl font-bold mb-8 text-gray-900 flex items-center gap-3">
                                <span className="bg-gray-900 text-white w-8 h-8 rounded flex items-center justify-center text-sm">1</span>
                                이용 약관
                            </h2>
                            <div className="space-y-6 max-h-[500px] overflow-y-auto p-8 border border-gray-200 bg-gray-50 rounded-2xl text-[14px] leading-relaxed scrollbar-thin">
                                <h4 className="font-bold text-lg text-gray-900">제 1장 총칙</h4>
                                <p><strong>제1조 (목적)</strong><br />본 약관은 BowlingManager(이하 "본 사이트" 또는 "회사")가 인터넷 서비스(이하 "서비스")를 제공함에 있어 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
                                <p><strong>제2조 (용어의 정의)</strong><br />① "회원"이란 본 사이트에 접속하여 이 약관에 따라 회원으로 가입하여 서비스를 이용하는 고객을 말합니다.<br />② "서비스"란 회사가 회원에게 제공하는 볼링 점수 관리, 팀 관리, 토너먼트 신청 및 관련 정보 일체를 의미합니다.</p>
                                <p><strong>제3조 (약관의 효력 및 변경)</strong><br />① 본 약관은 서비스 화면에 게시하거나 전송하는 방법으로 공지하며, 회원이 이에 대해 동의함으로써 효력이 발생합니다.<br />② 회사는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 제1항과 같은 방법으로 공지함으로써 효력이 발생합니다.</p>

                                <h4 className="font-bold text-lg text-gray-900 mt-8">제 2장 서비스 이용 계약</h4>
                                <p><strong>제4조 (이용계약의 성립)</strong><br />이용계약은 회원이 되고자 하는 자가 약관의 내용에 대하여 동의를 하고, 회사가 정한 가입 양식에 따라 회원정보를 기입하여 신청한 후 회사가 이를 승낙함으로써 성립합니다.</p>
                                <p><strong>제5조 (회원의 의무)</strong><br />회원은 서비스 이용과 관련하여 다음 각 호에 해당되는 행위를 하여서는 안 됩니다.<br />1. 다른 회원의 아이디 및 비밀번호를 도용하는 행위<br />2. 서비스의 안정적 운영을 방해하는 행위<br />3. 타인의 명예를 손상시키거나 불이익을 주는 행위<br />4. 기타 관계법령에 위반되는 행위</p>

                                <h4 className="font-bold text-lg text-gray-900 mt-8">제 3장 서비스 이용 및 제한</h4>
                                <p><strong>제6조 (서비스 이용 시간)</strong><br />서비스는 회사의 업무상 또는 기술상 특별한 지장이 없는 한 연중무휴 1일 24시간 제공을 원칙으로 합니다. 다만, 설비 점검 운영상의 이유로 서비스가 일시 중지될 수 있습니다.</p>
                                <p><strong>제7조 (게시물의 저작권)</strong><br />서비스에 게재된 게시물의 저작권은 해당 게시물의 작성자 또는 회사에 귀속되며, 상업적 목적으로 무단 사용 시 책임이 발생할 수 있습니다.</p>
                                <p><strong>공고일자:</strong> 2024년 3월 1일<br /><strong>시행일자:</strong> 2024년 3월 1일</p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-8 text-gray-900 flex items-center gap-3">
                                <span className="bg-gray-900 text-white w-8 h-8 rounded flex items-center justify-center text-sm">2</span>
                                개인정보 처리방침
                            </h2>
                            <div className="space-y-6 max-h-[500px] overflow-y-auto p-8 border border-gray-200 bg-gray-50 rounded-2xl text-[14px] leading-relaxed scrollbar-thin">
                                <h4 className="font-bold text-lg text-gray-900">1. 개인정보 수집 및 이용 목적</h4>
                                <p>회사는 다음의 목적을 위하여 개인정보를 처리하며, 목적 이외의 용도로는 사용하지 않습니다.<br />- 회원 가입 및 관리: 서비스 이용 의사 확인, 본인 식별, 가입 횟수 제한 등<br />- 서비스 제공: 볼링 점수 데이터 보관, 팀 가입 및 초대, 랭킹 산출 기반 데이터 활용</p>

                                <h4 className="font-bold text-lg text-gray-900 mt-8">2. 수집하는 개인정보의 항목</h4>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>필수항목: 이메일(ID), 암호화된 비밀번호, 성명</li>
                                    <li>선택항목: 핸디캡 정보, 소속 팀, 활동 볼링장 등</li>
                                    <li>자동생성항목: IP 주소, 서비스 이용 기록, 접속 로그, 쿠키 등</li>
                                </ul>

                                <h4 className="font-bold text-lg text-gray-900 mt-8">3. 개인정보의 보유 및 이용 기간</h4>
                                <p>회사는 회원 탈퇴 시까지 사용자 정보를 보유하며, 법령에 따른 의무 기간이 종료된 후에는 지체 없이 해킹 및 복구가 불가능한 방법으로 파기합니다.</p>

                                <h4 className="font-bold text-lg text-gray-900 mt-8">4. 이용자 및 법정대리인의 권리</h4>
                                <p>정보주체는 언제든지 본인의 개인정보를 열람, 수정하거나 가입 해지(탈퇴)를 요청할 수 있습니다.</p>

                                <h4 className="font-bold text-lg text-gray-900 mt-8">5. 구글 애드센스 등 광고 서비스 이용</h4>
                                <p>본 사이트는 광고 제공을 위해 쿠키를 사용할 수 있으며, 이를 통해 이용자의 방문 기록에 기반한 맞춤형 광고를 노출합니다. 사용자는 브라우저 설정에서 쿠키 거부를 선택할 수 있습니다.</p>

                                <p className="mt-8 border-t pt-4 font-bold text-gray-600">책임자: BowlingManager 운영팀 (sangdy85@gmail.com)</p>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
