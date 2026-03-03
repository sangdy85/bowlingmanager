'use client';

import { useState } from 'react';
import Link from 'next/link';
import TournamentDescriptionEditor from './TournamentDescriptionEditor';
import TournamentAttachmentManager from './TournamentAttachmentManager';
import LeagueScheduleView from './LeagueScheduleView';
import LeagueLeaderboard from './LeagueLeaderboard';
import IndividualLeaderboard from './IndividualLeaderboard';
import Top30Leaderboard from './Top30Leaderboard';
import LeagueResultManager from './LeagueResultManager';
import ChampManager from './ChampManager';
import EventManager from './EventManager';
import TournamentRegButton from './TournamentRegButton';
import RoundParticipantManager from './RoundParticipantManager';
import GrandFinaleQualifiersStatus from './GrandFinaleQualifiersStatus';
import GrandFinaleCumulativeManager from './GrandFinaleCumulativeManager';

interface TournamentMemberViewProps {
    tournament: any;
    centerId: string;
    centerName: string;
    centerAddress: string;
    leaderboardData: any;
    individualData: any;
    currentUserId?: string;
    isRegistered?: boolean;
    hasStarted?: boolean;
    initialRoundId?: string;
}

import { useSearchParams } from 'next/navigation';

export default function TournamentMemberView({
    tournament,
    centerId,
    centerName,
    centerAddress,
    leaderboardData,
    individualData,
    currentUserId,
    isRegistered,
    hasStarted,
    initialRoundId
}: TournamentMemberViewProps) {
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode'); // 'recruit' or 'results'

    // Default to 'results' for CHAMP if not specified, 
    // but the entry points will explicitly set it now.
    const isCHAMPRecruit = tournament.type === 'CHAMP' && mode === 'recruit';
    const isCHAMPResults = tournament.type === 'CHAMP' && (mode === 'results' || !mode);

    const settings = (() => {
        try {
            return tournament.settings ? JSON.parse(tournament.settings) : {};
        } catch (e) {
            console.error("Failed to parse tournament settings", e);
            return {};
        }
    })();

    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SCHEDULE' | 'RANKING' | 'RESULTS'>(
        (tournament.status === 'FINISHED' || (tournament.type === 'CHAMP' && tournament.status === 'ONGOING'))
            ? 'RESULTS'
            : 'OVERVIEW'
    );
    const [showTop30, setShowTop30] = useState(false);

    const allTabs = [
        { id: 'OVERVIEW', label: '🏟️ 대회 요강/개요', icon: '📝', types: ['LEAGUE', 'CHAMP', 'EVENT'] },
        { id: 'SCHEDULE', label: '📅 대진표 확인', icon: '🗓️', types: ['LEAGUE'] },
        { id: 'RANKING', label: '🏆 순위 및 기록', icon: '📊', types: ['LEAGUE'] },
        { id: 'RESULTS', label: tournament.type === 'LEAGUE' ? 'Bowling 경기 결과' : (tournament.status === 'FINISHED' ? '🎳 최종 결과/행운권' : '🎳 회차별 경기/신청'), icon: '🎳', types: ['LEAGUE', 'CHAMP', 'EVENT'] },
    ];

    const tabs = allTabs.filter(tab => tab.types.includes(tournament.type));

    // Ensure activeTab is valid for the current tournament type
    if (!tabs.find(t => t.id === activeTab)) {
        setActiveTab('OVERVIEW');
    }

    return (
        <div className="space-y-8">
            {/* Custom Tab Navigation - Hidden for EVENT (only when NOT FINISHED), CHAMP or if only 1 tab */}
            {((tournament.type !== 'EVENT' && tournament.type !== 'CHAMP') || (tournament.type === 'EVENT' && tournament.status === 'FINISHED')) && tabs.length > 1 && (
                <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-2xl border-2 border-slate-200">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 min-w-[140px] px-4 py-3 rounded-xl font-black text-sm transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === tab.id
                                ? 'bg-white text-primary shadow-lg scale-[1.02] border-2 border-primary/20'
                                : 'text-slate-500 hover:bg-white/50'
                                }`}
                        >
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {activeTab === 'RESULTS' && tournament.type === 'EVENT' && tournament.status === 'FINISHED' && (
                    <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-200 shadow-inner">
                            <div className="flex items-center gap-3 mb-6 px-2">
                                <span className="text-2xl">📝</span>
                                <h3 className="text-xl font-black italic">대회 요강 및 안내</h3>
                            </div>
                            <TournamentDescriptionEditor
                                tournamentId={tournament.id}
                                initialDescription={tournament.description}
                                isManager={false}
                            />
                        </div>
                    </div>
                )}
                {/* Unified CHAMP Dashboard Layout */}
                {tournament.type === 'CHAMP' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
                        {/* 1. Overview Section - Visible in both Modes for CHAMP */}
                        <section className="card p-0 overflow-hidden shadow-xl border-2 border-black">
                            <div className="p-6 bg-primary text-primary-foreground">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    📝 대회 요강 및 개요
                                </h2>
                            </div>
                            <div className="p-8 space-y-8">
                                <TournamentDescriptionEditor
                                    tournamentId={tournament.id}
                                    initialDescription={tournament.description}
                                    isManager={false}
                                />

                                {tournament.settings && (
                                    <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100">
                                        <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                                            <span className="text-2xl">📋</span> 상세 요강 안내
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                                            {(() => {
                                                const s = settings;
                                                const items = [
                                                    { label: '일시', value: s.startDateText, icon: '📅' },
                                                    { label: '대회 시간', value: tournament.leagueTime, icon: '⏰' },
                                                    { label: '접수 시작', value: s.registrationStart ? new Date(s.registrationStart).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' }) : null, icon: '📝' },
                                                    { label: '경기 방식', value: s.gameMethod, icon: '🎳' },
                                                    { label: '참가 대상', value: s.target, icon: '👥' },
                                                    { label: '참가비', value: s.entryFeeText, icon: '💵' },
                                                    { label: '핸디 적용', value: s.handicapInfo, icon: '⚖️' },
                                                    { label: '대회 패턴', value: s.pattern, icon: '🗺️' },
                                                ];
                                                return items.filter(item => item.value).map((item, idx) => (
                                                    <div key={idx} className="flex items-start gap-4 border-b border-gray-100 pb-3">
                                                        <div className="text-sm font-bold text-gray-400 flex items-center gap-2 uppercase tracking-tight min-w-[100px] shrink-0">
                                                            <span>{item.icon}</span> {item.label}
                                                        </div>
                                                        <div className="font-black text-gray-800 break-all">{item.value}</div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                )}

                                <TournamentAttachmentManager
                                    tournamentId={tournament.id}
                                    attachments={tournament.attachments}
                                    isManager={false}
                                />
                            </div>
                        </section>


                        {/* 2. Unified Action Buttons - Only in Results Mode */}
                        {isCHAMPResults && (() => {
                            const s = settings;

                            return (
                                <section className="py-2">
                                    <div className="card bg-indigo-50/40 p-10 border-2 border-indigo-100 shadow-2xl rounded-[2.5rem] relative overflow-hidden group">


                                        <div className="relative z-10 space-y-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md border-2 border-black">
                                                    <span className="text-xl text-white">🏆</span>
                                                </div>
                                                <h3 className="text-24px md:text-2xl font-black italic tracking-tight leading-none">왕중왕전 현황 및 명단</h3>
                                            </div>

                                            <div className="flex flex-col gap-4">
                                                {s.hasGrandFinale === 'CUMULATIVE' && (
                                                    <Link
                                                        href={`/centers/${centerId}/tournaments/${tournament.id}/grand-finale-leaderboard`}
                                                        className="btn btn-primary w-full h-24 text-2xl font-black shadow-[0_10px_30px_rgba(79,70,229,0.3)] flex items-center justify-center gap-4 border-4 border-black !bg-indigo-600 hover:!bg-indigo-700 text-white transform hover:scale-[1.01] transition-all rounded-[2rem]"
                                                    >
                                                        <span className="text-4xl">🎖️</span> 왕중왕전 포인트 현황 (종합)
                                                    </Link>
                                                )}
                                                {s.hasGrandFinale === 'WINNERS' && (
                                                    <Link
                                                        href={`/centers/${centerId}/tournaments/${tournament.id}/grand-finale-qualifiers`}
                                                        className="btn btn-primary w-full h-24 text-2xl font-black shadow-[0_10px_30px_rgba(79,70,229,0.3)] flex items-center justify-center gap-4 border-4 border-black !bg-indigo-600 hover:!bg-indigo-700 text-white transform hover:scale-[1.01] transition-all rounded-[2rem]"
                                                    >
                                                        <span className="text-4xl">🏆</span> 왕중왕전 진출자 확인
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            );
                        })()}

                        {/* 3. Current Round Participation & Sidebar Results */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-12">
                                {isCHAMPResults && (
                                    <section className="space-y-6 pt-0 mb-12">
                                        <div className="flex items-center gap-3 px-2">
                                            <span className="text-2xl">📜</span>
                                            <h3 className="text-xl font-black italic">전체 회차 기록 및 결과</h3>
                                        </div>
                                        <div className="bg-slate-50 p-8 rounded-3xl border-2 border-black shadow-inner">
                                            <ChampManager
                                                tournament={tournament}
                                                centerId={centerId}
                                                isManager={false}
                                                currentUserId={currentUserId}
                                                isMemberView={true}
                                                isArchiveView={true}
                                            />
                                        </div>
                                    </section>
                                )}

                                <section className="card p-8 border-2 border-black transition-all hover:shadow-2xl h-full">
                                    <div className="flex flex-col items-start gap-4 mb-8 border-b-2 border-slate-100 pb-6">
                                        <h2 className="text-2xl font-black italic flex items-center gap-2">
                                            <span className="text-3xl">👥</span> {(() => {
                                                const rounds = tournament.leagueRounds || [];
                                                const currentRound = rounds.find((r: any) => r.id === initialRoundId);
                                                const roundPrefix = currentRound ? `${currentRound.roundNumber}회차 ` : '';
                                                return isCHAMPResults ? `${roundPrefix}참가자 명단` : `${roundPrefix}참가자 명단 (${tournament.registrations.length}/${tournament.maxParticipants})`;
                                            })()}
                                        </h2>
                                        {/* Register Button - Only in Recruit Mode */}
                                        {isCHAMPRecruit && (
                                            <div className="w-full">
                                                <TournamentRegButton
                                                    tournament={tournament}
                                                    isRegistered={isRegistered || false}
                                                    canJoin={tournament.status !== 'FINISHED'}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {(() => {
                                        const rounds = tournament.leagueRounds || [];
                                        if (rounds.length === 0) return <p className="text-center text-secondary-foreground py-10 border-2 border-dashed rounded-xl font-medium">아직 신청한 참가자가 없습니다.</p>;

                                        return (
                                            <RoundParticipantManager
                                                rounds={rounds}
                                                initialRoundId={initialRoundId}
                                                allRegistrations={tournament.registrations}
                                                isManager={false}
                                                maxParticipants={tournament.maxParticipants}
                                                isEvent={tournament.type === 'EVENT'}
                                                hideRoundTabs={true}
                                                currentUserId={currentUserId}
                                                centerId={centerId}
                                                tournament={tournament}
                                            />
                                        );
                                    })()}
                                </section>
                            </div>

                            <div className="space-y-8">
                                {/* Tournament Info & Live Results - ONLY in Recruiting Mode */}
                                {isCHAMPRecruit && (
                                    <div className="card p-6 border-l-8 border-primary shadow-lg bg-primary/5 border-2 border-black">
                                        <h3 className="font-black text-lg mb-4 flex items-center gap-2">🏆 대회 정보 및 결과</h3>
                                        <p className="text-sm text-secondary-foreground mb-6 font-medium">실시간 순위 데이터와 결과를 확인하세요.</p>
                                        <div className="flex flex-col">
                                            {(() => {
                                                const rounds = tournament.leagueRounds || [];
                                                let targetRound = initialRoundId ? rounds.find((r: any) => r.id === initialRoundId) : null;

                                                if (!targetRound) {
                                                    // Use calculated status from server
                                                    targetRound = rounds.find((r: any) =>
                                                        r.calculatedStatus === 'OPEN' || r.calculatedStatus === 'CLOSED' || r.calculatedStatus === 'ONGOING'
                                                    );
                                                }
                                                if (!targetRound && rounds.length > 0) targetRound = rounds[rounds.length - 1];

                                                return (
                                                    <div className="flex flex-col gap-3">
                                                        {targetRound && (
                                                            <>
                                                                <Link
                                                                    href={`/centers/${centerId}/tournaments/${tournament.id}/rounds/${targetRound.id}?tab=finalResults${mode === 'recruit' ? '&from=recruit' : ''}`}
                                                                    className="btn btn-primary w-full text-base font-black h-14 shadow-lg flex items-center justify-center border-2 border-black bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white"
                                                                >
                                                                    📊 대회 결과 (실시간)
                                                                </Link>
                                                                <Link
                                                                    href={`/centers/${centerId}/tournaments/${tournament.id}/rounds/${targetRound.id}/side-game${mode === 'recruit' ? '?from=recruit' : ''}`}
                                                                    className="btn btn-primary w-full text-base font-black h-14 shadow-lg flex items-center justify-center gap-2 border-2 border-black !bg-blue-600 hover:!bg-blue-700 text-white transition-all transform hover:scale-[1.02]"
                                                                >
                                                                    🎳 사이드 결과 (실시간)
                                                                </Link>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                <div className="card p-6 border-2 border-black shadow-lg">
                                    <h3 className="font-black text-lg mb-4 text-primary">📍 참여 볼링장</h3>
                                    <div className="space-y-2 mb-6">
                                        <p className="font-black text-xl">{centerName}</p>
                                        <p className="text-xs text-secondary-foreground font-medium">{centerAddress}</p>
                                    </div>
                                    <Link
                                        href={`/centers/${centerId}`}
                                        className="btn btn-secondary w-full font-bold border-2 border-black transition-transform hover:scale-105"
                                    >
                                        볼링장 정보 더보기
                                    </Link>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {activeTab === 'OVERVIEW' && tournament.type !== 'CHAMP' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {tournament.type === 'LEAGUE' ? (
                            <section className="card p-0 overflow-hidden shadow-xl border-2 border-black">
                                <div className="p-6 bg-primary text-primary-foreground">
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        📝 대회 요강 및 개요
                                    </h2>
                                </div>
                                <div className="p-8 space-y-8">
                                    <TournamentDescriptionEditor
                                        tournamentId={tournament.id}
                                        initialDescription={tournament.description}
                                        isManager={false}
                                    />

                                    {tournament.settings && (
                                        <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100">
                                            <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                                                <span className="text-2xl">📋</span> 상세 요강 안내
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                                                {(() => {
                                                    const s = settings;
                                                    const items = [
                                                        { label: '일시', value: s.startDateText, icon: '📅' },
                                                        { label: '대회 시간', value: tournament.leagueTime, icon: '⏰' },
                                                        { label: '접수 시작', value: s.registrationStart ? new Date(s.registrationStart).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' }) : null, icon: '📝' },
                                                        { label: '경기 방식', value: s.gameMethod, icon: '🎳' },
                                                        { label: '참가 대상', value: s.target, icon: '👥' },
                                                        { label: '참가비', value: s.entryFeeText, icon: '💵' },
                                                        { label: '핸디 적용', value: s.handicapInfo, icon: '⚖️' },
                                                        { label: '대회 패턴', value: s.pattern, icon: '🗺️' },
                                                    ];
                                                    return items.filter(item => item.value).map((item, idx) => (
                                                        <div key={idx} className="flex items-start gap-4 border-b border-gray-100 pb-3">
                                                            <div className="text-sm font-bold text-gray-400 flex items-center gap-2 uppercase tracking-tight min-w-[100px] shrink-0">
                                                                <span>{item.icon}</span> {item.label}
                                                            </div>
                                                            <div className="font-black text-gray-800 break-all">{item.value}</div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    <TournamentAttachmentManager
                                        tournamentId={tournament.id}
                                        attachments={tournament.attachments}
                                        isManager={false}
                                    />
                                </div>
                            </section>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-10">
                                    <section className="card p-0 overflow-hidden shadow-xl border-2 border-black">
                                        <div className="p-6 bg-primary text-primary-foreground">
                                            <h2 className="text-xl font-bold flex items-center gap-2">
                                                📝 대회 요강 및 개요
                                            </h2>
                                        </div>
                                        <div className="p-8 space-y-8">
                                            <TournamentDescriptionEditor
                                                tournamentId={tournament.id}
                                                initialDescription={tournament.description}
                                                isManager={false}
                                            />

                                            {tournament.settings && (
                                                <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100">
                                                    <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                                                        <span className="text-2xl">📋</span> 상세 요강 안내
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                                                        {(() => {
                                                            const s = JSON.parse(tournament.settings);
                                                            const items = [
                                                                { label: '일시', value: s.startDateText, icon: '📅' },
                                                                { label: '대회 시간', value: tournament.leagueTime, icon: '⏰' },
                                                                { label: '접수 시작', value: s.registrationStart ? new Date(s.registrationStart).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' }) : null, icon: '📝' },
                                                                { label: '경기 방식', value: s.gameMethod, icon: '🎳' },
                                                                { label: '참가 대상', value: s.target, icon: '👥' },
                                                                { label: '참가비', value: s.entryFeeText, icon: '💵' },
                                                                { label: '핸디 적용', value: s.handicapInfo, icon: '⚖️' },
                                                                { label: '대회 패턴', value: s.pattern, icon: '🗺️' },
                                                            ];
                                                            return items.filter(item => item.value).map((item, idx) => (
                                                                <div key={idx} className="flex items-start gap-4 border-b border-gray-100 pb-3">
                                                                    <div className="text-sm font-bold text-gray-400 flex items-center gap-2 uppercase tracking-tight min-w-[100px] shrink-0">
                                                                        <span>{item.icon}</span> {item.label}
                                                                    </div>
                                                                    <div className="font-black text-gray-800 break-all">{item.value}</div>
                                                                </div>
                                                            ));
                                                        })()}
                                                    </div>
                                                </div>
                                            )}

                                            <TournamentAttachmentManager
                                                tournamentId={tournament.id}
                                                attachments={tournament.attachments}
                                                isManager={false}
                                            />
                                        </div>
                                    </section>

                                    <section className="card p-8 border-2 border-black transition-all hover:shadow-2xl">
                                        <div className="flex flex-col items-start gap-4 mb-8 border-b-2 border-slate-100 pb-6">
                                            <h2 className="text-2xl font-black italic flex items-center gap-2">
                                                <span className="text-3xl">👥</span> 참가자 명단 ({tournament.registrations.length}/{tournament.maxParticipants})
                                            </h2>
                                            <div className="w-full">
                                                <TournamentRegButton
                                                    tournament={tournament}
                                                    isRegistered={isRegistered || false}
                                                    canJoin={tournament.status !== 'FINISHED'}
                                                />
                                            </div>
                                        </div>

                                        {(() => {
                                            const rounds = tournament.leagueRounds || [];
                                            if (rounds.length === 0) return <p className="text-center text-secondary-foreground py-10 border-2 border-dashed rounded-xl font-medium">아직 신청한 참가자가 없습니다.</p>;

                                            return <RoundParticipantManager
                                                rounds={rounds}
                                                initialRoundId={initialRoundId}
                                                allRegistrations={tournament.registrations}
                                                isManager={false}
                                                maxParticipants={tournament.maxParticipants}
                                                isEvent={tournament.type === 'EVENT'}
                                                hideRoundTabs={true}
                                                centerId={centerId}
                                                currentUserId={currentUserId}
                                                tournament={tournament}
                                            />;
                                        })()}
                                    </section>
                                </div>

                                <div className="space-y-8">
                                    <div className="card p-6 border-l-8 border-primary shadow-lg bg-primary/5 border-2 border-black">
                                        <h3 className="font-black text-lg mb-4 flex items-center gap-2">🏆 실시간 결과</h3>
                                        <p className="text-sm text-secondary-foreground mb-6 font-medium">대회가 진행됨에 따라 실시간 순위 데이터가 집계됩니다.</p>
                                        <div className="flex flex-col">
                                            {(() => {
                                                const rounds = tournament.leagueRounds || [];
                                                let targetRound = initialRoundId ? rounds.find((r: any) => r.id === initialRoundId) : null;

                                                if (!targetRound) {
                                                    targetRound = rounds.find((r: any) =>
                                                        r.calculatedStatus === 'OPEN' || r.calculatedStatus === 'CLOSED' || r.calculatedStatus === 'ONGOING'
                                                    );
                                                }

                                                if (!targetRound && rounds.length > 0) {
                                                    targetRound = [...rounds].sort((a, b) => {
                                                        const dateA = a.effectiveDate ? new Date(a.effectiveDate).getTime() : 0;
                                                        const dateB = b.effectiveDate ? new Date(b.effectiveDate).getTime() : 0;
                                                        return dateB - dateA;
                                                    })[0];
                                                }

                                                return targetRound ? (
                                                    <div className="flex flex-col gap-3">
                                                        <Link
                                                            href={`/centers/${centerId}/tournaments/${tournament.id}/rounds/${targetRound.id}?tab=finalResults${mode === 'recruit' ? '&from=recruit' : ''}`}
                                                            className="btn btn-primary w-full text-base font-black h-14 shadow-lg flex items-center justify-center border-2 border-black bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white mb-2 animate-pulse"
                                                        >
                                                            📊 대회 결과 (실시간)
                                                        </Link>
                                                        <Link
                                                            href={`/centers/${centerId}/tournaments/${tournament.id}/rounds/${targetRound.id}/side-game${mode === 'recruit' ? '?from=recruit' : ''}`}
                                                            className="btn btn-primary w-full text-base font-black h-14 shadow-lg flex items-center justify-center gap-2 border-2 border-black !bg-blue-600 hover:!bg-blue-700 text-white transition-all transform hover:scale-[1.02]"
                                                        >
                                                            🎳 사이드 결과 (실시간)
                                                        </Link>
                                                    </div>
                                                ) : (
                                                    <div className="p-4 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold italic">
                                                        준비 중
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    {/* Sidebar Center Info */}
                                    <div className="card p-6 border-2 border-black shadow-lg">
                                        <h3 className="font-black text-lg mb-4 text-primary">📍 참여 볼링장</h3>
                                        <div className="space-y-2 mb-6">
                                            <p className="font-black text-xl">{centerName}</p>
                                            <p className="text-xs text-secondary-foreground font-medium">{centerAddress}</p>
                                        </div>
                                        <Link
                                            href={`/centers/${centerId}`}
                                            className="btn btn-secondary w-full font-bold border-2 border-black transition-transform hover:scale-105"
                                        >
                                            볼링장 정보 더보기
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'SCHEDULE' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <LeagueScheduleView
                            tournamentName={tournament.name}
                            leagueRounds={tournament.leagueRounds}
                            isManager={false}
                        />
                    </div>
                )}

                {activeTab === 'RANKING' && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowTop30(!showTop30)}
                                className={`px-6 h-12 rounded-xl font-black text-sm border-2 border-black transition-all ${showTop30
                                    ? 'bg-red-500 text-white shadow-inner'
                                    : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none'
                                    }`}
                            >
                                {showTop30 ? '🔙 전체 순위보기' : '🏆 개인 평균 Top 30 보기'}
                            </button>
                        </div>

                        {showTop30 ? (
                            <Top30Leaderboard
                                data={individualData}
                                title={tournament.name}
                            />
                        ) : (
                            <>
                                <LeagueLeaderboard
                                    data={leaderboardData}
                                    title={tournament.name}
                                />
                                <div className="pt-12 border-t-4 border-black border-dashed">
                                    <IndividualLeaderboard
                                        data={individualData}
                                        title={tournament.name}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'RESULTS' && tournament.type !== 'CHAMP' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
                        {tournament.type === 'EVENT' && (
                            <EventManager
                                tournament={tournament}
                                centerId={centerId}
                                isManager={false}
                            />
                        )}
                        <div className="pt-8 border-t-2 border-dashed border-slate-200">
                            <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-800 rounded-r-xl">
                                <p className="font-bold flex items-center gap-2">
                                    <span className="text-xl">ℹ️</span>
                                    {tournament.type === 'LEAGUE'
                                        ? '주차별 경기 결과를 확인하시려면 아래 리스트에서 "결과 확인하기" 버튼을 눌러주세요.'
                                        : '회차별 상점 및 상세 결과를 확인하시려면 아래 리스트에서 "결과 확인하기" 버튼을 눌러주세요.'}
                                </p>
                            </div>
                            <LeagueResultManager
                                centerId={centerId}
                                tournamentId={tournament.id}
                                rounds={tournament.leagueRounds}
                                isManager={false}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Participation Center Info (Only for LEAGUE, others have it in sidebar) */}
            {
                tournament.type === 'LEAGUE' && (
                    <div className="card p-8 border-2 border-black shadow-xl bg-slate-50 mt-12">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="space-y-2">
                                <h3 className="font-black text-xl flex items-center gap-2">
                                    <span className="text-2xl">📍</span> 참여 볼링장 안내
                                </h3>
                                <p className="font-black text-2xl text-primary">{centerName}</p>
                                <p className="text-sm text-secondary-foreground font-medium">{centerAddress}</p>
                            </div>
                            <Link
                                href={`/centers/${centerId}`}
                                className="btn btn-secondary px-8 h-12 flex items-center justify-center font-bold border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                            >
                                🏠 볼링장 메인 바로가기
                            </Link>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
