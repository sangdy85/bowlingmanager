'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AboutPageContent({
    initialInquiries,
    isAdmin,
    isLoggedIn
}: {
    initialInquiries?: any[],
    isAdmin?: boolean,
    isLoggedIn?: boolean
}) {
    const [activeTab, setActiveTab] = useState<'intro' | 'quickstart' | 'my-records' | 'team-mgmt' | 'center-tournaments' | 'faq'>('intro');
    const [myRecordsPage, setMyRecordsPage] = useState<number>(1);
    const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);

    const toggleFaq = (index: number) => {
        setFaqOpenIndex(faqOpenIndex === index ? null : index);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-12">
            {/* Custom CSS for styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .content-card {
                    background: #0f172a !important;
                    border: 1px solid #1e293b !important;
                    border-radius: 1.25rem !important;
                    padding: 2.5rem !important;
                    height: 100% !important;
                    color: #f8fafc !important;
                }
                .guide-step-number {
                    width: 2.5rem;
                    height: 2.5rem;
                    background: #3b82f6;
                    color: white;
                    border-radius: 9999px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 900;
                    font-size: 1.125rem;
                    flex-shrink: 0;
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

            {/* Main Header */}
            <header className="text-center mb-14">
                <span className="inline-block bg-blue-100 text-blue-800 font-bold px-4 py-1.5 rounded-full text-sm mb-4">
                    📖 BowlingManager 공식 이용 안내서
                </span>
                <h1 className="text-4xl md:text-6xl font-black mb-6 text-slate-900 tracking-tighter">
                    BowlingManager <span className="text-blue-600">이용 방법 & 서비스 가이드</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed">
                    볼링 점수 기록 관리부터 동호회 팀 운영, 볼링장 상주리그 및 공식 대회 자동화까지<br />
                    BowlingManager가 제공하는 모든 기능과 스마트한 활용법을 구체적으로 소개합니다.
                </p>
            </header>

            {/* Premium Navigation Tabs */}
            <div className="flex justify-center mb-12 px-2">
                <div className="flex flex-row bg-slate-100 p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-4xl overflow-x-auto no-scrollbar">
                    {[
                        { id: 'intro', label: '서비스 소개', icon: '📝' },
                        { id: 'quickstart', label: '빠른 시작 4단계', icon: '🚀' },
                        { id: 'my-records', label: '나의 기록실', icon: '🎳' },
                        { id: 'team-mgmt', label: '팀 관리', icon: '🏆' },
                        { id: 'center-tournaments', label: '볼링장/대회', icon: '🏤' },
                        { id: 'faq', label: '자주 묻는 질문', icon: '❓' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-black transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                                }`}
                        >
                            <span className="text-lg leading-none">{tab.icon}</span>
                            <span className="text-xs md:text-sm">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Display Area */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* TAB 1: 서비스 소개 */}
                {activeTab === 'intro' && (
                    <div className="space-y-12">
                        <div className="content-card shadow-2xl border-t-8 border-t-blue-500">
                            <h2 className="text-3xl font-black text-white mb-6">BowlingManager란 어떤 서비스인가요?</h2>
                            <p className="text-slate-300 text-lg leading-relaxed mb-8">
                                BowlingManager는 볼링을 사랑하는 **개인 볼러, 동호회(클럽) 관리자, 오프라인 볼링장 센터 운영진**을 위한
                                **통합 볼링 데이터 플랫폼**입니다. 수기로 기록되던 번거로운 점수판 문화를 디지털화하여,
                                데이터 기반의 실력 향상과 공정한 대회 운영을 지원합니다.
                            </p>

                            <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-slate-800">
                                <div className="space-y-4">
                                    <h3 className="text-xl font-black text-blue-400">🎯 성장을 위한 정밀 데이터 아카이빙</h3>
                                    <p className="text-slate-400 text-base leading-relaxed">
                                        매 정기전, 벙개, 연습 경기 스코어를 손쉽게 축적하세요. 단순 에버리지를 넘어
                                        하이/로우, 경기별 편차, 클럽/볼링장별 기량 지표를 오각형 스파이더 그래프로 시각화해 줍니다.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-xl font-extrabold text-blue-400">⚖️ 투명하고 공정한 대회 및 동호회 운영</h3>
                                    <p className="text-slate-400 text-base leading-relaxed">
                                        성별 및 에버리지 구간별 자동 핸디캡 계산 로직, 점수판 사진(OCR) 자동 집계,
                                        실시간 모바일 리더보드를 통해 동호회와 볼링장 대회의 데이터 조작 없는 깨끗한 운영을 보장합니다.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3 Major Core Features */}
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 mb-6 text-center">BowlingManager의 3대 핵심 가치</h3>
                            <div className="grid md:grid-cols-3 gap-8">
                                {[
                                    {
                                        title: '1. 데이터 영구 보존성',
                                        icon: '🗄️',
                                        desc: '수년 전 치렀던 정기전 점수부터 공식 볼링장 대회 기록까지 단 한 번의 검색으로 조회 가능한 클라우드 아카이빙을 제공합니다.'
                                    },
                                    {
                                        title: '2. 3대 점수 입력 방식 (OCR 포함)',
                                        icon: '📸',
                                        desc: '수동 입력은 물론 양식 엑셀 일괄 업로드, 레인 점수판 모니터 카메라 촬영(OCR) 문자 인식을 통해 입력을 자동화합니다.'
                                    },
                                    {
                                        title: '3. 오프라인 경기 생태계 연결',
                                        icon: '🤝',
                                        desc: '볼링장 센터, 동호회 클럽, 유저 개인을 유기적으로 연결하여 오프라인 볼링 활동을 실시간 리더보드로 확장합니다.'
                                    }
                                ].map((item, idx) => (
                                    <div key={idx} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="text-4xl mb-4">{item.icon}</div>
                                        <h4 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h4>
                                        <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: 빠른 시작 4단계 */}
                {activeTab === 'quickstart' && (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm">
                            <h2 className="text-3xl font-black text-slate-900 mb-3">🚀 4단계 빠른 이용 시작 가이드</h2>
                            <p className="text-slate-600 text-base mb-8">
                                BowlingManager를 처음 이용하시는 분들을 위한 단계별 시작 방법입니다.
                            </p>

                            <div className="space-y-8">
                                {[
                                    {
                                        step: '1',
                                        title: '회원가입 및 프로필 설정',
                                        desc: '이메일과 비밀번호 입력만으로 간편하게 회원가입이 완료됩니다. 주로 투구하는 오른손/왼손 정보 및 주 상주 볼링장을 설정하세요.'
                                    },
                                    {
                                        step: '2',
                                        title: '첫 볼링 점수 입력하기',
                                        desc: '[나의 기록실] 또는 [점수 기록] 메뉴에서 경기 날짜, 볼링장 이름, 게임 스코어를 입력합니다. 모니터 점수판 사진을 찍으면 AI가 자동으로 점수를 추출합니다.'
                                    },
                                    {
                                        step: '3',
                                        title: '동호회 팀 가입 또는 창설하기',
                                        desc: '[팀 관리] 메뉴에서 소속 볼링 클럽이 있다면 팀 코드를 입력하여 가입하거나, 직접 새로운 클럽을 창설하여 팀원들을 초대할 수 있습니다.'
                                    },
                                    {
                                        step: '4',
                                        title: '리더보드 및 성장 데이터 분석',
                                        desc: '쌓인 기록을 바탕으로 산출된 에버리지 추이, 기복(표준편차), 클럽 내 랭킹 리더보드를 확인하며 실력 향상 전략을 세우세요.'
                                    }
                                ].map((s, idx) => (
                                    <div key={idx} className="flex gap-5 p-6 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="guide-step-number">{s.step}</div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-1">{s.title}</h3>
                                            <p className="text-slate-600 text-sm leading-relaxed">{s.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: 나의 기록실 */}
                {activeTab === 'my-records' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-4 border-b border-slate-800">
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tight">🎳 나의 기록실 상세 이용 가이드</h2>
                                    <p className="text-slate-400 text-sm mt-1">개인 점수 관리 및 입체적 기량 분석 시스템입니다.</p>
                                </div>
                                <div className="sub-tabs-container">
                                    <button 
                                        type="button"
                                        onClick={() => setMyRecordsPage(1)} 
                                        className={`sub-tab-btn ${myRecordsPage === 1 ? 'active' : 'inactive'}`}
                                    >
                                        1페이지: 플레이어 프로필 분석
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setMyRecordsPage(2)} 
                                        className={`sub-tab-btn ${myRecordsPage === 2 ? 'active' : 'inactive'}`}
                                    >
                                        2페이지: 개인기록 통계 & 추이
                                    </button>
                                </div>
                            </div>

                            {myRecordsPage === 1 ? (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="p-6 bg-blue-950/30 border border-blue-900/50 rounded-2xl">
                                        <h3 className="text-xl font-black text-blue-400 mb-3">⭐ 오각형 스파이더 그래프 5대 기량 지표</h3>
                                        <p className="text-slate-300 text-sm leading-relaxed mb-6">
                                            BowlingManager는 단순히 평균 점수만 보여주는 것을 넘어, 볼러의 투구 성향과 수비력(안정감), 기복을 5가지 입체 지표로 진단합니다.
                                        </p>
                                        <div className="flex justify-center border border-blue-900/40 rounded-xl overflow-hidden bg-slate-950/50 p-4 max-w-xl mx-auto shadow-inner">
                                            <img 
                                                src="/images/profile-guide.png" 
                                                alt="플레이어 프로필 오각형 그래프 가이드" 
                                                style={{ maxWidth: '100%', height: 'auto', borderRadius: '0.5rem' }} 
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                                            <h4 className="font-extrabold text-blue-300 mb-2">🎯 클럽 / 볼링장 기량 (에버리지)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                동호회 정기전 및 공식 대회의 평균 점수(에버리지)를 산출합니다.<br />
                                                <strong>230점 에버리지가 만점(100%)</strong> 기준으로 세팅되며, 에버리지가 낮을수록 그래프 축이 중심부로 이동합니다.
                                            </p>
                                        </div>

                                        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                                            <h4 className="font-extrabold text-blue-300 mb-2">🏃‍♂️ 성실도 (출석률 & 참여도)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                <strong>클럽 성실</strong>: 소속 클럽 정기전 참석율 100% 시 만점 산출.<br />
                                                <strong>볼링장 성실</strong>: 해당 볼링장 주최 대회 10회 이상 참여 시 만점 산출.
                                            </p>
                                        </div>

                                        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                                            <h4 className="font-extrabold text-blue-300 mb-2">📈 포텐셜 (공식 하이 점수)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                공식 경기에서 기록했던 최고 점수의 평균값을 진단합니다.<br />
                                                <strong>하이 평균 250점 달성 시 만점</strong>으로 계산됩니다.
                                            </p>
                                        </div>

                                        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
                                            <h4 className="font-extrabold text-blue-300 mb-2">🛡️ 안정감 (수비력 / 로우 점수)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                레인 상태가 안 좋거나 실수가 나왔을 때 최저 점수를 얼마나 방어하는지 측정합니다.<br />
                                                <strong>로우 평균 200점 유지 시 만점</strong> 적용.
                                            </p>
                                        </div>

                                        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl col-span-1 md:col-span-2">
                                            <h4 className="font-extrabold text-emerald-400 mb-2">⚡ 기복 (표준 편차)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                게임 간 점수 흔들림을 통계학적 표준 편차로 분석합니다.<br />
                                                게임 당 **점수 편차가 20점 이하인 안정된 볼러**일 때 만점 수치가 표시되며, 기복이 심해질수록 수치가 작아집니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                                        <h3 className="text-xl font-bold text-white mb-2">📊 통합 점수 통계 & 최근 10경기 추이 그래프</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">
                                            정기전, 벙개, 공식 대회 기록을 연도별/월별로 필터링하여 에버리지 변화 추이 선 그래프로 한눈에 비교 파악할 수 있습니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 4: 팀 관리 */}
                {activeTab === 'team-mgmt' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <h2 className="text-3xl font-black text-white mb-4 tracking-tight">🏆 동호회 / 팀 관리 시스템 활용법</h2>
                            <p className="text-slate-400 text-sm mb-8 pb-4 border-b border-slate-800">
                                임원진의 번거로운 정기전 스코어 집계 작업을 완전 자동화해 드립니다.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="text-2xl mb-2">⌨️</div>
                                    <h3 className="text-lg font-bold text-white mb-2">1. 수동 빠른 입력</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        날짜, 참가자 이름, 게임별 점수를 키보드로 간편하게 빠르게 기재하는 방식입니다.
                                    </p>
                                </div>
                                <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="text-2xl mb-2">📊</div>
                                    <h3 className="text-lg font-bold text-white mb-2">2. 엑셀 파일 일괄 업로드</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        제공되는 표준 엑셀 템플릿 양식에 수십 명의 점수를 채워 한 번에 업로드합니다.
                                    </p>
                                </div>
                                <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="text-2xl mb-2">📸</div>
                                    <h3 className="text-lg font-bold text-white mb-2">3. 점수판 사진 (OCR) 인식</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        볼링장 레인 모니터 카메라 촬영 이미지를 업로드하면 AI가 점수 숫자를 읽어 자동 입력합니다.
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                                <h3 className="text-lg font-bold text-white mb-4 border-l-4 border-blue-500 pl-3">클럽 관리자를 위한 팀 관리 3대 핵심 기능</h3>
                                <ul className="space-y-3 text-sm text-slate-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-400 font-bold">•</span>
                                        <span><strong>팀 활동일지 & 엑셀 다운로드</strong>: 정기전 날짜별 모든 스코어를 조회하고 엑셀 파일(.xlsx)로 내보낼 수 있습니다.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-400 font-bold">•</span>
                                        <span><strong>자동 출석률 및 순위 산출</strong>: 팀원의 정기전 참가 횟수와 에버리지 랭킹이 실시간 갱신됩니다.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-400 font-bold">•</span>
                                        <span><strong>팀 내부 커뮤니티 게시판</strong>: 공지사항 공유, 정기전 참가 신청, 사진 공유를 팀원 전용 공간에서 나눕니다.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 5: 볼링장 / 대회 */}
                {activeTab === 'center-tournaments' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <h2 className="text-3xl font-black text-white mb-4 tracking-tight">🏤 볼링장 센터 & 대회 운영 자동화</h2>
                            <p className="text-slate-400 text-sm mb-8 pb-4 border-b border-slate-800">
                                볼링장에서 주최하는 모든 상주리그와 대회를 모바일 실시간 리더보드로 운영합니다.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="p-5 bg-slate-950 border border-slate-900 rounded-xl">
                                    <h3 className="font-bold text-blue-400 text-base mb-2">🎳 1. 상주리그 (Resident League)</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        볼링장 상주 클럽 간 대진표 자동 매칭, 라운드별 승점(Game 승점 + Total Pin 승점) 집계 및 장기 순위표 관리.
                                    </p>
                                </div>
                                <div className="p-5 bg-slate-950 border border-slate-900 rounded-xl">
                                    <h3 className="font-bold text-amber-400 text-base mb-2">👑 2. 챔프전 (Championship)</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        예선전 스코어 합산 상위 8명/16명 자동 선발 ➜ 토너먼트 결승 사다리 대진표 자동 생성.
                                    </p>
                                </div>
                                <div className="p-5 bg-slate-950 border border-slate-900 rounded-xl">
                                    <h3 className="font-bold text-emerald-400 text-base mb-2">🎉 3. 이벤트전 (스카치/베이커)</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        쌍쌍 스카치(2인 1조 릴레이), 베이커 포맷(5인 1조 프레임 교대) 등 다채로운 이벤트 경기 집계 지원.
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
                                <h3 className="text-lg font-bold text-white mb-2">⚖️ 공정한 핸디캡(Handicap) 자동 연산 로직</h3>
                                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                                    대회 생성 시 성별 보너스 핀(여성 +10~15핀) 및 에버리지 기반 핸디캡 공식을 지정하면, 점수 입력 시 핸디 점수가 자동으로 더해져 실시간 리더보드에 적용됩니다.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 6: FAQ 자주 묻는 질문 */}
                {activeTab === 'faq' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm">
                            <h2 className="text-3xl font-black text-slate-900 mb-6">❓ 자주 묻는 질문 (FAQ)</h2>
                            
                            <div className="space-y-4">
                                {[
                                    {
                                        q: '비회원도 이용할 수 있는 기능은 무엇이 있나요?',
                                        a: '비회원 방문자는 [볼링 가이드 센터]의 모든 지식 아티클, [서비스 이용 방법] 안내서, 공개 진행 중인 [볼링장 대회 정보 및 실시간 리더보드]를 로그인 없이 자유롭게 조회하실 수 있습니다.'
                                    },
                                    {
                                        q: '모니터 점수판 사진(OCR) 인식이 잘 안 될 때는 어떻게 하나요?',
                                        a: '조명이 너무 어둡거나 화면 반사가 심한 경우 숫자 인식이 지연될 수 있습니다. 빛 반사를 줄여 점수판 숫자가 또렷하게 나오도록 수평으로 촬영해 주시거나, [수동 입력] 모드를 이용해 빠르게 수정 입력하실 수 있습니다.'
                                    },
                                    {
                                        q: '볼링장 관리자(CENTER_ADMIN) 권한은 어떻게 신청하나요?',
                                        a: '볼링장을 운영하시는 대표님 또는 매니저분께서는 회원가입 후 [문의하기] 게시판을 통해 사업자 정보 또는 볼링장 등록을 신청해 주시면 관리자 검토 후 대회 및 센터 관리 권한을 부여해 드립니다.'
                                    },
                                    {
                                        q: '개인 기록 데이터는 안전하게 보관되나요?',
                                        a: '네, 모든 점수 데이터는 클라우드 데이터베이스에 실시간으로 이중 백업되며 백업 데이터(.json / .xlsx) 형태로 언제든지 안전하게 다운로드받으실 수 있습니다.'
                                    },
                                    {
                                        q: '동호회 팀 코드는 어디서 확인하나요?',
                                        a: '팀을 생성한 클럽 회장님 또는 관리자분의 [팀 관리] 메인 화면 상단에서 고유 팀 코드(알파벳/숫자 조합)를 확인하실 수 있습니다.'
                                    }
                                ].map((item, idx) => (
                                    <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => toggleFaq(idx)}
                                            className="w-full p-5 text-left bg-slate-50 hover:bg-slate-100 flex items-center justify-between font-bold text-slate-900 transition-colors"
                                        >
                                            <span>Q. {item.q}</span>
                                            <span className="text-blue-600 font-extrabold text-lg">
                                                {faqOpenIndex === idx ? '−' : '+'}
                                            </span>
                                        </button>
                                        {faqOpenIndex === idx && (
                                            <div className="p-5 bg-white border-t border-slate-200 text-sm text-slate-600 leading-relaxed">
                                                {item.a}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Bottom Knowledge Banner Link */}
            <div className="mt-16 bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-2xl p-8 text-center shadow-xl">
                <h3 className="text-2xl font-black mb-3">볼링 점수 계산법이나 마이볼 지공 가이드가 궁금하신가요?</h3>
                <p className="text-slate-300 text-sm max-w-xl mx-auto mb-6">
                    BowlingManager 가이드 센터에서 초보자 필수 에티켓, 에버리지 20점 올리기 팁 등 풍부한 지식 아티클을 만나보세요.
                </p>
                <Link
                    href="/guide"
                    className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg no-underline"
                >
                  볼링 가이드 센터 바로가기 &rarr;
                </Link>
            </div>

            {/* Footer Bar */}
            <div className="mt-16 pt-8 border-t border-slate-200 flex flex-wrap justify-center items-center gap-x-6 gap-y-3 text-sm font-medium text-slate-500">
                <Link href="/privacy" className="hover:text-blue-600 transition-colors underline underline-offset-4">개인정보처리방침</Link>
                <span className="text-slate-300">|</span>
                <Link href="/terms" className="hover:text-blue-600 transition-colors underline underline-offset-4">이용약관</Link>
                <span className="text-slate-300">|</span>
                <Link href="/guide" className="hover:text-blue-600 transition-colors underline underline-offset-4">가이드 센터</Link>
                <span className="text-slate-300">|</span>
                <span>© {new Date().getFullYear()} BowlingManager. All rights reserved.</span>
            </div>
        </div>
    );
}
