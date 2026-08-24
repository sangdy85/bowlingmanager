'use client';

import { useState } from 'react';
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
            <style dangerouslySetInnerHTML={{
                __html: `
                .content-card {
                    background: #0f172a !important;
                    border: 1px solid #1e293b !important;
                    border-radius: 1.25rem !important;
                    padding: 2.5rem !important;
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
                .feature-box {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 1rem;
                    padding: 1.5rem;
                }
            `}} />

            {/* Main Header */}
            <header className="text-center mb-14">
                <span className="inline-block bg-blue-100 text-blue-800 font-bold px-4 py-1.5 rounded-full text-sm mb-4">
                    📘 BowlingManager 공식 서비스 종합 가이드북
                </span>
                <h1 className="text-4xl md:text-5xl font-black mb-6 text-slate-900 tracking-tight">
                    BowlingManager <span className="text-blue-600">상세 이용 방법 & 기능 가이드</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed">
                    볼링 점수의 정밀 기록 아카이빙부터 동호회 엑셀/OCR 점수 자동 집계, 볼링장 공식 상주리그 및 대회 운영 시스템까지<br />
                    BowlingManager가 제공하는 모든 기능의 작동 원리와 구체적인 활용법을 안내해 드립니다.
                </p>
            </header>

            {/* Navigation Tabs */}
            <div className="flex justify-center mb-12 px-2">
                <div className="flex flex-row bg-slate-100 p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-5xl overflow-x-auto no-scrollbar">
                    {[
                        { id: 'intro', label: '1. 서비스 개요', icon: '📝' },
                        { id: 'quickstart', label: '2. 빠른 시작 4단계', icon: '🚀' },
                        { id: 'my-records', label: '3. 나의 기록실 분석', icon: '🎳' },
                        { id: 'team-mgmt', label: '4. 동호회 팀 운영', icon: '🏆' },
                        { id: 'center-tournaments', label: '5. 볼링장/대회 규칙', icon: '🏤' },
                        { id: 'faq', label: '6. 자주 묻는 질문', icon: '❓' },
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
                
                {/* TAB 1: 서비스 개요 */}
                {activeTab === 'intro' && (
                    <div className="space-y-12">
                        <div className="content-card shadow-2xl border-t-8 border-t-blue-500">
                            <h2 className="text-3xl font-black text-white mb-6">1. BowlingManager 개요 및 개발 배경</h2>
                            <p className="text-slate-300 text-lg leading-relaxed mb-6">
                                기존 오프라인 볼링 활동에서는 종이 점수판 기록 수기 작성, 엑셀 파일 수동 입력 및 분실 문제로 인해
                                개인의 장기적인 기량 변화를 객관적으로 파악하거나 동호회/대회를 공정하게 운영하기 어려웠습니다.
                            </p>
                            <p className="text-slate-300 text-base leading-relaxed mb-8">
                                **BowlingManager**는 이러한 문제를 완전히 해결하기 위해 **클라우드 데이터베이스 아카이빙, AI OCR 점수판 자동 인식, 입체 스파이더 그래프 분석 기술**을 통합하여 만든 정밀 볼링 데이터 관리 플랫폼입니다.
                            </p>

                            <div className="grid md:grid-cols-3 gap-6 pt-6 border-t border-slate-800">
                                <div className="feature-box">
                                    <h3 className="text-lg font-black text-blue-400 mb-2">👤 개인 볼러 (Individual)</h3>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        연도별/월별 에버리지 추이 파악, 하이/로우 방어력, 표준 편차(기복) 측정 및 레인 적응도 데이터 진단.
                                    </p>
                                </div>
                                <div className="feature-box">
                                    <h3 className="text-lg font-black text-emerald-400 mb-2">🏆 동호회 임원진 (Club Admin)</h3>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        정기전 점수 입력 자동화(수동/엑셀/OCR), 팀원 출석률 자동 집계, 엑셀 출력 및 팀원별 에버리지 랭킹 리더보드.
                                    </p>
                                </div>
                                <div className="feature-box">
                                    <h3 className="text-lg font-black text-amber-400 mb-2">🏤 볼링장 센터 (Center Admin)</h3>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        상주 동호회 리그 대진표 매칭, 챔프전 및 이벤트전 모바일 실시간 리더보드 중계, 자동 핸디캡 계산 시스템.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* System Roles & Security */}
                        <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                            <h3 className="text-2xl font-black text-slate-900">🔒 권한 체계 및 데이터 보안 구조</h3>
                            <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600">
                                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-900 mb-2">구분된 회원 권한 체계</h4>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li><strong>일반 회원 (`USER`)</strong>: 기록실 이용, 팀 가입 및 개별 스코어 확인</li>
                                        <li><strong>볼링장 센터 관리자 (`CENTER_ADMIN`)</strong>: 볼링장 정보 등록, 대회 개최 및 승점 조율</li>
                                        <li><strong>최고 관리자 (`SUPER_ADMIN`)</strong>: 전체 시스템 모니터링 및 문의 답변 처리</li>
                                    </ul>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-900 mb-2">클라우드 데이터 무결성 보장</h4>
                                    <p className="leading-relaxed">
                                        모든 경기 스코어 데이터는 관계형 데이터베이스(Prisma & SQLite/PostgreSQL)에 안전하게 암호화 보존되며, 데이터 손실 방지를 위한 자동 백업 이중화 시스템이 가동됩니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: 빠른 시작 4단계 */}
                {activeTab === 'quickstart' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm">
                            <h2 className="text-3xl font-black text-slate-900 mb-3">2. 초보자를 위한 4단계 빠른 시작가이드</h2>
                            <p className="text-slate-600 text-base mb-8">
                                회원가입부터 첫 기록 저장, 팀 활동 및 분석 리포트 확인까지 4단계 스텝으로 이용하실 수 있습니다.
                            </p>

                            <div className="space-y-6">
                                {[
                                    {
                                        step: 'STEP 1',
                                        title: '계정 생성 및 프로필 설정',
                                        detail: '메인 상단 [회원가입] 버튼을 눌러 이메일과 비밀번호를 등록합니다. 프로필 설정에서 투구 손(오른손/왼손), 주로 방문하는 상주 볼링장을 선택하면 맞춤형 통계가 세팅됩니다.'
                                    },
                                    {
                                        step: 'STEP 2',
                                        title: '첫 점수 기록하기 (수동 / 사진 촬영)',
                                        detail: '[나의 기록실] ➜ [점수 추가]를 클릭한 후 경기 날짜, 볼링장명, 게임 종류(정기전, 벙개, 연습)를 선택합니다. 점수를 수동으로 입력하거나 레인 모니터 사진을 촬영하여 간편하게 등록할 수 있습니다.'
                                    },
                                    {
                                        step: 'STEP 3',
                                        title: '동호회 팀 가입 및 코드 입력',
                                        detail: '소속 동호회가 있다면 임원진에게 전달받은 6자리 팀 코드를 [팀 가입]에 입력합니다. 즉시 팀원으로 연결되어 팀 활동일지 및 게시판에 참여하게 됩니다.'
                                    },
                                    {
                                        step: 'STEP 4',
                                        title: '입체 통계 리포트 파악하기',
                                        detail: '기록이 쌓이면 [나의 기록실]에서 에버리지 추이, 5대 기량 오각형 그래프, 오픈 프레임 수 및 게임별 편차 진단서를 바로 확인하실 수 있습니다.'
                                    }
                                ].map((s, idx) => (
                                    <div key={idx} className="flex gap-5 p-6 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="bg-blue-600 text-white font-black px-3.5 py-1.5 rounded-lg text-xs h-fit self-start">
                                            {s.step}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">{s.title}</h3>
                                            <p className="text-slate-600 text-sm leading-relaxed">{s.detail}</p>
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
                                    <h2 className="text-3xl font-black text-white tracking-tight">3. 나의 기록실 & 오각형 분석 알고리즘</h2>
                                    <p className="text-slate-400 text-sm mt-1">개인 스코어 아카이빙 및 5대 입체 기량 지표 산출 가이드입니다.</p>
                                </div>
                                <div className="sub-tabs-container">
                                    <button 
                                        type="button"
                                        onClick={() => setMyRecordsPage(1)} 
                                        className={`sub-tab-btn ${myRecordsPage === 1 ? 'active' : 'inactive'}`}
                                    >
                                        1페이지: 5대 기량 오각형 지표
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setMyRecordsPage(2)} 
                                        className={`sub-tab-btn ${myRecordsPage === 2 ? 'active' : 'inactive'}`}
                                    >
                                        2페이지: 최근 10경기 추이 분석
                                    </button>
                                </div>
                            </div>

                            {myRecordsPage === 1 ? (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="p-6 bg-blue-950/30 border border-blue-900/50 rounded-2xl">
                                        <h3 className="text-xl font-black text-blue-400 mb-3">📐 오각형 스파이더 그래프 5대 지표 개별 산출 로직</h3>
                                        <p className="text-slate-300 text-sm leading-relaxed mb-6">
                                            BowlingManager는 단순히 에버리지 점수 하나만 비교하지 않고, 수비력, 폭발력, 꾸준함(기복)을 입체적으로 수치화합니다.
                                        </p>
                                        <div className="flex justify-center border border-blue-900/40 rounded-xl overflow-hidden bg-slate-950/50 p-4 max-w-xl mx-auto shadow-inner mb-6">
                                            <img 
                                                src="/images/profile-guide.png" 
                                                alt="플레이어 프로필 오각형 그래프 가이드" 
                                                style={{ maxWidth: '100%', height: 'auto', borderRadius: '0.5rem' }} 
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="feature-box">
                                            <h4 className="font-extrabold text-blue-300 mb-2 text-base">1. 클럽 / 볼링장 기량 (에버리지 지표)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                동호회 정기전 및 공식 대회의 평균 점수(에버리지)를 산출합니다. **230점 에버리지가 만점(100%)**으로 세팅되며, 평균이 낮을수록 오각형 축이 중심부로 축소됩니다.
                                            </p>
                                        </div>

                                        <div className="feature-box">
                                            <h4 className="font-extrabold text-blue-300 mb-2 text-base">2. 성실도 (클럽 & 볼링장 출석률)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                **클럽 성실**: 소속 정기전 참석율 100% 시 만점 적용.<br />
                                                **볼링장 성실**: 주최 대회 10회 이상 참가 시 만점 적용.
                                            </p>
                                        </div>

                                        <div className="feature-box">
                                            <h4 className="font-extrabold text-blue-300 mb-2 text-base">3. 포텐셜 (최고 하이 평균 지표)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                경기 중 기록한 최고 하이 점수의 평균 능력을 진단합니다. **하이 평균 250점 달성 시 만점**으로 수치화됩니다.
                                            </p>
                                        </div>

                                        <div className="feature-box">
                                            <h4 className="font-extrabold text-blue-300 mb-2 text-base">4. 안정감 (최저 로우 방어 지표)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                레인 상태가 안 좋거나 미스가 났을 때 최저 점수를 보존하는 수비력 지표입니다. **로우 평균 200점 유지 시 만점** 적용.
                                            </p>
                                        </div>

                                        <div className="feature-box col-span-1 md:col-span-2">
                                            <h4 className="font-extrabold text-emerald-400 mb-2 text-base">5. 기복 (표준편차 지표)</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                매 경기 스코어 간의 편차를 통계학적 표준 편차 공식으로 산출합니다.<br />
                                                **게임 당 점수 편차가 20점 이하인 일관된 볼러**일 때 100% 만점 수치가 부여되며, 기복이 심할수록 그래프 축이 작아집니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                                        <h3 className="text-xl font-bold text-white mb-3">📊 통계 필터링 및 최근 10경기 트렌드 그래프</h3>
                                        <p className="text-slate-300 text-sm leading-relaxed mb-4">
                                            정기전, 벙개, 연습 경기, 공식 대회 기록을 기간별(연도/월별)로 구분하여 에버리지 변화 추이를 선 그래프로 진단할 수 있습니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 4: 동호회 팀 관리 */}
                {activeTab === 'team-mgmt' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <h2 className="text-3xl font-black text-white mb-4 tracking-tight">4. 동호회 팀 관리 및 3대 점수 입력 방식</h2>
                            <p className="text-slate-400 text-sm mb-8 pb-4 border-b border-slate-800">
                                동호회 임원진의 번거로운 정기전 집계 및 출석부 관리를 완전 자동화합니다.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="feature-box">
                                    <div className="text-2xl mb-2">⌨️</div>
                                    <h3 className="text-lg font-bold text-white mb-2">1. 수동 빠른 입력 모드</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        정기전 날짜와 참가자 목록을 선택한 후 키보드로 1~4게임 스코어를 빠르게 기재하는 기초 방식입니다.
                                    </p>
                                </div>
                                <div className="feature-box">
                                    <div className="text-2xl mb-2">📊</div>
                                    <h3 className="text-lg font-bold text-white mb-2">2. 엑셀 일괄 업로드 모드</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        제공되는 양식 엑셀 파일(.xlsx)에 수십 명의 점수를 입력하고 파일 업로드 버튼을 누르면 일괄 자동 파싱됩니다.
                                    </p>
                                </div>
                                <div className="feature-box">
                                    <div className="text-2xl mb-2">📸</div>
                                    <h3 className="text-lg font-bold text-white mb-2">3. 점수판 모니터 OCR 사진 인식</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        볼링장 레인 위 모니터 화면을 스마트폰 카메라로 촬영하여 업로드하면 AI가 점수 숫자를 읽어 자동 집계합니다.
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                                <h3 className="text-lg font-bold text-white border-l-4 border-blue-500 pl-3">클럽 팀 관리 3대 스마트 리포트</h3>
                                <div className="grid md:grid-cols-3 gap-4 text-xs text-slate-300">
                                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                                        <h4 className="font-bold text-blue-400 mb-1">팀 활동일지 & 엑셀 내보내기</h4>
                                        <p className="leading-relaxed">정기전 회차별 기록을 보존하고 원클릭 엑셀 다운로드를 지원합니다.</p>
                                    </div>
                                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                                        <h4 className="font-bold text-blue-400 mb-1">자동 출석률 및 에버 랭킹</h4>
                                        <p className="leading-relaxed">팀원들의 월별 정기전 출석 횟수와 에버리지 순위표가 자동으로 업데이트됩니다.</p>
                                    </div>
                                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                                        <h4 className="font-bold text-blue-400 mb-1">팀 내부 커뮤니티 게시판</h4>
                                        <p className="leading-relaxed">정기전 공지, 사진 공유, 참가 신청을 팀 전용 공간에서 다룹니다.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 5: 볼링장 / 대회 */}
                {activeTab === 'center-tournaments' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <h2 className="text-3xl font-black text-white mb-4 tracking-tight">5. 볼링장 상주리그 & 대회 시스템 규칙</h2>
                            <p className="text-slate-400 text-sm mb-8 pb-4 border-b border-slate-800">
                                볼링장 센터에서 주최하는 상주 동호회 리그 및 공식 대회의 규칙과 승점 공식입니다.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="feature-box">
                                    <h3 className="font-bold text-blue-400 text-base mb-2">🎳 1. 상주리그 (Resident League)</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        센터 소속 상주 클럽들의 주간 라운드 대진표 자동 매칭.<br />
                                        **승점 룰**: Game 승점(2점) + Total Pin 승점(4점) = 라운드당 총 10점 승점제.
                                    </p>
                                </div>
                                <div className="feature-box">
                                    <h3 className="font-bold text-amber-400 text-base mb-2">👑 2. 챔프전 (Championship)</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        예선전 4게임 핀수 합산 상위 8명/16명 자동 선발 ➜ 토너먼트 결승 사다리 1:1 대진표 자동 생성.
                                    </p>
                                </div>
                                <div className="feature-box">
                                    <h3 className="font-bold text-emerald-400 text-base mb-2">🎉 3. 이벤트전 (스카치/베이커)</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        **쌍쌍 스카치**: 2인 1조 1구/2구 교대 투구.<br />
                                        **베이커 포맷**: 5인 1조 1프레임씩 교대 투구.
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                                <h3 className="text-lg font-bold text-white border-l-4 border-blue-500 pl-3">⚖️ 표준 자동 핸디캡(Handicap) 계산 공식</h3>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    대회 참가자 간 성별 및 기량 격차를 보완하기 위해 시스템에서 아래 공식으로 핸디 점수를 자동 적용합니다.
                                </p>
                                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-blue-400">
                                    개인 핸디캡 = 여성 보너스(+10~15핀) + [(200 - 개인 에버리지) × 80%]
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 6: FAQ 자주 묻는 질문 */}
                {activeTab === 'faq' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm">
                            <h2 className="text-3xl font-black text-slate-900 mb-6">6. 자주 묻는 질문 (FAQ)</h2>
                            
                            <div className="space-y-4">
                                {[
                                    {
                                        q: '비회원도 이용할 수 있는 기능은 무엇이 있나요?',
                                        a: '비회원 방문자는 [볼링 가이드 센터]의 모든 지식 아티클, [서비스 이용 방법] 종합 안내서, 진행 중인 [볼링장 대회 정보 및 실시간 리더보드]를 로그인 없이 자유롭게 조회하실 수 있습니다.'
                                    },
                                    {
                                        q: '모니터 점수판 사진(OCR) 인식이 잘 안 될 때는 어떻게 하나요?',
                                        a: '레인 전광판 조명이 너무 어둡거나 화면에 빛 반사가 심한 경우 숫자 인식이 지연될 수 있습니다. 정면 수평 위치에서 또렷하게 촬영해 주시거나, [수동 입력] 모드로 빠르게 수정하실 수 있습니다.'
                                    },
                                    {
                                        q: '볼링장 센터 관리자(CENTER_ADMIN) 권한은 어떻게 신청하나요?',
                                        a: '볼링장을 운영하시는 대표님 또는 매니저분께서는 회원가입 후 [문의하기] 게시판을 통해 볼링장 이름 및 관리자 권한을 신청해 주시면 확인 후 승인해 드립니다.'
                                    },
                                    {
                                        q: '개인 기록 데이터는 안전하게 보존되나요?',
                                        a: '네, 모든 점수 데이터는 클라우드 데이터베이스에 실시간으로 보존되며 백업 데이터(.xlsx 파일) 형태로 언제든지 안전하게 다운로드받으실 수 있습니다.'
                                    },
                                    {
                                        q: '동호회 팀 코드는 어디서 확인하나요?',
                                        a: '팀을 창설한 임원진의 [팀 관리] 메인 화면 상단에서 6자리 고유 팀 코드를 확인하실 수 있습니다.'
                                    },
                                    {
                                        q: '핸디캡 점수는 언제 자동으로 계산되나요?',
                                        a: '대회 생성 시 핸디캡 옵션을 활성화하면 점수 입력 즉시 성별 및 에버리지 공식에 따라 핸디 점수가 합산되어 실시간 리더보드에 반영됩니다.'
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
                <h3 className="text-2xl font-black mb-3">볼링 점수 계산법이나 마이볼 선택 가이드가 필요하신가요?</h3>
                <p className="text-slate-300 text-sm max-w-xl mx-auto mb-6">
                    BowlingManager 가이드 센터에서 초보자 에티켓, 에버리지 20점 올리기 팁 등 유용한 지식 아티클을 만나보세요.
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
