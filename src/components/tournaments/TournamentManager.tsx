'use client';

import { useState, useRef, useEffect } from 'react';
import { generateLeagueSchedule, updateLeagueScheduleDates } from '@/app/actions/league-actions';
import { updateTournamentRules, updateTeamHandicaps } from '@/app/actions/tournament-mgmt';
import Link from 'next/link';

interface Team {
    id: string;
    name: string;
}

export default function TournamentManager({
    tournament,
    centerId,
    availableTeams,
    hasExistingSchedule = false,
    hasStarted = false
}: {
    tournament: any;
    centerId: string;
    availableTeams: Team[];
    hasExistingSchedule?: boolean;
    hasStarted?: boolean;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'SCHEDULE' | 'RULES' | 'PENALTIES'>('SCHEDULE');
    const [loading, setLoading] = useState(false);

    // --- Schedule State ---
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [splitTeams, setSplitTeams] = useState<string[]>([]); // Team IDs to split into A/B
    const [startLane, setStartLane] = useState(1);
    const [endLane, setEndLane] = useState(12);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [leagueDay, setLeagueDay] = useState(1); // Monday (1)
    const [skippedDates, setSkippedDates] = useState<string[]>([]);
    const [dateToAdd, setDateToAdd] = useState('');

    // --- Rules State ---
    const [rules, setRules] = useState({
        teamHandicapLimit: tournament.teamHandicapLimit ?? '', // Use empty string for null input
        awardMinGames: tournament.awardMinGames || 12,
        avgTopRankCount: tournament.avgTopRankCount || 30,
        avgMinParticipationPct: tournament.avgMinParticipationPct || 0,
        reportNotice: tournament.reportNotice || `* 개인 에버 / 개인 시리즈 / 단게임은 ${Math.ceil((tournament.awardMinGames || 12) / 3)}주(${(tournament.awardMinGames || 12)}게임) 이상 참여자 대상\n* 모든 개인 기록(에버, 시리즈, 단게임)은 핸디캡 포함 기준입니다.\n* 단체전은 중복시상 가능하나 개인전은 중복시상 불가 (에버 > 시리즈 > 단게임)`
    });

    // --- Penalties State ---
    const [manualHandicaps, setManualHandicaps] = useState<Record<string, number>>(
        tournament.manualTeamHandicaps ? JSON.parse(tournament.manualTeamHandicaps) : {}
    );

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = (textareaRef.current.scrollHeight + 2) + 'px';
        }
    }, [rules.reportNotice]);

    // --- Actions ---

    const toggleTeam = (teamId: string) => {
        setSelectedTeams(prev => {
            const isSelected = prev.includes(teamId);
            if (isSelected) {
                // Also remove from splitTeams if deselecting
                setSplitTeams(sPrev => sPrev.filter(id => id !== teamId));
                return prev.filter(id => id !== teamId);
            }
            return [...prev, teamId];
        });
    };

    const toggleSplit = (teamId: string) => {
        setSplitTeams(prev =>
            prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
        );
    };

    const toggleSkippedDate = (date: string) => {
        setSkippedDates(prev =>
            prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
        );
    };

    const handleGenerateSchedule = async () => {
        alert("대표에 의해 차단된 기능입니다");
        return;
        setLoading(true);
        try {
            if (hasStarted) {
                if (!confirm("현재 진행 중인 리그입니다.\n경기 결과(점수)는 유지되며, '라운드 날짜'만 재계산되어 업데이트됩니다.\n계속하시겠습니까?")) {
                    setLoading(false);
                    return;
                }
                await updateLeagueScheduleDates(tournament.id, skippedDates, startDate, leagueDay);
                alert("일정이 성공적으로 업데이트되었습니다.");
            } else {
                const totalCalculatedTeams = selectedTeams.length + splitTeams.length;
                if (selectedTeams.length === 0) { alert("팀을 선택해주세요."); setLoading(false); return; }
                if (totalCalculatedTeams % 2 !== 0) { alert(`짝수 팀으로 구성해 주세요. (현재 ${totalCalculatedTeams}팀: ${selectedTeams.length}팀 + 분할 ${splitTeams.length}팀)`); setLoading(false); return; }

                await generateLeagueSchedule(tournament.id, selectedTeams, startLane, endLane, skippedDates, startDate, leagueDay, splitTeams);
                alert("대진표가 생성되었습니다.");
            }
            window.location.reload();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRules = async () => {
        setLoading(true);
        try {
            await updateTournamentRules(tournament.id, {
                teamHandicapLimit: rules.teamHandicapLimit === '' ? null : Number(rules.teamHandicapLimit),
                awardMinGames: Number(rules.awardMinGames),
                avgTopRankCount: Number(rules.avgTopRankCount),
                avgMinParticipationPct: Number(rules.avgMinParticipationPct),
                reportNotice: rules.reportNotice
            });
            alert("대회 규정이 저장되었습니다.");
        } catch (error: any) {
            alert("저장 실패: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePenalties = async () => {
        setLoading(true);
        try {
            await updateTeamHandicaps(tournament.id, manualHandicaps);
            alert("팀 핸디캡/페널티가 저장되었습니다.");
        } catch (error: any) {
            alert("저장 실패: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isExpanded) {
        return (
            <div className="card p-6 bg-secondary/5 border-dashed border-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h3 className="font-bold text-lg text-primary">⚙️ 대회 관리</h3>
                    <p className="text-xs text-secondary-foreground">
                        대진표 생성, 대회 규정(핸디캡 제한, 시상 기준), 팀별 페널티 등을 관리합니다.
                    </p>
                </div>
                <button onClick={() => setIsExpanded(true)} className="btn btn-primary btn-sm px-6 h-10 shadow-lg">
                    대회 관리하기
                </button>
            </div>
        );
    }

    return (
        <div className="card p-6 bg-secondary/10 border-secondary/20 relative">
            <button
                onClick={() => setIsExpanded(false)}
                className="absolute top-4 right-4 text-xs hover:underline text-secondary-foreground"
            >
                닫기 ✕
            </button>
            <h3 className="text-xl font-bold mb-6">⚙️ 대회 관리</h3>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-secondary/20 pb-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('SCHEDULE')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'SCHEDULE' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary/10'}`}
                >
                    📅 일정 및 대진표
                </button>
                <button
                    onClick={() => setActiveTab('RULES')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'RULES' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary/10'}`}
                >
                    ⚖️ 대회 규정 설정
                </button>
                <button
                    onClick={() => setActiveTab('PENALTIES')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'PENALTIES' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary/10'}`}
                >
                    📉 팀 핸디캡 관리
                </button>
            </div>

            {/* SCHEDULE TAB */}
            {activeTab === 'SCHEDULE' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h4 className="font-bold border-l-4 border-primary pl-2">📅 리그 일정 및 대진표 생성</h4>

                    {/* Team Selection (Only if not started) */}
                    {!hasStarted && (
                        <div className="bg-background p-4 rounded-xl border border-border">
                            <div className="flex justify-between items-end mb-2">
                                <h5 className="font-bold text-sm">참여 팀 선택 ({selectedTeams.length}팀)</h5>
                                <button onClick={() => setSelectedTeams(availableTeams.map(t => t.id))} className="text-[10px] text-primary hover:underline">전체 선택</button>
                            </div>
                            <div className="max-h-52 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                {availableTeams.map(team => (
                                    <div key={team.id} className="flex items-center gap-3 p-2 hover:bg-secondary/5 border border-transparent hover:border-border rounded-lg transition-colors">
                                        <label className="flex items-center gap-2 text-xs cursor-pointer min-w-0">
                                            <input type="checkbox" checked={selectedTeams.includes(team.id)} onChange={() => toggleTeam(team.id)} className="checkbox checkbox-xs" />
                                            <span className="font-bold truncate">{team.name}</span>
                                        </label>
                                        {selectedTeams.includes(team.id) && (
                                            <button
                                                onClick={() => toggleSplit(team.id)}
                                                className={`text-[10px] px-2 py-1 rounded-md transition-all whitespace-nowrap flex-shrink-0 ${splitTeams.includes(team.id) ? 'bg-primary text-primary-foreground font-bold border-primary' : 'bg-secondary/20 text-secondary-foreground border-transparent border'}`}
                                            >
                                                {splitTeams.includes(team.id) ? '분할됨 (A/B)' : '분할(A/B)'}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-dashed text-[10px] text-primary flex justify-between font-bold">
                                <span>기존 선택: {selectedTeams.length}팀</span>
                                <span>분할 추가: +{splitTeams.length}팀</span>
                                <span className="text-secondary-foreground">최종: {selectedTeams.length + splitTeams.length}팀</span>
                            </div>
                        </div>
                    )}

                    {/* Lane & Date Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {!hasStarted && (
                            <div className="bg-background p-4 rounded-xl border border-border space-y-3">
                                <h5 className="font-bold text-sm">레인 배정</h5>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold block mb-1">시작 레인</label>
                                        <input type="number" className="input h-9 w-full" value={startLane} onChange={(e) => setStartLane(parseInt(e.target.value) || 1)} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold block mb-1">종료 레인</label>
                                        <input type="number" className="input h-9 w-full" value={endLane} onChange={(e) => setEndLane(parseInt(e.target.value) || 1)} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="bg-background p-4 rounded-xl border border-border space-y-3">
                            <h5 className="font-bold text-sm">일정 설정</h5>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-bold block mb-1">시작일</label>
                                    <input type="date" className="input h-9 w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold block mb-1">요일</label>
                                    <select className="select h-9 w-full text-xs" value={leagueDay} onChange={(e) => setLeagueDay(parseInt(e.target.value))}>
                                        <option value={1}>월요일</option><option value={2}>화요일</option><option value={3}>수요일</option>
                                        <option value={4}>목요일</option><option value={5}>금요일</option><option value={6}>토요일</option><option value={0}>일요일</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Skipped Dates Management */}
                    <div className="bg-background p-4 rounded-xl border border-border space-y-4">
                        <div className="flex justify-between items-center">
                            <h5 className="font-bold text-sm">제외 일자(쉬는 날) 관리</h5>
                            <span className="text-[10px] text-secondary-foreground font-medium">명절, 공휴일 등 일정을 건너뛸 날짜를 추가하세요.</span>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="date"
                                className="input h-10 flex-1 border-2 focus:border-primary transition-colors"
                                value={dateToAdd}
                                onChange={(e) => setDateToAdd(e.target.value)}
                            />
                            <button
                                onClick={() => {
                                    if (dateToAdd) {
                                        toggleSkippedDate(dateToAdd);
                                        setDateToAdd('');
                                    }
                                }}
                                className="btn btn-secondary h-10 px-6 font-black shadow-sm"
                            >
                                추가
                            </button>
                        </div>

                        {skippedDates.length > 0 ? (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed mt-2">
                                {skippedDates.sort().map(date => (
                                    <div key={date} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 border border-blue-100 shadow-sm animate-in zoom-in-95 duration-200">
                                        <span>📅 {date}</span>
                                        <button
                                            onClick={() => toggleSkippedDate(date)}
                                            className="hover:bg-blue-200 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-400 font-medium text-center py-2">추가된 제외 일자가 없습니다.</p>
                        )}
                    </div>

                    <button
                        onClick={handleGenerateSchedule}
                        disabled={loading}
                        className="btn btn-primary w-full h-12 font-bold shadow-md"
                    >
                        {loading ? "처리 중..." : (hasStarted ? "일정 날짜만 업데이트" : "대진표 생성 / 재생성")}
                    </button>
                    {hasStarted && <p className="text-xs text-red-500 font-medium text-center">* 리그가 진행 중이므로 팀/레인 변경은 불가능합니다.</p>}
                </div>
            )}

            {/* RULES TAB */}
            {activeTab === 'RULES' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h4 className="font-bold border-l-4 border-primary pl-2">⚖️ 대회 규정 및 시상 기준</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-background p-4 rounded-xl border border-border space-y-4">
                            <h5 className="font-bold text-sm text-primary">팀 점수 산정 방식</h5>
                            <div>
                                <label className="text-xs font-bold block mb-1">팀 핸디캡 제한 (Team Handicap Limit)</label>
                                <input
                                    type="number"
                                    className="input h-10 w-full"
                                    placeholder="예: 30 (제한 없으면 비워둠)"
                                    value={rules.teamHandicapLimit}
                                    onChange={(e) => setRules({ ...rules, teamHandicapLimit: e.target.value })}
                                />
                                <p className="text-[10px] text-secondary-foreground mt-1">
                                    * 팀원 핸디캡 총합이 이 값을 넘을 경우, 초과분은 버리고 제한값까지만 팀 점수에 합산됩니다.<br />
                                    * 개인 점수에는 영향을 주지 않습니다.
                                </p>
                            </div>
                        </div>

                        <div className="bg-background p-4 rounded-xl border border-border space-y-4">
                            <h5 className="font-bold text-sm text-primary">개인 시상 및 순위 기준</h5>
                            <div>
                                <label className="text-xs font-bold block mb-1">개인 시상 최소 참여 횟수 (경기 수)</label>
                                <input
                                    type="number"
                                    className="input h-10 w-full"
                                    value={rules.awardMinGames}
                                    onChange={(e) => setRules({ ...rules, awardMinGames: Number(e.target.value) })}
                                />
                                <p className="text-[10px] text-secondary-foreground mt-1">
                                    * 설정한 경기 수(게임 수) 이상 참여한 선수만 시상 대상에 포함됩니다. (기본값: 12)
                                </p>
                            </div>
                        </div>

                        <div className="bg-background p-4 rounded-xl border border-border space-y-4 md:col-span-2">
                            <h5 className="font-bold text-sm text-primary">개인 평균 Top 순위표 설정</h5>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold block mb-1">순위 선정 인원 수 (명)</label>
                                    <input
                                        type="number"
                                        className="input h-10 w-full"
                                        value={rules.avgTopRankCount}
                                        onChange={(e) => setRules({ ...rules, avgTopRankCount: Number(e.target.value) })}
                                    />
                                    <p className="text-[10px] text-secondary-foreground mt-1">
                                        * '개인 평균 Top' 페이지에 표시할 인원 수입니다. (기본값: 30)
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold block mb-1">최소 참여율 기준 (%)</label>
                                    <input
                                        type="number"
                                        className="input h-10 w-full"
                                        value={rules.avgMinParticipationPct}
                                        onChange={(e) => setRules({ ...rules, avgMinParticipationPct: Number(e.target.value) })}
                                    />
                                    <p className="text-[10px] text-secondary-foreground mt-1">
                                        * 현재까지 진행된 총 경기 수 대비 참여율(%)이 이 값 이상인 선수만 Top 리스트에 포함됩니다.<br />
                                        * 예: 50% 설정 시 4게임 중 2게임 이상 참여자만 노출. (기본값: 0 - 제한없음)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Report Notice Editor */}
                        <div className="bg-background p-4 rounded-xl border border-border space-y-4 md:col-span-2">
                            <h5 className="font-bold text-sm text-primary">리포트 하단 안내 문구</h5>
                            <div>
                                <label className="text-xs font-bold block mb-1">안내 문구 (리포트/순위표 노출)</label>
                                <textarea
                                    ref={textareaRef}
                                    className="textarea w-full min-h-[80px] text-xs leading-relaxed border-2 border-primary/20 focus:border-primary overflow-hidden resize-none"
                                    placeholder="리포트 하단에 표시될 안내 문구를 입력하세요. 한 줄에 하나씩 입력하면 좋습니다."
                                    value={rules.reportNotice}
                                    onChange={(e) => setRules({ ...rules, reportNotice: e.target.value })}
                                />
                                <p className="text-[10px] text-secondary-foreground mt-2">
                                    * 이 문구는 매주 생성되는 리포트 이미지 하단과 웹 순위표 하단 영역에 표시됩니다.<br />
                                    * 줄바꿈을 포함하여 입력 가능합니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveRules}
                        disabled={loading}
                        className="btn btn-primary w-full h-12 font-bold shadow-md"
                    >
                        {loading ? "저장 중..." : "규정 저장하기"}
                    </button>
                </div>
            )}

            {/* PENALTIES TAB */}
            {activeTab === 'PENALTIES' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h4 className="font-bold border-l-4 border-primary pl-2">📉 팀별 수동 핸디캡 (페널티) 관리</h4>
                    <p className="text-xs text-secondary-foreground mb-4">
                        상위 팀 견제 등을 위해 특정 팀에게 <strong>매 게임마다</strong> 고정 점수(핸디캡)를 부여합니다.<br />
                        마이너스(-) 점수를 입력하면 페널티가 됩니다. (예: -10 입력 시 게임당 10점 감점)
                    </p>

                    <div className="bg-background rounded-xl border border-border overflow-hidden">
                        <div className="max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-secondary/10 sticky top-0">
                                    <tr>
                                        <th className="p-3 text-left">팀명</th>
                                        <th className="p-3 text-right">수동 핸디캡 (점)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {availableTeams.map(team => (
                                        <tr key={team.id} className="hover:bg-secondary/5">
                                            <td className="p-3 font-medium">{team.name}</td>
                                            <td className="p-3 text-right">
                                                <input
                                                    type="number"
                                                    className="input h-8 w-24 text-right font-bold"
                                                    value={manualHandicaps[team.id] || 0}
                                                    onChange={(e) => setManualHandicaps({
                                                        ...manualHandicaps,
                                                        [team.id]: Number(e.target.value)
                                                    })}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <button
                        onClick={handleSavePenalties}
                        disabled={loading}
                        className="btn btn-primary w-full h-12 font-bold shadow-md"
                    >
                        {loading ? "저장 중..." : "핸디캡 설정 저장하기"}
                    </button>
                </div>
            )}
        </div>
    );
}
