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
                .mockup-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                }
                .mockup-table th {
                    background: #1e293b;
                    color: #94a3b8;
                    padding: 0.6rem 0.8rem;
                    text-align: center;
                    border-bottom: 1px solid #334155;
                    font-weight: 700;
                }
                .mockup-table td {
                    padding: 0.6rem 0.8rem;
                    text-align: center;
                    border-bottom: 1px solid #1e293b;
                    color: #e2e8f0;
                }
            `}} />

            {/* Main Header */}
            <header className="text-center mb-14">
                <span className="inline-block bg-blue-100 text-blue-800 font-bold px-4 py-1.5 rounded-full text-sm mb-4">
                    📘 BowlingManager 공식 서비스 마스터 가이드북
                </span>
                <h1 className="text-4xl md:text-5xl font-black mb-6 text-slate-900 tracking-tight">
                    BowlingManager <span className="text-blue-600">상세 이용 방법 & 종합 가이드</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed">
                    볼링 점수의 정밀 기록 아카이빙부터 동호회 점수 자동 집계, 볼링장 상주리그 및 대회 운영 시스템까지<br />
                    구체적인 이용 방법과 실시간 가이드를 항목별로 1,000자 이상의 상세한 설명으로 제공합니다.
                </p>
            </header>

            {/* Navigation Tabs */}
            <div className="flex justify-center mb-12 px-2">
                <div className="flex flex-row bg-slate-100 p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-5xl overflow-x-auto no-scrollbar">
                    {[
                        { id: 'intro', label: '1. 서비스 개요', icon: '📝' },
                        { id: 'quickstart', label: '2. 빠른 시작 4단계', icon: '🚀' },
                        { id: 'my-records', label: '3. 나의 기록실 분석', icon: '🎳' },
                        { id: 'team-mgmt', label: '4. 동호회 팀 관리', icon: '🏆' },
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
                
                {/* TAB 1: 서비스 개요 (1,000자 이상) */}
                {activeTab === 'intro' && (
                    <div className="space-y-12">
                        <div className="content-card shadow-2xl border-t-8 border-t-blue-500">
                            <h2 className="text-3xl font-black text-white mb-6">1. BowlingManager 서비스 개요 및 상세 개발 배경</h2>
                            <p className="text-slate-300 text-base leading-relaxed mb-6">
                                기존의 오프라인 볼링 문화에서는 매주 개최되는 동호회 정기전이나 상주리그 경기 후 점수판 종이 기록지를 수기로 작성하고, 이를 임원진이 수동으로 엑셀 시트에 일일이 입력하는 번거로운 과정이 필연적으로 수반되었습니다. 이 과정에서 계산 오류가 발생하거나 수기로 적은 가독성 낮은 글씨 때문에 점수가 잘못 기재되는 일이 빈번했으며, 수개월 이상 지난 과거의 점수 기록지가 수기 분실되어 개인의 성장을 객관적인 수치로 증명하기 어려운 한계가 존재했습니다.
                            </p>
                            <p className="text-slate-300 text-base leading-relaxed mb-6">
                                **BowlingManager**는 이러한 아날로그 방식의 문제점을 기술적으로 완벽하게 해결하기 위해 탄생한 **통합 볼링 데이터 관리 플랫폼**입니다. 서비스는 개인 볼러의 매 게임 점수를 영구적으로 클라우드 데이터베이스에 보존함과 동시에, 최신 **AI OCR (광학 문자 인식) 기술**을 접목하여 볼링장 레인 위 모니터 점수판을 스마트폰 카메라로 촬영하기만 하면 플레이어 이름과 프레임별 점수가 자동으로 집계되는 혁신적인 편의성을 제공합니다.
                            </p>
                            <p className="text-slate-300 text-base leading-relaxed mb-8">
                                또한 단순한 점수 저장에 그치지 않고, 수집된 데이터를 바탕으로 에버리지 추이 선 그래프, 하이 및 로우 방어력, 게임별 표준편차 기복 수치, 출석 성실도를 종합 연산하여 **5대 입체 오각형 스파이더 그래프**로 제공합니다. 이를 통해 볼러 개인은 자신의 약점(예: 수비력 부족, 경기 기복 심함)을 직관적으로 파악하고 정교한 연습 목표를 설정할 수 있습니다.
                            </p>

                            <div className="grid md:grid-cols-3 gap-6 pt-6 border-t border-slate-800">
                                <div className="feature-box">
                                    <h3 className="text-lg font-black text-blue-400 mb-2">👤 개인 볼러 (Individual Player)</h3>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        매 경기 스코어를 영구 아카이빙하고, 연도별/월별 에버리지 변화 추이, 하이 점수 포텐셜, 최저 로우 방어력, 표준편차 기복 지표를 다각도로 분석받아 실력 향상의 객관적 이정표로 활용합니다.
                                    </p>
                                </div>
                                <div className="feature-box">
                                    <h3 className="text-lg font-black text-emerald-400 mb-2">🏆 동호회 임원진 (Club Executive)</h3>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        정기전 점수 입력 수단(수동, 엑셀 파일 일괄 업로드, 점수판 OCR 사진 촬영)을 제공받아 매주 정기전 집계 시간을 90% 이상 단축하며, 회원별 출석률과 에버리지 순위표를 자동 생성합니다.
                                    </p>
                                </div>
                                <div className="feature-box">
                                    <h3 className="text-lg font-black text-amber-400 mb-2">🏤 볼링장 센터 (Center Administrator)</h3>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        볼링장에 상주하는 수십 개 동호회의 리그전 대진표 자동 매칭, 승점 집계, 챔프전 토너먼트 사다리 생성 및 성별/에버리지 기반 자동 핸디캡 연산이 적용된 모바일 리더보드를 운영합니다.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 권한 체계 및 데이터 무결성 보장 */}
                        <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                            <h3 className="text-2xl font-black text-slate-900">🔒 시스템 역할 권한 체계 및 보안 데이터 구조</h3>
                            <p className="text-slate-600 text-sm leading-relaxed mb-4">
                                BowlingManager는 무분별한 데이터 수정 및 조작을 방지하고 공정한 경기 운영 환경을 보장하기 위해 3단계의 엄격한 회원 권한 체계를 운용하고 있습니다.
                            </p>
                            <div className="grid md:grid-cols-3 gap-6 text-sm text-slate-600">
                                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-900 mb-2">1. 일반 회원 권한 (`USER`)</h4>
                                    <p className="text-xs leading-relaxed">
                                        기본 회원가입 시 부여되며, 자신의 개인 기록실 이용, 소속 동호회 팀 가입 및 팀 게시판 참여, 진행 중인 볼링장 대회 참가 신청 및 실시간 리더보드 조회가 가능합니다.
                                    </p>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-900 mb-2">2. 볼링장 관리자 (`CENTER_ADMIN`)</h4>
                                    <p className="text-xs leading-relaxed">
                                        볼링장 대표자 또는 전담 매니저에게 부여되는 권한으로, 상주 볼링장 프로필 등록, 상주리그 대진표 작성 및 승점 조율, 공식 챔프전 및 이벤트 대회 개최 권한을 갖습니다.
                                    </p>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                                    <h4 className="font-bold text-slate-900 mb-2">3. 시스템 관리자 (`SUPER_ADMIN`)</h4>
                                    <p className="text-xs leading-relaxed">
                                        전체 서비스의 모니터링, 볼링장 센터 관리자 승인, 1:1 고객 문의 게시판 답변 작성 및 시스템 전반의 무결성을 유지하는 최상위 운영 권한입니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: 빠른 시작 4단계 (1,000자 이상) */}
                {activeTab === 'quickstart' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm">
                            <h2 className="text-3xl font-black text-slate-900 mb-3">2. 초보자 및 신규 사용자를 위한 4단계 상세 이용 가이드</h2>
                            <p className="text-slate-600 text-base mb-8">
                                서비스 이용이 처음이신 분들을 위해 회원가입부터 첫 기록 저장, 동호회 가입 및 입체 분석 리포트 확인까지 각 단계별 상세 수행 절차를 단계별로 설명합니다.
                            </p>

                            <div className="space-y-8">
                                {[
                                    {
                                        step: 'STEP 1',
                                        title: '계정 생성, 소셜 로그인 및 사용자 프로필 초기 세팅',
                                        detail: '서비스 상단의 [회원가입] 메뉴를 클릭하여 자주 사용하는 이메일 주소와 암호를 등록하거나, 구글(Google) 및 네이버(Naver) 소셜 계정을 통해 3초 만에 간편하게 가입할 수 있습니다. 가입 완료 후 프로필 설정 화면에서 본인의 주 투구 손(오른손잡이 / 왼손잡이 / 양손 삼핑거 등)과 주로 방문하는 상주 볼링장을 지정해 두시면, 향후 볼링장별 맞춤 통계 데이터가 자동으로 분류되어 서비스됩니다.'
                                    },
                                    {
                                        step: 'STEP 2',
                                        title: '첫 볼링 점수 기록 (수동 핀 입력 또는 모니터 사진 OCR 인식)',
                                        detail: '로그인 후 [나의 기록실] 메뉴로 이동하여 [점수 추가] 버튼을 클릭합니다. 경기를 치른 날짜, 방문한 볼링장 이름, 그리고 경기 성격(소속 클럽 정기전, 번개 모임, 개인 연습 경기, 볼링장 공식 대회)을 선택합니다. 그 후 1게임을 포함한 각 게임별 점수를 키보드로 수동 입력하거나, 레인 모니터 화면 전체가 또렷하게 나오도록 스마트폰 카메라로 촬영한 점수판 사진을 업로드하면 AI 비전 엔진이 숫자를 인식하여 수초 내에 자동 세팅됩니다.'
                                    },
                                    {
                                        step: 'STEP 3',
                                        title: '동호회 팀 가입 신청 및 6자리 팀 코드 연동',
                                        detail: '이미 소속되어 활동 중인 볼링 동호회가 있는 경우, 클럽 회장님이나 임원진에게 부여된 6자리 알파벳/숫자 조합의 고유 팀 코드(Team Code)를 전달받습니다. [팀 관리] ➜ [팀 가입] 메뉴에서 해당 코드를 입력하면 즉시 해당 클럽의 멤버로 소속되어 팀 활동일지에 내 점수가 반영되고, 클럽 전용 게시판 및 팀원 출석률 랭킹표에 이름을 올리게 됩니다.'
                                    },
                                    {
                                        step: 'STEP 4',
                                        title: '5대 기량 오각형 분석 그래프 및 성적 성장 리포트 확인',
                                        detail: '최소 5게임 이상의 점수 기록이 축적되면 [나의 기록실] 메인 페이지에서 본인의 투구 성향이 반영된 5대 입체 오각형 스파이더 그래프가 생성됩니다. 내 에버리지 기량, 공식 하이 점수 포텐셜, 로우 수비력, 출석 성실도, 게임 간 기복 표준편차 수치를 실시간으로 점검하고, 통계 그래프 추이를 보며 부족한 파트를 보완하는 정교한 볼링 연습 계획을 수립할 수 있습니다.'
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

                {/* TAB 3: 나의 기록실 (1,000자 이상) */}
                {activeTab === 'my-records' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-800">
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tight">3. 나의 기록실 & 오각형 분석 알고리즘 상세 해설</h2>
                                    <p className="text-slate-400 text-sm mt-1">개인 스코어 아카이빙 및 5대 입체 기량 지표 산출 로직 완벽 가이드입니다.</p>
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
                                        2페이지: 통계 테이블 예시
                                    </button>
                                </div>
                            </div>

                            {/* Actual Radar Chart Guide Image */}
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 my-6 text-slate-100">
                                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center font-bold text-xl">🎳</div>
                                        <div>
                                            <span className="text-xs text-blue-400 font-bold uppercase tracking-wider block">PLAYER PROFILE</span>
                                            <h4 className="text-xl font-black text-white">홍길동 선수 <span className="text-xs text-slate-400 font-normal">(실제 레이아웃 샘플)</span></h4>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 text-right">
                                        <div className="px-3 py-1 bg-slate-900 rounded-lg border border-slate-800">
                                            <span className="text-[10px] text-slate-400 block">정기전 에버리지</span>
                                            <span className="text-lg font-black text-blue-400">216.3</span>
                                        </div>
                                        <div className="px-3 py-1 bg-slate-900 rounded-lg border border-slate-800">
                                            <span className="text-[10px] text-slate-400 block">공식대회 에버리지</span>
                                            <span className="text-lg font-black text-amber-400">210.3</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
                                    <div className="text-xs text-blue-400 mb-3 font-bold">오각형 기량 분석 그래프 예시 (실제 플레이어 프로필 레이아웃)</div>
                                    <div className="flex justify-center border border-blue-900/40 rounded-xl overflow-hidden bg-slate-950 p-4 max-w-xl mx-auto shadow-inner">
                                        <img 
                                            src="/images/profile-guide.png" 
                                            alt="플레이어 프로필 오각형 그래프 가이드 예시" 
                                            className="w-full h-auto rounded-lg max-w-xl"
                                            style={{ maxWidth: '100%', height: 'auto' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Explanation Text (1,000자 이상) */}
                            <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
                                <h3 className="text-xl font-black text-white border-l-4 border-blue-500 pl-3">📐 오각형 스파이더 그래프 5대 지표 개별 산출 공식 및 진단 원리</h3>
                                <p>
                                    BowlingManager의 프로필 분석 시스템은 단순히 평균 점수 하나만으로 선수의 실력을 평가하던 기존 방식에서 벗어나, 선수의 공격력, 수비력, 출석 성실도, 꾸준함(기복)을 5가지 축으로 다각도 연산하여 시각화합니다. 각 지표의 정밀 계산 공식은 아래와 같습니다.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="feature-box space-y-2">
                                        <h4 className="font-extrabold text-blue-300 text-base">1. 클럽 / 볼링장 기량 (에버리지 지표)</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            소속 동호회 정기전 및 공식 대회에서 기록한 경기 스코어의 총합을 총 게임수로 나눈 에버리지 수치입니다. **230점 에버리지가 100% 만점** 기준으로 적용되며, 에버리지가 낮아질수록 해당 오각형 상단 축의 길이가 중심부로 점차 축소됩니다.
                                        </p>
                                    </div>

                                    <div className="feature-box space-y-2">
                                        <h4 className="font-extrabold text-blue-300 text-base">2. 성실도 (클럽 정기전 & 대회 출석률)</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            **클럽 성실**: 소속 동호회의 연간 정기전 횟수 대비 개인 참가 횟수를 비율로 계산하여 100% 참사 시 만점 산출.<br />
                                            **볼링장 성실**: 상주 볼링장에서 주최하는 공식 대회에 10회 이상 참가 시 만점이 부여됩니다.
                                        </p>
                                    </div>

                                    <div className="feature-box space-y-2">
                                        <h4 className="font-extrabold text-blue-300 text-base">3. 포텐셜 (최고 하이 평균 지표)</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            공식 경기 중에 달성한 상위 하이(High) 스코어의 평균치를 계산하여 선수가 지닌 순간 폭발력을 진단합니다. **하이 평균 250점 달성 시 만점**으로 수치화됩니다.
                                        </p>
                                    </div>

                                    <div className="feature-box space-y-2">
                                        <h4 className="font-extrabold text-blue-300 text-base">4. 안정감 (최저 로우 방어 지표)</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            레인 오일 상태가 어렵거나 본인의 투구 실수가 발생했을 때 최저 스코어를 얼마나 잘 방어하는지 수비력을 측정합니다. **로우 평균 200점 이상 유지 시 만점**이 부여됩니다.
                                        </p>
                                    </div>

                                    <div className="feature-box col-span-1 md:col-span-2 space-y-2">
                                        <h4 className="font-extrabold text-emerald-400 text-base">5. 기복 (통계학적 표준 편차 지표)</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            매 게임 스코어 간의 흔들림 정도를 통계학의 표준 편차 공식인 <strong>σ = √[ Σ(경기점수 - 에버리지)² / N ]</strong> 로 산출합니다. 게임 당 **점수 편차가 20점 이하인 매우 일관되고 안정적인 투구**를 보이는 볼러일 때 만점 수치가 부여되며, 180점과 240점을 넘나드는 등 기복이 심할수록 이 수치는 낮아지게 됩니다.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: 동호회 팀 관리 (1,000자 이상) */}
                {activeTab === 'team-mgmt' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <div className="border-b border-slate-800 pb-4 mb-6">
                                <h2 className="text-3xl font-black text-white tracking-tight">4. 동호회 팀 관리 및 3대 점수 입력 방식 가이드</h2>
                                <p className="text-slate-400 text-sm mt-1">볼링 클럽 임원진의 번거로운 정기전 스코어 집계 및 출석부 관리를 자동화하는 시스템입니다.</p>
                            </div>

                            {/* UI MOCKUP 2: 팀 관리 */}
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 my-6 text-slate-100">
                                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                                    <div>
                                        <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider block">CLUB MANAGEMENT</span>
                                        <h4 className="text-xl font-black text-white">퍼펙트 볼링 클럽 <span className="text-xs text-slate-400 font-normal">(예시 서비스 화면)</span></h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-slate-900 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-800 font-mono">초대코드: BWL-777</span>
                                        <span className="text-xs bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg">점수 기록하기</span>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="mockup-table">
                                        <thead>
                                            <tr>
                                                <th>순위</th>
                                                <th>이름</th>
                                                <th>출석률</th>
                                                <th>참여게임</th>
                                                <th>총점</th>
                                                <th>평균 에버</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="bg-amber-500/10">
                                                <td className="font-bold text-amber-400">🥇 1위</td>
                                                <td className="font-bold text-white">김철수 (팀장)</td>
                                                <td className="text-emerald-400 font-bold">100% (14/14)</td>
                                                <td>56게임</td>
                                                <td>12,656</td>
                                                <td className="font-bold text-blue-400">226.0</td>
                                            </tr>
                                            <tr className="bg-slate-900">
                                                <td className="font-bold text-slate-300">🥈 2위</td>
                                                <td className="font-bold text-white">이영희</td>
                                                <td className="text-emerald-400 font-bold">100% (14/14)</td>
                                                <td>56게임</td>
                                                <td>12,000</td>
                                                <td className="font-bold text-blue-400">214.3</td>
                                            </tr>
                                            <tr className="bg-slate-900">
                                                <td className="font-bold text-slate-400">🥉 3위</td>
                                                <td className="font-bold text-white">박민수</td>
                                                <td className="text-slate-400">92.8% (13/14)</td>
                                                <td>52게임</td>
                                                <td>10,936</td>
                                                <td className="font-bold text-blue-400">210.3</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Detailed Description Text (1,000자 이상) */}
                            <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
                                <h3 className="text-xl font-black text-white border-l-4 border-blue-500 pl-3">🏆 동호회 임원진을 위한 스마트 점수 입력 3대 기술 및 팀 운영 메커니즘</h3>
                                <p>
                                    볼링 동호회 수십 명 회원의 정기전 스코어를 수기로 받아 입력하던 기존 방식의 스트레스를 줄이기 위해, BowlingManager는 상황에 맞는 3가지 편리한 점수 기록 수단을 지원합니다.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="feature-box space-y-2">
                                        <h4 className="font-bold text-white text-base">⌨️ 1. 수동 빠른 입력 모드</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            정기전에 참석한 회원 이름을 선택한 후 키보드로 1~4게임 점수를 빠르게 입력합니다. 실시간으로 총점과 게임별 에버리지가 자동 계산되어 입력 오류를 즉시 검증할 수 있습니다.
                                        </p>
                                    </div>
                                    <div className="feature-box space-y-2">
                                        <h4 className="font-bold text-white text-base">📊 2. 엑셀 일괄 업로드 모드</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            서비스에서 제공하는 표준 엑셀 템플릿 양식(.xlsx) 파일에 정기전 참석자 이름과 점수를 적은 후 파일 업로드 버튼을 누르면 수십 명의 점수가 단 1초 만에 시스템에 일괄 등록됩니다.
                                        </p>
                                    </div>
                                    <div className="feature-box space-y-2">
                                        <h4 className="font-bold text-white text-base">📸 3. 점수판 모니터 OCR 사진 인식</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            볼링장 레인 위 모니터 화면 전체가 보이도록 카메라 사진을 촬영해 업로드하면, 컴퓨터 비전 AI가 레인 번호, 선수 이름, 프레임 점수 숫자를 시각적으로 추출하여 자동 기재합니다.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                                    <h4 className="font-bold text-white text-base">📋 팀 활동일지 자동 보존 및 엑셀 다운로드 리포트</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        입력된 모든 정기전 기록은 날짜별 팀 활동일지로 자동 보존되며, 임원진은 클릭 한 번으로 모든 데이터를 엑셀 파일(.xlsx)로 내려받아 동호회 장부 및 결산 자료로 활용할 수 있습니다. 또한 회원들의 참가 횟수를 기반으로 한 **월별/연간 출석률 및 에버리지 순위 리더보드**가 실시간 갱신됩니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 5: 볼링장 / 대회 (1,000자 이상) */}
                {activeTab === 'center-tournaments' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <div className="border-b border-slate-800 pb-4 mb-6">
                                <h2 className="text-3xl font-black text-white tracking-tight">5. 볼링장 센터 상주리그 & 대회 시스템 상세 규정</h2>
                                <p className="text-slate-400 text-sm mt-1">볼링장에서 주최하는 상주 동호회 리그 및 공식 대회의 운영 규칙과 공식 해설입니다.</p>
                            </div>

                            {/* UI MOCKUP 3: 볼링장 & 대회 */}
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 my-6 text-slate-100">
                                <div className="border-b border-slate-800 pb-4">
                                    <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">CENTER & TOURNAMENT</span>
                                    <h4 className="text-2xl font-black text-white mt-1">장안 볼링 센터 <span className="text-xs text-slate-400 font-normal">(예시 센터 레이아웃)</span></h4>
                                    <p className="text-xs text-slate-400 mt-1">📍 서울 동대문구 장한로0길 00 · 📞 02-1234-5678</p>
                                </div>

                                <div className="p-4 bg-blue-950/40 border border-blue-800/40 rounded-lg flex flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded">이벤트전</span>
                                        <h6 className="text-base font-bold text-white mt-1">2026 상반기 챔프전 왕중왕전 (모집인원 54/54)</h6>
                                        <p className="text-xs text-slate-400 mt-0.5">📅 2026. 08. 30. 13:30 개최</p>
                                    </div>
                                    <button type="button" className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg">
                                        참가 신청
                                    </button>
                                </div>
                            </div>

                            {/* Detailed Description Text (1,000자 이상) */}
                            <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
                                <h3 className="text-xl font-black text-white border-l-4 border-blue-500 pl-3">🏤 볼링장 센터 주최 3대 경기 포맷 및 자동 승점/핸디캡 계산 규정</h3>
                                <p>
                                    볼링장 센터 관리자(`CENTER_ADMIN`)는 소속된 상주 클럽들의 장기 리그전과 단발성 챔프전 대회를 모바일 실시간 리더보드로 관제하고 운영할 수 있습니다.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="feature-box space-y-2">
                                        <h4 className="font-bold text-blue-400 text-base">🎳 1. 상주리그 (Resident League)</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            볼링장에 등록된 10~20개 동호회 팀 간 대진표가 주간 라운드별로 자동 매칭됩니다.<br />
                                            **승점 산출 룰**: 각 게임 승리 팀에 부여되는 Game 승점(2점)과 3게임 총점(Total Pin) 승리 팀에 부여되는 승점(4점)을 합산하여 라운드당 총 10점의 승점을 다투는 장기 시즌제 리그입니다.
                                        </p>
                                    </div>

                                    <div className="feature-box space-y-2">
                                        <h4 className="font-bold text-amber-400 text-base">👑 2. 챔프전 (Championship)</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            개인전 4게임 예선 합산 점수로 상위 8명 또는 16명을 자동 선발한 후, 1:1 토너먼트 사다리 결승 대진표를 자동 작성하여 실시간 스코어로 최종 챔피언을 가려내는 공식 경기입니다.
                                        </p>
                                    </div>

                                    <div className="feature-box space-y-2">
                                        <h4 className="font-bold text-emerald-400 text-base">🎉 3. 이벤트전 (스카치 & 베이커)</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            **쌍쌍 스카치 (Scotch Duo)**: 2인 1조가 되어 1구와 2구를 번갈아 투구하는 단합 경기.<br />
                                            **베이커 포맷 (Baker Format)**: 5인 1조 팀원이 1프레임씩 담당하여 10프레임을 완성하는 끈끈한 단체전 경기.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                                    <h4 className="font-bold text-white text-base">⚖️ 표준 자동 핸디캡(Handicap) 계산 공식</h4>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        남녀 선수 및 에버리지 격차를 보완하고 공정한 경쟁을 보장하기 위해, 대회 성적 집계 시 시스템에서 아래 공식으로 계산된 핸디캡 점수가 자동 가산됩니다.
                                    </p>
                                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-blue-400">
                                        개인 적용 핸디캡 = 여성 기본 보너스(+10~15핀) + [(200 - 개인 에버리지) × 80%]
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 6: FAQ 자주 묻는 질문 (1,000자 이상 / Master FAQ 10선) */}
                {activeTab === 'faq' && (
                    <div className="max-w-5xl mx-auto space-y-6">
                        <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm">
                            <h2 className="text-3xl font-black text-slate-900 mb-6">6. 자주 묻는 질문 Master FAQ (10선)</h2>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">
                                BowlingManager 서비스 이용과 관련하여 사용자분들께서 가장 자주 문의하시는 10가지 핵심 질의응답 모음입니다.
                            </p>
                            
                            <div className="space-y-4">
                                {[
                                    {
                                        q: '1. 비회원 방문자도 이용할 수 있는 기능에는 무엇이 있나요?',
                                        a: '비회원 방문자는 [볼링 가이드 센터]의 모든 지식 아티클, [서비스 이용 방법] 종합 안내서, 진행 중인 [볼링장 대회 정보 및 실시간 리더보드]를 로그인 없이 자유롭게 조회하실 수 있습니다.'
                                    },
                                    {
                                        q: '2. 모니터 점수판 사진(OCR) 인식이 잘 안 될 때는 어떻게 하나요?',
                                        a: '레인 전광판 조명이 너무 어둡거나 화면에 빛 반사가 심한 경우 숫자 인식이 지연될 수 있습니다. 정면 수평 위치에서 또렷하게 촬영해 주시거나, [수동 입력] 모드로 빠르게 수정하실 수 있습니다.'
                                    },
                                    {
                                        q: '3. 볼링장 센터 관리자(CENTER_ADMIN) 권한은 어떻게 신청하나요?',
                                        a: '볼링장을 운영하시는 대표님 또는 매니저분께서는 회원가입 후 [문의하기] 게시판을 통해 볼링장 이름 및 관리자 권한을 신청해 주시면 확인 후 승인해 드립니다.'
                                    },
                                    {
                                        q: '4. 개인 기록 데이터는 안전하게 보존되나요?',
                                        a: '네, 모든 점수 데이터는 클라우드 데이터베이스에 실시간으로 보존되며 백업 데이터(.xlsx 파일) 형태로 언제든지 안전하게 다운로드받으실 수 있습니다.'
                                    },
                                    {
                                        q: '5. 동호회 팀 코드는 어디서 확인하나요?',
                                        a: '팀을 창설한 임원진의 [팀 관리] 메인 화면 상단에서 6자리 고유 팀 코드를 확인하실 수 있습니다.'
                                    },
                                    {
                                        q: '6. 핸디캡 점수는 언제 자동으로 계산되나요?',
                                        a: '대회 생성 시 핸디캡 옵션을 활성화하면 점수 입력 즉시 성별 및 에버리지 공식에 따라 핸디 점수가 합산되어 실시간 리더보드에 반영됩니다.'
                                    },
                                    {
                                        q: '7. 엑셀 업로드용 표준 템플릿 양식은 어디서 받나요?',
                                        a: '[팀 관리] ➜ [점수 기록하기] ➜ [엑셀 업로드] 탭 선택 시 양식 샘플 파일(.xlsx)을 바로 다운로드받아 작성하실 수 있습니다.'
                                    },
                                    {
                                        q: '8. 개인 연습 경기와 클럽 정기전 점수는 분리하여 관리되나요?',
                                        a: '네, 점수 입력 시 경기 구분을 정기전, 벙개, 개인연습, 공식대회로 지정할 수 있어 각각의 분류별 에버리지가 따로 집계되어 관리됩니다.'
                                    },
                                    {
                                        q: '9. 비밀번호를 분실했을 때는 어떻게 재설정하나요?',
                                        a: '로그인 화면 하단의 [계정 찾기 / 비밀번호 재설정] 링크를 통해 가입하신 이메일로 비밀번호 재설정 인증 메일을 받아 안전하게 재설정하실 수 있습니다.'
                                    },
                                    {
                                        q: '10. 모바일 스마트폰 화면에서도 최적화되어 작동하나요?',
                                        a: 'BowlingManager는 완전 반응형 웹(Responsive Web) 디자인으로 제작되어 스마트폰, 태블릿, PC 등 모든 디바이스에서 최적화된 레이아웃으로 이용하실 수 있습니다.'
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
