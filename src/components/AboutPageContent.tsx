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
                    📘 BowlingManager 공식 서비스 종합 가이드북
                </span>
                <h1 className="text-4xl md:text-5xl font-black mb-6 text-slate-900 tracking-tight">
                    BowlingManager <span className="text-blue-600">상세 이용 방법 & 화면 예시</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed">
                    볼링 점수의 정밀 기록 아카이빙부터 동호회 점수 자동 집계, 볼링장 상주리그 및 대회 운영 시스템까지<br />
                    실제 서비스 화면 예시와 함께 각 기능의 구체적인 활용법을 안내해 드립니다.
                </p>
            </header>

            {/* Navigation Tabs */}
            <div className="flex justify-center mb-12 px-2">
                <div className="flex flex-row bg-slate-100 p-2 rounded-2xl border border-slate-200 shadow-sm w-full max-w-5xl overflow-x-auto no-scrollbar">
                    {[
                        { id: 'intro', label: '1. 서비스 개요', icon: '📝' },
                        { id: 'quickstart', label: '2. 빠른 시작 4단계', icon: '🚀' },
                        { id: 'my-records', label: '3. 나의 기록실 (화면 예시)', icon: '🎳' },
                        { id: 'team-mgmt', label: '4. 동호회 팀 관리 (화면 예시)', icon: '🏆' },
                        { id: 'center-tournaments', label: '5. 볼링장/대회 (화면 예시)', icon: '🏤' },
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
                                기존 오프라인 볼링 활동에서는 종이 점수판 수기 작성, 엑셀 파일 수동 입력 및 분실 문제로 인해
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

                {/* TAB 3: 나의 기록실 (화면 예시) */}
                {activeTab === 'my-records' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-800">
                                <div>
                                    <h2 className="text-3xl font-black text-white tracking-tight">3. 나의 기록실 & 예시 화면 가이드</h2>
                                    <p className="text-slate-400 text-sm mt-1">개인 스코어 아카이빙 및 오각형 기량 그래프 실제 서비스 레이아웃입니다.</p>
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

                            {/* EXAMPLE SCREEN UI MOCKUP 1: 나의 기록실 */}
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 my-6 text-slate-100">
                                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center font-bold text-xl">🎳</div>
                                        <div>
                                            <span className="text-xs text-blue-400 font-bold uppercase tracking-wider block">PLAYER PROFILE</span>
                                            <h4 className="text-xl font-black text-white">홍길동 선수 <span className="text-xs text-slate-400 font-normal">(예시 데이터)</span></h4>
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

                                <div className="grid md:grid-cols-2 gap-6 items-center">
                                    {/* Real Profile Radar Chart Guide Image */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center col-span-1 md:col-span-2">
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

                                    {/* Stats Table Sample */}
                                    <div className="space-y-3">
                                        <h5 className="text-sm font-bold text-white">2026년 개인 통계 STATISTICS 샘플</h5>
                                        <div className="overflow-x-auto">
                                            <table className="mockup-table">
                                                <thead>
                                                    <tr>
                                                        <th>구분</th>
                                                        <th>게임수</th>
                                                        <th>총점</th>
                                                        <th>하이</th>
                                                        <th>평균</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="text-left font-bold text-blue-400">정기전(공식)</td>
                                                        <td>61</td>
                                                        <td>12,829</td>
                                                        <td>279</td>
                                                        <td className="font-bold text-blue-300">210.3</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-left font-bold text-amber-400">볼링장 대회</td>
                                                        <td>8</td>
                                                        <td>1,503</td>
                                                        <td>233</td>
                                                        <td className="font-bold text-amber-300">187.9</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="text-left font-bold text-emerald-400">개인 연습</td>
                                                        <td>52</td>
                                                        <td>11,390</td>
                                                        <td>279</td>
                                                        <td className="font-bold text-emerald-300">219.0</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Explanatory Boxes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div className="feature-box">
                                    <h4 className="font-extrabold text-blue-300 mb-2 text-base">1. 5대 기량 지표 진단 알고리즘</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        에버리지(230점 만점), 출석 성실도(100%), 하이 포텐셜(250점), 최저 방어 수비력(200점), 표준편차 기복(20점 이하)을 오각형 그래프로 입체 진단합니다.
                                    </p>
                                </div>
                                <div className="feature-box">
                                    <h4 className="font-extrabold text-emerald-400 mb-2 text-base">2. 일별/대회별 스코어 자동 분류</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        공식 상주리그, 챔프전, 개인 연습 스코어가 연도별 카테고리로 자동 정리되어 언제든지 엑셀 파일로 출력할 수 있습니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: 동호회 팀 관리 (화면 예시) */}
                {activeTab === 'team-mgmt' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <div className="border-b border-slate-800 pb-4 mb-6">
                                <h2 className="text-3xl font-black text-white tracking-tight">4. 동호회 팀 관리 예시 화면 가이드</h2>
                                <p className="text-slate-400 text-sm mt-1">클럽 팀원 출석률, 월별 에버리지 순위표 및 정기전 활동일지 실제 서비스 레이아웃입니다.</p>
                            </div>

                            {/* EXAMPLE SCREEN UI MOCKUP 2: 팀 관리 */}
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

                                {/* Team Member Leaderboard Mockup Table */}
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h5 className="text-sm font-bold text-white">2026년 팀원별 출석률 & 에버리지 랭킹 예시</h5>
                                        <span className="text-xs text-slate-400">총 20명 등록</span>
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

                                {/* Team Activity Log Table Sample */}
                                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="flex justify-between items-center mb-3">
                                        <h5 className="text-xs font-bold text-blue-400">📅 팀 활동일지 (2026-08-15 정기전 스코어 예시)</h5>
                                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">엑셀 다운로드</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="mockup-table">
                                            <thead>
                                                <tr>
                                                    <th>순위</th>
                                                    <th>성명</th>
                                                    <th>1G</th>
                                                    <th>2G</th>
                                                    <th>3G</th>
                                                    <th>4G</th>
                                                    <th>총점</th>
                                                    <th>평균</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>1</td>
                                                    <td className="font-bold text-white">김철수</td>
                                                    <td className="text-blue-400 font-bold">245</td>
                                                    <td className="text-blue-400 font-bold">235</td>
                                                    <td className="text-blue-400 font-bold">212</td>
                                                    <td className="text-blue-400 font-bold">227</td>
                                                    <td className="font-bold">919</td>
                                                    <td className="font-bold text-blue-300">229.75</td>
                                                </tr>
                                                <tr>
                                                    <td>2</td>
                                                    <td className="font-bold text-white">이영희</td>
                                                    <td>212</td>
                                                    <td className="text-blue-400 font-bold">237</td>
                                                    <td>203</td>
                                                    <td className="text-blue-400 font-bold">266</td>
                                                    <td className="font-bold">918</td>
                                                    <td className="font-bold text-blue-300">229.50</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* 3 Methods Overview */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="feature-box">
                                    <h4 className="font-bold text-white text-sm mb-1">⌨️ 수동 입력</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">참가자명과 1~4게임 스코어를 빠르게 키보드로 입력.</p>
                                </div>
                                <div className="feature-box">
                                    <h4 className="font-bold text-white text-sm mb-1">📊 엑셀 파일 업로드</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">양식 엑셀 파일(.xlsx)을 업로드하여 수십 명 점수를 일괄 자동 집계.</p>
                                </div>
                                <div className="feature-box">
                                    <h4 className="font-bold text-white text-sm mb-1">📸 점수판 OCR 인식</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">볼링장 모니터 화면 사진을 촬영하여 AI가 자동으로 스코어 추출.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 5: 볼링장 / 대회 (화면 예시) */}
                {activeTab === 'center-tournaments' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        <div className="content-card shadow-2xl">
                            <div className="border-b border-slate-800 pb-4 mb-6">
                                <h2 className="text-3xl font-black text-white tracking-tight">5. 볼링장 센터 & 대회 예시 화면 가이드</h2>
                                <p className="text-slate-400 text-sm mt-1">볼링장 프로필, 모집 중인 대회 및 진행 중인 상주리그 실제 서비스 레이아웃입니다.</p>
                            </div>

                            {/* EXAMPLE SCREEN UI MOCKUP 3: 볼링장 & 대회 */}
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 my-6 text-slate-100">
                                <div className="border-b border-slate-800 pb-4">
                                    <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">CENTER & TOURNAMENT</span>
                                    <h4 className="text-2xl font-black text-white mt-1">장안 볼링 센터 <span className="text-xs text-slate-400 font-normal">(예시 센터)</span></h4>
                                    <p className="text-xs text-slate-400 mt-1">📍 서울 동대문구 장한로0길 00 · 📞 02-1234-5678</p>
                                </div>

                                {/* 모집 중인 대회 Box */}
                                <div className="p-5 bg-slate-900 border border-blue-900/50 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">🔥</span>
                                        <h5 className="text-sm font-bold text-white">모집 중인 대회</h5>
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

                                {/* 진행 중 대회 탭 & 카테고리 */}
                                <div className="space-y-4">
                                    <div className="flex gap-2 border-b border-slate-800 pb-3">
                                        <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg">진행 중</span>
                                        <span className="bg-slate-900 text-slate-400 text-xs font-bold px-4 py-1.5 rounded-lg border border-slate-800">종료 됨</span>
                                    </div>

                                    <div className="flex gap-2">
                                        <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">상주리그</span>
                                        <span className="bg-slate-900 text-slate-400 text-xs font-bold px-3 py-1 rounded-full border border-slate-800">챔프전</span>
                                        <span className="bg-slate-900 text-slate-400 text-xs font-bold px-3 py-1 rounded-full border border-slate-800">이벤트전</span>
                                    </div>

                                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl border-l-4 border-l-purple-500">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] bg-purple-900/60 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded font-bold">상주리그</span>
                                            <span className="text-xs text-slate-400">📅 2026. 07. 20 ~ 2026. 11. 23</span>
                                        </div>
                                        <h6 className="text-lg font-bold text-white">제 20회차 상주 클럽 리그전</h6>
                                    </div>
                                </div>
                            </div>

                            {/* Explanatory Features */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="feature-box">
                                    <h4 className="font-bold text-blue-400 text-sm mb-1">🎳 1. 상주리그 승점제</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">Game 승점(2점) + Total Pin 승점(4점) = 라운드당 총 10점 승점 자동 집계.</p>
                                </div>
                                <div className="feature-box">
                                    <h4 className="font-bold text-amber-400 text-sm mb-1">👑 2. 챔프전 토너먼트</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">예선 상위 8/16명 자동 선발 ➜ 결승 1:1 대진표 및 사다리 토너먼트 생성.</p>
                                </div>
                                <div className="feature-box">
                                    <h4 className="font-bold text-emerald-400 text-sm mb-1">⚖️ 3. 자동 핸디캡 공식</h4>
                                    <p className="text-xs text-slate-400 leading-relaxed">여성 보너스(+10~15핀) 및 에버리지 기반 핸디캡이 실시간 리더보드에 자동 계산 적용.</p>
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
