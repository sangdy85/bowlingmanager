'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
    const [myRecordsPage, setMyRecordsPage] = useState(1);
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
                .sub-tabs-container {
                    display: flex;
                    gap: 0.5rem;
                    background: #1e293b;
                    padding: 0.375rem;
                    border-radius: 0.75rem;
                    width: fit-content;
                    border: 1px solid #334155;
                }
                .sub-tab-btn {
                    padding: 0.5rem 1.25rem;
                    border-radius: 0.5rem;
                    font-weight: 800;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                }
                .sub-tab-btn.active {
                    background: #3b82f6;
                    color: white;
                }
                .sub-tab-btn.inactive {
                    color: #94a3b8;
                }
                .sub-tab-btn.inactive:hover {
                    color: white;
                    background: #334155;
                }
            `}} />

            <header className="text-center mb-16">
                <h1 className="text-4xl md:text-6xl font-black mb-6 text-slate-900 tracking-tighter">
                    BowlingManager <span className="text-blue-600">이용 방법</span>
                </h1>
                <p className="text-xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed">
                    BowlingManager의 주요 서비스 메뉴와 상세 기능들을 알기 쉽게 설명해 드립니다.<br />
                    아래 탭을 클릭하여 각 기능의 활용 가이드를 확인하세요.
                </p>
            </header>

            {/* Premium Tabs */}
            <div className="flex justify-center mb-16 px-2">
                <div className="flex flex-row bg-slate-100 p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-4xl overflow-x-auto no-scrollbar">
                    {[
                        { id: 'intro', label: '서비스 소개', icon: '📝' },
                        { id: 'my-records', label: '나의 기록실', icon: '🎳' },
                        { id: 'team-mgmt', label: '팀 관리', icon: '🏆' },
                        { id: 'center-tournaments', label: '볼링장/대회', icon: '🏤' },
                        { id: 'inquiry', label: '1:1 문의', icon: '📞' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-5 py-4 rounded-xl font-black transition-all whitespace-nowrap ${activeTab === tab.id
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
                                { title: '데이터 보존성', desc: '과거에 치렀던 수많은 기록도 단 한 번의 검색으로 찾아낼 수 있는 강력한 데이터베이스 아카이빙을 갖추고 있습니다.' },
                                { title: '클럽과의 연결', desc: '볼링장, 동호회, 개인 유저를 유기적으로 연결하여 실제 오프라인 활동을 디지털 서비스로 폭넓게 지원합니다.' },
                                { title: '스마트 기술 혁신', desc: '최신 AI 점수판 모니터 OCR 문자 인식 기술을 접목하여 번거로운 점수 입력 절차를 자동화합니다.' }
                            ].map((item, idx) => (
                                <div key={idx} className="content-card p-12 group hover:scale-[1.02] transition-transform cursor-default">
                                    <h4 className="text-xl font-black text-white mb-5 group-hover:text-blue-400 transition-colors">{item.title}</h4>
                                    <p className="text-slate-400 text-base leading-relaxed font-medium">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'my-records' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-4 border-b border-slate-800">
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tight">🎳 나의 기록실</h2>
                                    <p className="text-slate-400 text-sm mt-1">개요 : 개인 기록과 통계를 확인합니다.</p>
                                </div>
                                <div className="sub-tabs-container">
                                    <button 
                                        type="button"
                                        onClick={() => setMyRecordsPage(1)} 
                                        className={`sub-tab-btn ${myRecordsPage === 1 ? 'active' : 'inactive'}`}
                                    >
                                        1페이지: 플레이어 프로필
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setMyRecordsPage(2)} 
                                        className={`sub-tab-btn ${myRecordsPage === 2 ? 'active' : 'inactive'}`}
                                    >
                                        2페이지: 개인기록 통계
                                    </button>
                                </div>
                            </div>

                            {myRecordsPage === 1 ? (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="p-6 bg-blue-950/20 border border-blue-900/40 rounded-2xl">
                                        <h3 className="text-xl font-black text-blue-400 mb-2">⭐ 1페이지: 플레이어 프로필</h3>
                                        <p className="text-slate-300 text-base leading-relaxed">
                                            클럽 또는 개인적으로 기록한 점수를 평균, 하이, 로우, 게임수, 편차를 보여주고 해당 데이터를 토대로 <strong>파란색 그래프</strong>로 보여줍니다.<br />
                                            볼링장, 대회에서 기록한 점수를 평균, 하이, 로우, 게임수, 편차를 보여주고 해당 데이터를 토대로 <strong>주황색 그래프</strong>로 보여줍니다.
                                        </p>
                                    </div>

                                    <div>
                                        <h4 className="text-lg font-black text-white mb-4 border-l-4 border-blue-500 pl-3">그래프 분석 5가지 항목별 구성</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                                                <h5 className="font-extrabold text-blue-300 mb-2">🎯 클럽, 볼링장 기량 (에버)</h5>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    클럽 활동 및 볼링장 공식 대회를 바탕으로 본 실력을 에버리지 수치로 나타냅니다.<br />
                                                    <strong>230점 에버리지가 만점</strong> 기준으로 세팅되며, 평균 점수가 낮을수록 오각형 그래프가 중심부 쪽으로 점차 작아집니다.
                                                </p>
                                            </div>

                                            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                                                <h5 className="font-extrabold text-blue-300 mb-2">🏃‍♂️ 클럽 성실 / 볼링장 성실</h5>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    <strong>클럽 성실</strong>: 동호회 내에서의 **정기전 참석율 100%**를 만점으로 계산하여 그래프가 점차 작아집니다.<br />
                                                    <strong>볼링장 성실</strong>: 해당 볼링장 공식 **대회 참여횟수가 10번 이상**일 경우 만점이며, 그 이하일 경우 점차 작아집니다.
                                                </p>
                                            </div>

                                            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                                                <h5 className="font-extrabold text-blue-300 mb-2">📈 포텐셜 (최고점)</h5>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    사용자가 기록할 수 있는 최고 기량 포텐셜을 계산합니다.<br />
                                                    정기전 또는 대회 중에 기록한 **하이 평균이 250점일 때 만점**으로 계산하여 점차 작아집니다.
                                                </p>
                                            </div>

                                            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                                                <h5 className="font-extrabold text-blue-300 mb-2">🛡️ 안정감</h5>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    최악의 경기에서도 점수를 유지해 주는 수비적 일관성을 측정합니다.<br />
                                                    정기전 또는 대회 중에 기록한 **로우 평균이 200점일 때 만점**으로 계산하여 점차 작아집니다.
                                                </p>
                                            </div>

                                            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl col-span-1 md:col-span-2">
                                                <h5 className="font-extrabold text-emerald-400 mb-2">⚡ 기복 (편차)</h5>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    매 게임 스코어 간의 흔들림을 표준 편차로 진단합니다.<br />
                                                    정기전 또는 대회 **게임 당 점수 편차가 20점 이하인 경우를 만점**으로 적용하여, 기복이 심해지고 편차가 20점을 초과할수록 점차 수치가 작아집니다.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="p-6 bg-orange-950/20 border border-orange-900/40 rounded-2xl">
                                        <h3 className="text-xl font-black text-orange-400 mb-2">📊 2페이지: 개인기록 통계 분석</h3>
                                        <p className="text-slate-300 text-base leading-relaxed">
                                            기록실에 쌓인 내 점수들의 상세 내역을 필터 및 구분 단위로 일목요연하게 파악하는 세션입니다.
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex gap-4 items-start bg-slate-900 p-5 rounded-xl border border-slate-800">
                                            <div className="text-2xl p-2 bg-blue-500/10 text-blue-400 rounded-lg">👑</div>
                                            <div>
                                                <h4 className="text-lg font-bold text-white mb-1">통합 종합 점수 통계</h4>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    <strong>정기전, 벙개, 볼링장 대회 총합</strong>으로 통합 에버리지 및 최고/최저 점수를 일목요연하게 보여줍니다.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 items-start bg-slate-900 p-5 rounded-xl border border-slate-800">
                                            <div className="text-2xl p-2 bg-orange-500/10 text-orange-400 rounded-lg">🏛️</div>
                                            <div>
                                                <h4 className="text-lg font-bold text-white mb-1">볼링장 공식 기록 & 최근 10경기 추이</h4>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    볼링장에서 주최하고 인증한 공식 기록 현황을 대조합니다. 가장 최신의 **볼링장 공식 최근 10경기 기록**도 리스트와 추이 그래프로 가져와서 투명하게 검증합니다.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 items-start bg-slate-900 p-5 rounded-xl border border-slate-800">
                                            <div className="text-2xl p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">📅</div>
                                            <div>
                                                <h4 className="text-lg font-bold text-white mb-1">정기전 최근 10경기 추이</h4>
                                                <p className="text-sm text-slate-400 leading-relaxed">
                                                    소속 클럽 정기전에서 직접 기록한 점수 추이를 확인합니다. 가장 최근에 치른 **정기전 최근 10경기 기록**도 함께 가져와서 변화 양상을 진단합니다.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'team-mgmt' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <h2 className="text-3xl font-black text-white mb-4 tracking-tight">🏆 팀 관리 기능 이용 가이드</h2>
                            <p className="text-slate-400 text-sm mb-8 pb-4 border-b border-slate-800">
                                소속된 볼링 동호회(클럽)를 디지털로 생성하거나 코드를 통해 간편하게 합류하고 운영할 수 있습니다.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                                    <span className="text-xs font-black text-blue-400 tracking-wider block mb-1 uppercase">CREATION & JOIN</span>
                                    <h3 className="text-xl font-bold text-white mb-3">팀 만들기 및 팀 가입하기</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        새로운 볼링 클럽을 창설하려면 <strong>팀 만들기</strong> 메뉴에서 팀 정보를 기재하여 생성하면 고유 팀 코드가 부여됩니다.
                                        기존 클럽에 동참하려면 <strong>팀 가입하기</strong> 메뉴에서 전달받은 팀 코드를 입력하면 즉시 클럽의 멤버로 등록됩니다.
                                    </p>
                                </div>

                                <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                                    <span className="text-xs font-black text-emerald-400 tracking-wider block mb-1 uppercase">SCORE METHODS</span>
                                    <h3 className="text-xl font-bold text-white mb-3">스마트한 3가지 점수 기록 방법</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        팀 점수 기재를 위해 <strong>점수 기록하기</strong>를 누르면 편리한 3대 수단을 제공합니다.
                                        개별 수동 입력은 물론이고, 양식에 맞춘 <strong>엑셀 일괄 업로드</strong>, 그리고 레인 모니터를 촬영한 <strong>점수판 사진(OCR) 자동 판독</strong>으로 아주 간편하게 일괄 기재가 완료됩니다.
                                    </p>
                                </div>
                            </div>

                            <div className="mb-8">
                                <h3 className="text-lg font-black text-white mb-4 border-l-4 border-blue-500 pl-3">팀 페이지에 들어가면 있는 세 가지 핵심 항목</h3>
                                <div className="space-y-4">
                                    <div className="p-5 bg-slate-950 border border-slate-900 rounded-xl flex gap-4">
                                        <div className="text-2xl">💬</div>
                                        <div>
                                            <h4 className="font-bold text-white text-base">게시판</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed mt-1">클럽 멤버들 간의 활발한 대화, 사진 공유, 공지사항 전달을 나누는 팀원 소통용 공간입니다.</p>
                                        </div>
                                    </div>
                                    <div className="p-5 bg-slate-950 border border-slate-900 rounded-xl flex gap-4">
                                        <div className="text-2xl">📝</div>
                                        <div>
                                            <h4 className="font-bold text-white text-base">팀 활동일지 (점수 기록)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed mt-1">팀원들이 기록한 모든 점수 로그가 적재되는 공간입니다. 수동/엑셀/사진으로 기재된 모든 점수는 <strong>날짜별 엑셀 다운로드</strong>가 가능하여 클럽 관리를 돕습니다.</p>
                                        </div>
                                    </div>
                                    <div className="p-5 bg-slate-950 border border-slate-900 rounded-xl flex gap-4">
                                        <div className="text-2xl">📊</div>
                                        <div>
                                            <h4 className="font-bold text-white text-base">팀원별 정보</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed mt-1">등록된 점수를 자동 계산하여 멤버 개개인의 <strong>출석율, 월별 에버, 종합 에버</strong>를 한눈에 순위와 함께 일목요연하게 정리해 줍니다.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'center-tournaments' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <h2 className="text-3xl font-black text-white mb-4 tracking-tight">🏤 볼링장/대회 기능 이용 가이드</h2>
                            <p className="text-slate-400 text-sm mb-8 pb-4 border-b border-slate-800">
                                오프라인 볼링장 센터에서 진행하는 공식 경기와 모집을 디지털화하여 최적의 대회를 운영합니다.
                            </p>

                            <div className="space-y-6">
                                <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex gap-4">
                                    <div className="text-3xl p-3 bg-blue-500/10 text-blue-400 rounded-xl h-fit">📢</div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-2">대회 참가자 모집 및 결과 확인</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed">
                                            볼링장에서 진행하는 대회에 참가자를 온라인으로 직접 모집하고 각 게임별 점수를 입력받아 순위와 랭킹 리더보드 결과를 실시간으로 파악할 수 있는 자동화 시스템입니다.
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-black text-white mb-4 border-l-4 border-blue-500 pl-3">지원하는 3대 볼링장 대회 형식</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="p-5 bg-slate-950 border border-slate-900 rounded-xl">
                                            <div className="text-xl mb-2">🎳</div>
                                            <h4 className="font-bold text-white text-base mb-1">상주리그</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">볼링장 센터에 소속된 상주 클럽들의 리그전으로 라운드별 매치 대진과 단체 스코어를 장기 누적하여 조율합니다.</p>
                                        </div>

                                        <div className="p-5 bg-slate-950 border border-slate-900 rounded-xl">
                                            <div className="text-xl mb-2">👑</div>
                                            <h4 className="font-bold text-white text-base mb-1">챔프전</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">볼링장 내 실력자들이 모여 토너먼트 형식으로 진정한 시즌 챔피언 최강 볼러를 가려내는 대회입니다.</p>
                                        </div>

                                        <div className="p-5 bg-slate-950 border border-slate-900 rounded-xl">
                                            <div className="text-xl mb-2">🎉</div>
                                            <h4 className="font-bold text-white text-base mb-1">이벤트전 (1회성 대회)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">다양한 축제 포맷이나 특정 시상 조건 등을 가미하여 누구나 간편하게 참여하고 즐기는 단발성 경기입니다.</p>
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
            <div className="mt-24 pt-8 border-t border-slate-200 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-medium text-slate-500">
                <Link href="/privacy" className="hover:text-blue-600 transition-colors underline underline-offset-4">개인정보처리방침</Link>
                <Link href="/terms" className="hover:text-blue-600 transition-colors underline underline-offset-4">이용약관</Link>
                <span>© {new Date().getFullYear()} BowlingManager. All rights reserved.</span>
            </div>
        </div>
    );
}
