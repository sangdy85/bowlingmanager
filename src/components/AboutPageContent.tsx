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
        <div className="max-w-7xl mx-auto px-4 py-16 relative overflow-hidden">
            {/* Custom Premium Styles & Animations */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-15px); }
                    100% { transform: translateY(0px); }
                }
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.2); }
                    50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.4); }
                }
                @keyframes move {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                .premium-card {
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .premium-card:hover {
                    transform: translateY(-8px) scale(1.01);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
                }
                .animate-float { animation: float 6s ease-in-out infinite; }
            `}} />

            {/* Mesh Background Decorations */}
            <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-blue-100 rounded-full blur-[120px] opacity-50 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 bg-indigo-100 rounded-full blur-[120px] opacity-50 pointer-events-none"></div>

            <header className="text-center relative z-10 mb-20">
                <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-black tracking-widest uppercase mb-6 border border-blue-100 shadow-sm animate-in fade-in duration-1000">
                    The Next Generation Bowling Suite
                </div>
                <h1 className="text-5xl md:text-7xl font-black mb-6 text-slate-950 tracking-tighter leading-none animate-in fade-in slide-in-from-top-6 duration-1000">
                    Bowling<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Manager</span>
                </h1>
                <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed animate-in fade-in duration-1000 delay-300">
                    데이터는 거짓말을 하지 않습니다. 당신의 모든 투구가 가치 있는 기록이 되는 곳,
                    <span className="text-slate-900 font-bold"> BowlingManager</span>에서 압도적인 성장을 경험하세요.
                </p>
            </header>

            {/* Ultra-Premium Tabs */}
            <div className="flex justify-center mb-16 relative z-10">
                <div className="bg-white/50 backdrop-blur-md p-2 rounded-[2rem] border border-slate-200 shadow-xl flex gap-1">
                    {[
                        { id: 'intro', label: '브랜드 철학', icon: '✨' },
                        { id: 'guide', label: 'AI 스마트 가이드', icon: '🧠' },
                        { id: 'inquiry', label: '프라이빗 문의', icon: '💎' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-8 py-3.5 rounded-[1.5rem] font-black transition-all duration-500 ${activeTab === tab.id
                                    ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/30 scale-105'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                        >
                            <span className="text-xl">{tab.icon}</span>
                            <span className="hidden md:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Dynamic Content Section */}
            <div className="relative z-10">
                {activeTab === 'intro' && (
                    <div className="space-y-24 animate-in fade-in slide-in-from-bottom-12 duration-1000">
                        {/* High-Concept Hero */}
                        <div className="premium-card rounded-[3rem] p-8 md:p-20 flex flex-col md:flex-row items-center gap-12 overflow-hidden relative shadow-2xl">
                            <div className="flex-1 space-y-8 relative z-10">
                                <h2 className="text-4xl md:text-5xl font-black text-slate-950 leading-tight">
                                    Bowling is Science. <br />
                                    <span className="text-blue-600">We Provide the Lab.</span>
                                </h2>
                                <div className="space-y-6 text-lg text-slate-600 font-medium leading-relaxed">
                                    <p>
                                        우리는 볼링을 단순한 '스포츠'를 넘어 데이터가 지배하는 '과학'으로 정의합니다.
                                        수동적인 기록 시스템에서 벗어나, 데이터가 당신에게 말을 거는 지능형 생태계를 구축했습니다.
                                    </p>
                                    <p className="p-6 bg-slate-50 rounded-3xl border-l-8 border-slate-900 italic">
                                        "어제보다 나은 오늘의 나를 만나는 유일한 방법은 검증된 데이터뿐입니다."
                                    </p>
                                </div>
                            </div>
                            <div className="flex-1 w-full max-w-md relative animate-float">
                                <div className="aspect-square bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[3rem] shadow-2xl flex items-center justify-center overflow-hidden relative group">
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                                    <div className="text-white text-9xl font-black tracking-tighter group-hover:scale-110 transition-transform duration-700">BM</div>
                                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-black/40 backdrop-blur-sm border-t border-white/10">
                                        <div className="text-blue-300 font-black text-sm mb-1 uppercase tracking-widest">Real-time Analytics</div>
                                        <div className="text-white font-bold">100% Data Integrity Guaranteed</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Core Pillars */}
                        <div className="grid md:grid-cols-2 gap-10">
                            <div className="premium-card p-12 rounded-[2.5rem] border-t-4 border-t-blue-600">
                                <div className="text-4xl mb-6">🛡️</div>
                                <h3 className="text-2xl font-black mb-6 text-slate-950">공정하고 투명한 생태계</h3>
                                <p className="text-slate-600 leading-relaxed font-semibold">
                                    BowlingManager는 기록의 신뢰성을 최우선으로 합니다.
                                    모든 대회 결과와 개인 통계는 조작이 불가능한 시스템 로직에 의해 관리되며,
                                    자체 검증 알고리즘을 통해 핸디캡 산정의 공정성을 확보합니다.
                                    모두가 믿고 즐길 수 있는 깨끗한 볼링 문화를 만듭니다.
                                </p>
                            </div>
                            <div className="premium-card p-12 rounded-[2.5rem] border-t-4 border-t-indigo-600">
                                <div className="text-4xl mb-6">🤝</div>
                                <h3 className="text-2xl font-black mb-6 text-slate-950">볼링장과 상생하는 네트워크</h3>
                                <p className="text-slate-600 leading-relaxed font-semibold">
                                    개인과 팀, 그리고 볼링장 센터를 유기적으로 연결합니다.
                                    센터는 효율적인 운영 시스템을 얻고, 유저는 검증된 전문 필드에서 활동할 수 있습니다.
                                    상주리그의 디지털 전환, BowlingManager가 앞장서겠습니다.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'guide' && (
                    <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 max-w-5xl mx-auto space-y-20">
                        {/* Section: AI Magic */}
                        <section className="relative">
                            <div className="text-center mb-16">
                                <span className="text-blue-600 font-black text-sm uppercase tracking-[0.3em]">AI Innovation</span>
                                <h2 className="text-4xl md:text-5xl font-black mt-4 text-slate-950">AI가 만드는 3초의 혁명</h2>
                            </div>

                            <div className="grid md:grid-cols-2 gap-16 items-center">
                                <div className="space-y-8">
                                    <div className="premium-card p-8 rounded-[2rem] border-l-8 border-l-blue-600 shadow-lg">
                                        <h4 className="text-xl font-black text-slate-950 mb-4">사진 한 장이면 충분합니다</h4>
                                        <p className="text-slate-600 font-medium leading-relaxed">
                                            매 게임 종료 후 점수판을 직접 타이핑하느라 흐름을 깨뜨리지 마세요.
                                            레인 모니터를 스마트폰으로 촬영하여 업로드하면, 우리 시스템의 AI가 3초 안에 모든 프레임 점수를 분석하여 자동으로 리포트합니다.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 text-center">
                                            <div className="text-blue-600 font-black text-2xl mb-1">99.8%</div>
                                            <div className="text-xs text-slate-500 font-bold">인식 정확도</div>
                                        </div>
                                        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center">
                                            <div className="text-indigo-600 font-black text-2xl mb-1">3s</div>
                                            <div className="text-xs text-slate-500 font-bold">처리 속도</div>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl">
                                        <h5 className="font-bold mb-3 flex items-center gap-2">
                                            <span className="text-yellow-400 font-black">💡</span> Expert Tip
                                        </h5>
                                        <p className="text-slate-400 text-sm leading-relaxed">
                                            모니터의 빛 반사를 최소화하고 수평을 맞춰 촬영하면 AI 인식이 더욱 빨라집니다.
                                            저장된 기록은 즉시 연도별/월별 통계에 반영됩니다.
                                        </p>
                                    </div>
                                </div>
                                <div className="relative group">
                                    <div className="absolute -inset-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[3rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                                    <div className="relative bg-white p-4 rounded-[3rem] shadow-2xl border border-slate-200">
                                        <div className="aspect-[4/3] bg-slate-100 rounded-[2.5rem] flex items-center justify-center text-slate-300 font-black text-4xl overflow-hidden relative">
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent"></div>
                                            <div className="relative z-10 text-white text-center">
                                                <div className="text-sm uppercase tracking-widest mb-2">Scanning Score...</div>
                                                <div className="w-48 h-1 bg-white/30 rounded-full overflow-hidden">
                                                    <div className="w-1/2 h-full bg-blue-500 animate-[move_2s_linear_infinite]"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section: Dynamic Growth */}
                        <section className="bg-slate-950 rounded-[4rem] p-10 md:p-20 text-white shadow-2xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
                            <div className="relative z-10 grid md:grid-cols-2 gap-20 items-center">
                                <div className="space-y-8">
                                    <h3 className="text-4xl md:text-5xl font-black leading-tight">
                                        Data is your <br />
                                        <span className="text-blue-400">Winning Road.</span>
                                    </h3>
                                    <p className="text-slate-400 text-lg leading-relaxed font-medium">
                                        단순히 평균 점수(Average)만 보고 계신가요? <br />
                                        BowlingManager의 통계 탭은 당신의 볼링을 입체적으로 분석합니다.
                                    </p>
                                    <ul className="space-y-6">
                                        {[
                                            { title: '스트라이크 확률 분석', desc: '연속 스트라이크(터키, 포베가 등) 가동력을 분석하여 폭발력을 측정합니다.' },
                                            { title: '스페어 성공률 추이', desc: '커버 실력을 데이터화하여 하이 에버리지 달성의 필수 요소를 확인합니다.' },
                                            { title: '연도별 성장 아카이브', desc: '1년 전의 나와 현재의 나를 원클릭으로 비교 대조합니다.' }
                                        ].map((item, idx) => (
                                            <li key={idx} className="flex gap-4">
                                                <div className="w-6 h-6 bg-blue-500 rounded-full flex-shrink-0 mt-1 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                                                <div>
                                                    <h5 className="font-black text-white">{item.title}</h5>
                                                    <p className="text-slate-500 text-sm">{item.desc}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    {[
                                        { label: 'Avg Trend', val: '+12' },
                                        { label: 'Spare %', val: '84%' },
                                        { label: 'Strike %', val: '46%' },
                                        { label: 'Games', val: '2.4k' }
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-white/5 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10 text-center hover:bg-white/10 transition-colors">
                                            <div className="text-blue-400 font-black text-3xl mb-2">{stat.val}</div>
                                            <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
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
