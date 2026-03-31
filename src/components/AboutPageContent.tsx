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

    // Sort and filter inquiries - Defensive check for null items
    const validInquiries = Array.isArray(inquiries) ? inquiries.filter(i => i !== null) : [];
    const sortedInquiries = [...validInquiries].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });

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
        <div className="max-w-7xl mx-auto px-4 py-16">
            <style dangerouslySetInnerHTML={{
                __html: `
                .content-card {
                    background: #0f172a !important;
                    border: 1px solid #1e293b !important;
                    border-radius: 1.25rem !important;
                    padding: 3rem !important;
                    height: 100% !important;
                    color: #f8fafc !important;
                }
                .guide-step {
                    display: flex;
                    gap: 1.5rem;
                    padding-bottom: 2.5rem;
                    border-left: 2px solid #334155;
                    margin-left: 1rem;
                    padding-left: 2rem;
                    position: relative;
                }
                .guide-step::before {
                    content: '';
                    position: absolute;
                    left: -6px;
                    top: 0;
                    width: 10px;
                    height: 10px;
                    background: #3b82f6;
                    border-radius: 50%;
                }
                .guide-step:last-child {
                    border-left: none;
                }
                .detail-box {
                    background: #1e293b !important;
                    border: 1px solid #334155 !important;
                    border-radius: 0.85rem !important;
                    padding: 1.5rem !important;
                    margin-top: 1.25rem !important;
                }
                .text-card-body {
                    color: #cbd5e1 !important;
                    font-weight: 500 !important;
                }
                .text-card-title {
                    color: #ffffff !important;
                    font-weight: 900 !important;
                }
            `}} />

            <header className="text-center mb-16">
                <h1 className="text-4xl md:text-6xl font-black mb-6 text-slate-900 tracking-tighter">
                    BowlingManager <span className="text-blue-600">Guide</span>
                </h1>
                <p className="text-xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed">
                    단순한 기록을 넘어, 당신의 볼링 실력을 데이터로 증명하고 성장시키는
                    전문 매니지먼트 플랫폼 BowlingManager의 모든 것을 소개합니다.
                </p>
            </header>

            {/* Premium Tabs */}
            <div className="flex justify-center mb-16 px-2">
                <div className="flex flex-row bg-slate-100 p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-2xl overflow-x-auto no-scrollbar">
                    {[
                        { id: 'intro', label: '서비스 소개', icon: '📝' },
                        { id: 'guide', label: '상세 사용법', icon: '💡' },
                        { id: 'inquiry', label: '1:1 문의', icon: '📞' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-white text-blue-600 shadow-lg ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                                }`}
                        >
                            <span className="text-xl leading-none">{tab.icon}</span>
                            <span className="text-sm md:text-base">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Section */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {activeTab === 'intro' && (
                    <div className="space-y-12">
                        <div className="content-card shadow-2xl border-t-8 border-t-blue-500">
                            <h2 className="text-3xl font-black text-white mb-8">BowlingManager의 철학</h2>
                            <div className="grid md:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <h3 className="text-xl font-extrabold text-blue-400">성장을 위한 정밀한 기록</h3>
                                    <p className="text-card-body text-lg leading-relaxed">
                                        우리는 '감'이 아닌 '데이터'로 볼링을 칠 때 가장 확실한 실력 변화가 일어난다고 믿습니다.
                                        개인의 모든 게임 기록을 영구적으로 아카이브하고, 이를 입체적인 통계로 변환하여
                                        자신의 약점을 객관적으로 파악할 수 있는 환경을 제공합니다.
                                    </p>
                                </div>
                                <div className="space-y-6">
                                    <h3 className="text-xl font-extrabold text-blue-400">투명하고 공정한 운영</h3>
                                    <p className="text-card-body text-lg leading-relaxed">
                                        BowlingManager는 대회와 리그 운영의 공정성을 심혈을 기울여 관리합니다.
                                        데이터 무결성을 위해 조작 불가능한 시스템 로직을 적용하고 있으며,
                                        누구에게나 공정한 핸디캡 산출 방식을 통해 깨끗한 경쟁 문화를 지향합니다.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            {[
                                { title: '데이터 보존성', desc: '과거 10년 전의 기록도 단 한 번의 클릭으로 찾아낼 수 있는 강력한 인덱싱 시스템을 갖추고 있습니다.' },
                                { title: '커뮤니티 연결', desc: '볼링장, 동호회, 개인 유저를 유기적으로 연결하여 실제 오프라인 활동을 디지털로 지원합니다.' },
                                { title: '기술 혁신', desc: '최신 AI 기술을 볼링에 접목하여 번거로운 수작업을 자동화하고 사용자 편의를 혁신합니다.' }
                            ].map((item, idx) => (
                                <div key={idx} className="content-card p-12 group hover:scale-[1.02] transition-transform cursor-default">
                                    <h4 className="text-xl font-black text-white mb-5 group-hover:text-blue-400 transition-colors">{item.title}</h4>
                                    <p className="text-slate-400 text-base leading-relaxed font-medium">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'guide' && (
                    <div className="max-w-5xl mx-auto space-y-10">
                        <div className="content-card shadow-2xl">
                            <h2 className="text-3xl font-black text-white mb-16 text-center tracking-tight">BowlingManager 마스터 클래스</h2>

                            {/* Step 1: AI Analysis Details */}
                            <div className="guide-step">
                                <div className="flex-1">
                                    <h3 className="text-2xl font-black text-white mb-4">01. AI를 활용한 점수 분석 및 입력</h3>
                                    <p className="text-card-body text-lg leading-relaxed mb-6">
                                        BowlingManager의 가장 강력한 기능 중 하나는 AI 사진 인식(OCR)입니다.
                                        레인 모니터의 복잡한 숫자들을 사람의 개입 없이 정확하게 읽어내어 저장합니다.
                                    </p>
                                    <div className="detail-box space-y-6">
                                        <h4 className="font-black text-blue-400 text-sm uppercase tracking-[0.2em]">상세 프로세스:</h4>
                                        <ul className="space-y-4 text-base text-slate-300">
                                            <li className="flex gap-3">
                                                <span className="text-blue-500 font-black">✔</span>
                                                <span><strong className="text-white">이미지 전처리</strong>: 업로드된 사진의 밝기, 대비를 자동으로 조절하여 숫자 가독성을 높입니다.</span>
                                            </li>
                                            <li className="flex gap-3">
                                                <span className="text-blue-500 font-black">✔</span>
                                                <span><strong className="text-white">격자(Grid) 탐지</strong>: 점수판 특유의 표 구조를 인식하여 각 프레임의 위치를 파악합니다.</span>
                                            </li>
                                            <li className="flex gap-3">
                                                <span className="text-blue-500 font-black">✔</span>
                                                <span><strong className="text-white">숫자 판독</strong>: AI가 모든 투구를 읽고 최종 점수와 합산 결과가 맞는지 교차 검증합니다.</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Statistics Details */}
                            <div className="guide-step">
                                <div className="flex-1">
                                    <h3 className="text-2xl font-black text-white mb-4">02. 성장 가속화를 위한 데이터 분석법</h3>
                                    <p className="text-card-body text-lg leading-relaxed mb-8">
                                        단순한 에버리지는 빙산의 일각입니다. 통계 메뉴에 있는 세부 지표를 통해 자신의 볼링 스타일을 더 깊게 이해하세요.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                        <div className="p-8 bg-slate-800/50 border border-slate-700/50 rounded-2xl hover:bg-slate-800 transition-colors">
                                            <div className="text-2xl mb-4">📈</div>
                                            <div className="font-black text-white text-lg mb-2">스트라이크 확률</div>
                                            <p className="text-sm text-slate-400 leading-relaxed">연속 스트라이크(터키 등) 확률과 더블 가동률을 확인하여 폭발력을 측정하고 집중력 부재 구간을 찾아냅니다.</p>
                                        </div>
                                        <div className="p-8 bg-slate-800/50 border border-slate-700/50 rounded-2xl hover:bg-slate-800 transition-colors">
                                            <div className="text-2xl mb-4">🛡️</div>
                                            <div className="font-black text-white text-lg mb-2">스페어 처리율</div>
                                            <p className="text-sm text-slate-400 leading-relaxed">커버 성공률을 기반으로 핀 남김 현상을 분석하여 스페어 기술의 완성도를 수치화합니다.</p>
                                        </div>
                                        <div className="p-8 bg-slate-800/50 border border-slate-700/50 rounded-2xl hover:bg-slate-800 transition-colors">
                                            <div className="text-2xl mb-4">📅</div>
                                            <div className="font-black text-white text-lg mb-2">연간 실력 추이</div>
                                            <p className="text-sm text-slate-400 leading-relaxed">계절별, 연도별 에버리지 변화를 그래프로 보며 어떤 시기에 성장이 정체되었는지 원인을 분석할 수 있습니다.</p>
                                        </div>
                                        <div className="p-8 bg-slate-800/50 border border-slate-700/50 rounded-2xl hover:bg-slate-800 transition-colors">
                                            <div className="text-2xl mb-4">📊</div>
                                            <div className="font-black text-white text-lg mb-2">오픈 프레임 분석</div>
                                            <p className="text-sm text-slate-400 leading-relaxed">미스가 발생하는 패턴을 파악하여 실전에서 가장 먼저 보완해야 할 점을 제시해 드립니다.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Social & Tournament */}
                            <div className="guide-step">
                                <div className="flex-1">
                                    <h3 className="text-2xl font-black text-white mb-4">03. 대회 및 커뮤니티 정복하기</h3>
                                    <p className="text-card-body text-lg leading-relaxed mb-10">
                                        개인의 성장을 넘어, 팀의 명예와 대회의 즐거움을 함께 누리는 방법입니다.
                                    </p>
                                    <div className="flex flex-col md:flex-row gap-8">
                                        <div className="flex-1 p-8 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-3xl group cursor-default">
                                            <div className="flex items-center gap-4 mb-4">
                                                <span className="text-3xl">🏆</span>
                                                <h5 className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">실시간 리더보드</h5>
                                            </div>
                                            <p className="text-sm text-slate-400 leading-relaxed">
                                                대회 참가 중인가요? 레인에서 실시간으로 업데이트되는 전체 순위를 확인하세요.
                                                남은 게임 수와 필요한 점수를 계산하며 전략적인 볼링이 가능해집니다.
                                            </p>
                                        </div>
                                        <div className="flex-1 p-8 bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-900/30 rounded-3xl group cursor-default">
                                            <div className="flex items-center gap-4 mb-4">
                                                <span className="text-3xl">🏤</span>
                                                <h5 className="text-xl font-black text-white group-hover:text-blue-300 transition-colors">센터 및 팀 활동</h5>
                                            </div>
                                            <p className="text-sm text-blue-100/70 leading-relaxed">
                                                단골 볼링장을 가입하고 팀에 소속되세요.
                                                동호회 내에서의 나의 랭킹을 확인하고, 팀원들과 기록을 공유하며 함께 성장할 수 있습니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                                                    {inq.author?.name || '익명'} · {inq.createdAt ? new Date(inq.createdAt).toISOString().split('T')[0] : '-'}
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
