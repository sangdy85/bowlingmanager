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
        <div className="max-w-7xl mx-auto px-4 py-12">
            <header className="text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-1000">
                <h1 className="text-4xl md:text-5xl font-black mb-4 text-slate-900 tracking-tight">BowlingManager</h1>
                <p className="text-lg text-slate-500 font-medium">점수 그 이상의 가치, 데이터로 완성되는 볼링 라이프</p>
            </header>

            {/* Tabs - Modern Pill Style */}
            <div className="flex justify-center mb-12">
                <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
                    {[
                        { id: 'intro', label: '서비스 소개', icon: '✨' },
                        { id: 'guide', label: '사용 가이드', icon: '📖' },
                        { id: 'inquiry', label: '문의 게시판', icon: '💬' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all duration-300 ${activeTab === tab.id
                                    ? 'bg-white text-blue-600 shadow-md transform scale-105'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            <span className="text-lg">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Container */}
            <div className="min-h-[600px] transition-all duration-500">
                {activeTab === 'intro' && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {/* Hero Section */}
                        <div className="relative mb-16 rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white p-8 md:p-20 shadow-2xl border border-white/10">
                            <div className="relative z-10 max-w-3xl">
                                <span className="inline-block px-4 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold tracking-widest uppercase mb-6 border border-blue-500/30">Premium Bowling Platform</span>
                                <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight">평범한 볼링을<br /><span className="text-blue-400">특별한 기록</span>으로 바꾸는 힘</h2>
                                <p className="text-lg text-slate-300 leading-relaxed mb-10 font-medium">
                                    BowlingManager는 단순한 스코어 보드가 아닙니다. 수만 건의 데이터를 분석하여 당신의 실력을 가시화하고,
                                    볼링장과 동호회를 하나로 연결하는 국내 유일의 통합 매니지먼트 솔루션입니다.
                                </p>
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex items-center gap-2 bg-white/10 px-5 py-3 rounded-2xl backdrop-blur-sm border border-white/10">
                                        <span className="text-2xl font-black text-blue-400">10k+</span>
                                        <span className="text-sm text-slate-300">누적 게임</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/10 px-5 py-3 rounded-2xl backdrop-blur-sm border border-white/10">
                                        <span className="text-2xl font-black text-blue-400">200+</span>
                                        <span className="text-sm text-slate-300">활동 클럽</span>
                                    </div>
                                </div>
                            </div>
                            {/* Decorative Elements */}
                            <div className="absolute -top-12 -right-12 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
                            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] pointer-events-none"></div>
                        </div>

                        {/* Core Features Grid */}
                        <div className="grid md:grid-cols-3 gap-8 mb-16">
                            {[
                                {
                                    title: '정밀 데이터 분석',
                                    desc: '연도별, 월별 에버리지 추이는 물론 최고/최저 점수 기록을 시각화하여 성장을 증명합니다.',
                                    icon: '📈',
                                    color: 'bg-blue-50 text-blue-600'
                                },
                                {
                                    title: '스마트 OCR 입력',
                                    desc: '사진 한 장이면 충분합니다. 최첨단 AI 기술로 점수판 숫자를 자동으로 텍스트로 전환합니다.',
                                    icon: '📷',
                                    color: 'bg-indigo-50 text-indigo-600'
                                },
                                {
                                    title: '팀 & 리그 자동화',
                                    desc: '동호회 관리자라면 필수! 가입 신청, 팀내 랭킹, 대회 대진표를 시스템이 대신 처리합니다.',
                                    icon: '🛡️',
                                    color: 'bg-slate-50 text-slate-900'
                                }
                            ].map((f, i) => (
                                <div key={i} className="group bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
                                    <div className={`w-14 h-14 ${f.color} rounded-2xl flex items-center justify-center text-3xl mb-8 group-hover:scale-110 transition-transform`}>
                                        {f.icon}
                                    </div>
                                    <h3 className="text-xl font-black mb-4 text-slate-900">{f.title}</h3>
                                    <p className="text-slate-500 leading-relaxed font-normal">{f.desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Bottom CTA Card */}
                        <div className="bg-slate-900 rounded-[2.5rem] p-10 md:p-16 text-center text-white border border-white/10 overflow-hidden relative shadow-2xl">
                            <div className="relative z-10">
                                <h3 className="text-2xl md:text-3xl font-black mb-6">당신의 모든 게임이 이력이 됩니다.</h3>
                                <p className="text-slate-400 mb-10 max-w-2xl mx-auto font-medium">지금 BowlingManager와 함께 더 똑똑한 볼링을 즐기세요.</p>
                                <button
                                    onClick={() => setActiveTab('guide')}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-bold shadow-lg shadow-blue-900/40 transition-all hover:scale-105"
                                >
                                    시작 가이드 보기
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'guide' && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-4xl mx-auto">
                        <header className="text-center mb-16">
                            <h2 className="text-3xl font-black mb-4 text-slate-900">사용 가이드</h2>
                            <p className="text-slate-500 font-medium">초보부터 관리자까지, 모두를 위한 기능 안내</p>
                        </header>

                        <div className="space-y-16">
                            {/* Step 1: Registration */}
                            <section className="relative pl-12 md:pl-20 border-l border-slate-200 py-4">
                                <div className="absolute top-0 -left-6 md:-left-8 w-12 h-12 md:w-16 md:h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg border-4 border-white">01</div>
                                <h3 className="text-2xl font-black mb-4 text-slate-900">회원 등록 및 프로필 설정</h3>
                                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 leading-relaxed font-medium">
                                    <p className="text-slate-600">소셜 계정으로 3초 만에 가입하세요. 가입 후 아래 정보를 설정하면 더욱 편리합니다.</p>
                                    <ul className="grid md:grid-cols-2 gap-4 text-sm">
                                        <li className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl text-slate-700 border border-slate-200">
                                            <span className="text-blue-600 font-bold">✓</span> 실명 및 활동 팀명 등록
                                        </li>
                                        <li className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl text-slate-700 border border-slate-200">
                                            <span className="text-blue-600 font-bold">✓</span> 기본 핸디캡(Handicap) 설정
                                        </li>
                                    </ul>
                                </div>
                            </section>

                            {/* Step 2: Score Entry - Detailed */}
                            <section className="relative pl-12 md:pl-20 border-l border-slate-200 py-4">
                                <div className="absolute top-0 -left-6 md:-left-8 w-12 h-12 md:w-16 md:h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg border-4 border-white">02</div>
                                <h3 className="text-2xl font-black mb-4 text-slate-900">기록 입력 방식 (3가지)</h3>
                                <div className="grid gap-6">
                                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm group hover:border-blue-400 transition-all">
                                        <div className="flex items-center gap-4 mb-4">
                                            <span className="text-3xl">🤖</span>
                                            <h4 className="text-xl font-bold text-slate-900">AI 사진 인식 (OCR)</h4>
                                        </div>
                                        <p className="text-slate-500 text-sm leading-relaxed mb-4 font-medium">
                                            점수판(모니터) 사진을 촬영하여 업로드하면 AI가 각 게임 점수를 자동으로 읽어옵니다.
                                            수기 입력의 번거로움 없이 즉시 기록을 아카이빙할 수 있습니다.
                                        </p>
                                        <div className="p-3 bg-blue-50 rounded-xl text-blue-700 text-xs font-bold inline-block">추천 방식 ⭐</div>
                                    </div>

                                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm group hover:border-slate-400 transition-all">
                                        <div className="flex items-center gap-4 mb-4">
                                            <span className="text-3xl">💻</span>
                                            <h4 className="text-xl font-bold text-slate-900">직접 입력 & 엑셀 업로드</h4>
                                        </div>
                                        <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                            게임을 마친 후 즉시 숫자로 입력하거나, 과거 데이터를 정리해둔 엑셀 파일을 일괄 등록할 수 있습니다.
                                            수천 게임의 과거 데이터도 한 번에 관리하세요.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* Step 3: Analysis */}
                            <section className="relative pl-12 md:pl-20 border-l border-slate-200 py-4">
                                <div className="absolute top-0 -left-6 md:-left-8 w-12 h-12 md:w-16 md:h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg border-4 border-white">03</div>
                                <h3 className="text-2xl font-black mb-4 text-slate-900">연도별 성장 리포트</h3>
                                <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-[2rem] border border-indigo-100 shadow-sm">
                                    <p className="text-slate-700 leading-relaxed font-medium mb-6">
                                        '통계' 탭에서 나의 데이터를 연도별로 분류하여 분석하세요.
                                        단순한 에버리지를 넘어 최고 점수의 변화, 연도별 꾸준함 등을 그래프로 확인할 수 있습니다.
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {['연간 에버리지', '월별 추이', '최고/최저점', '활동량'].map((t, i) => (
                                            <div key={i} className="bg-white p-3 rounded-xl border border-indigo-200 text-center text-xs font-bold text-indigo-700">{t}</div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* Step 4: Community & Tournament */}
                            <section className="relative pl-12 md:pl-20 border-l border-slate-200 py-4">
                                <div className="absolute top-0 -left-6 md:-left-8 w-12 h-12 md:w-16 md:h-16 bg-orange-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg border-4 border-white">04</div>
                                <h3 className="text-2xl font-black mb-4 text-slate-900">팀 활동 및 대회 참여</h3>
                                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                                    <div className="flex gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                        <div className="text-2xl">🏛️</div>
                                        <div>
                                            <h5 className="font-bold text-slate-900 mb-1">볼링장 & 팀 가입</h5>
                                            <p className="text-sm text-slate-500 font-medium leading-relaxed">자주 가시는 볼링장을 가입하면 해당 센터에서 개최하는 대회 공지를 가장 빠르게 받아볼 수 있습니다.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 p-5 bg-orange-50/50 rounded-2xl border border-orange-200">
                                        <div className="text-2xl">🎳</div>
                                        <div>
                                            <h5 className="font-bold text-orange-900 mb-1">실시간 대회 스코어링</h5>
                                            <p className="text-sm text-orange-700 font-medium leading-relaxed">대회 중에는 실시간 리더보드가 제공됩니다. 자신의 순위와 남은 게임 현황을 라이브로 확인하세요.</p>
                                        </div>
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
            </div>
        </div>
    );
}
