'use client';

import { useState, useRef, useEffect } from 'react';
import { calculateTournamentStatus, STATUS_LABELS, formatDateForInput, formatKSTDate, formatKSTDayLabel } from '@/lib/tournament-utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { updateRoundSettings, updateRoundParticipants, updateRoundLanes, updateRoundScores, manualRegister, updateLaneSettings, autoAssignRemaining, updatePaymentStatus, deleteRegistration, updateRegistration, updateLaneConfig, updateFemaleChampParticipants, updateLuckyDrawResult } from '@/app/actions/round-actions';
import { updateTournamentBasicInfo } from '@/app/actions/tournament-center';
import Link from "next/link";
import TournamentStatusDropdown from './TournamentStatusDropdown';
import DeleteTournamentButton from './DeleteTournamentButton';
import SmartExcelScoreUpload from "@/components/SmartExcelScoreUpload";
import { GeminiParsedRow } from "@/app/actions/gemini-score";
import confetti from 'canvas-confetti';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import SideGameManager from './SideGameManager';
import RoundResultSummary from './RoundResultSummary';
import RoundParticipantManager from '@/components/tournaments/RoundParticipantManager';
import { getEffectiveRoundDate, formatLane } from '@/lib/tournament-utils';

// --- Tab Components ---

// --- Tab Components ---

// 0. Overview Tab
function RoundOverviewTab({ round }: { round: any }) {
    const participantCount = round.participants.length;
    const assignedLanesCount = round.participants.filter((p: any) => p.lane).length;

    // Count unique registrations that have scores
    const scoredIds = new Set(round.individualScores.filter((s: any) => s.score > 0).map((s: any) => s.registrationId));
    const scoredCount = scoredIds.size;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm">
                    <h4 className="text-gray-500 text-sm font-bold mb-2 uppercase tracking-wide">대회 일정</h4>
                    <p className="text-2xl font-black text-gray-800">
                        {formatKSTDayLabel(round.date)}
                    </p>
                    <p className="text-sm text-gray-500 mt-2 font-medium">
                        접수: {formatKSTDate(round.registrationStart)}
                    </p>
                </div>
                <div className="bg-green-50 p-6 rounded-xl border border-green-100 shadow-sm">
                    <h4 className="text-gray-500 text-sm font-bold mb-2 uppercase tracking-wide">참가자 현황</h4>
                    <p className="text-2xl font-black text-gray-800">{participantCount}명</p>
                    <div className="w-full bg-green-200 rounded-full h-2.5 mt-3 mb-1">
                        <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${Math.min(100, (participantCount / 50) * 100)}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">
                        레인 배정: {assignedLanesCount}명 완료
                    </p>
                </div>
                <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-100 shadow-sm">
                    <h4 className="text-gray-500 text-sm font-bold mb-2 uppercase tracking-wide">경기 진행</h4>
                    <p className="text-2xl font-black text-gray-800">{scoredCount}명</p>
                    <div className="w-full bg-yellow-200 rounded-full h-2.5 mt-3 mb-1">
                        <div className="bg-yellow-500 h-2.5 rounded-full" style={{ width: `${participantCount > 0 ? (scoredCount / participantCount) * 100 : 0}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">
                        점수 입력 진행 중
                    </p>
                </div>
            </div>

            <div className="card border p-6 bg-white shadow-sm rounded-xl">
                <h3 className="font-bold text-lg mb-4 text-gray-800">📌 빠른 도움말</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
                    <li><strong>[설정]</strong> 탭에서 대회 날짜와 접수 시작 시간을 수정할 수 있습니다.</li>
                    <li><strong>[참가자]</strong> 탭에서 이번 회차에 참가하는 인원을 선택하거나 <strong>수동 등록</strong>할 수 있습니다.</li>
                    <li>참가자 선택 후 <strong>[레인 배정]</strong> 탭에서 레인을 지정할 수 있습니다.</li>
                    <li>모든 준비가 끝나면 <strong>[점수 입력]</strong> 탭에서 경기 결과를 기록하세요.</li>
                </ul>
            </div>
        </div>
    );
}

// 1. Settings Tab
function RoundSettingsTab({ round, onUpdate }: { round: any, onUpdate: () => void }) {
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        try {
            const date = formData.get('date') as string;
            const regStart = formData.get('regStart') as string;
            const regEnd = '';
            const moveLaneType = formData.get('moveLaneType') as string;
            const moveLaneCount = parseInt(formData.get('moveLaneCount') as string) || 0;
            const hasFemaleChamp = formData.get('hasFemaleChamp') === 'true';

            const minusHandicapRank1 = formData.get('minusHandicapRank1') ? parseInt(formData.get('minusHandicapRank1') as string) : undefined;
            const minusHandicapRank2 = formData.get('minusHandicapRank2') ? parseInt(formData.get('minusHandicapRank2') as string) : undefined;
            const minusHandicapRank3 = formData.get('minusHandicapRank3') ? parseInt(formData.get('minusHandicapRank3') as string) : undefined;
            const minusHandicapFemale = formData.get('minusHandicapFemale') ? parseInt(formData.get('minusHandicapFemale') as string) : undefined;

            await updateRoundSettings(round.id, {
                date,
                regStart,
                regEnd,
                moveLaneType,
                moveLaneCount,
                hasFemaleChamp,
                minusHandicapRank1,
                minusHandicapRank2,
                minusHandicapRank3,
                minusHandicapFemale
            });
            alert('설정이 저장되었습니다.');
            onUpdate();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form action={handleSubmit} className="space-y-6 max-w-lg">
            {round.tournament.type !== 'EVENT' && (
                <>
                    <div>
                        <label className="block text-sm font-bold mb-2 text-gray-700">대회 날짜 (시간 제외)</label>
                        <input
                            type="date"
                            name="date"
                            defaultValue={round.date ? new Date(round.date).toISOString().slice(0, 10) : ''}
                            className="input w-full border-2 focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 text-gray-700">접수 시작 일시</label>
                        <input
                            type="datetime-local"
                            name="regStart"
                            defaultValue={formatDateForInput(round.registrationStart)}
                            className="input w-full border-2 focus:border-blue-500 transition-colors"
                        />
                        <p className="text-xs text-gray-500 mt-2 font-medium bg-gray-100 p-2 rounded">
                            ℹ️ 접수 종료 시간은 별도로 설정하지 않아도 됩니다. (상시 접수 또는 경기 시작 전까지)
                        </p>
                    </div>
                </>
            )}

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    🔄 레인 이동 설정
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold mb-1 text-gray-600">이동 방식</label>
                        <select
                            name="moveLaneType"
                            defaultValue={round.moveLaneType || ''}
                            className="input w-full border-2 focus:border-blue-500 transition-colors"
                        >
                            <option value="">이동 없음</option>
                            <option value="RIGHT">우측 테이블 이동</option>
                            <option value="LEFT">좌측 테이블 이동</option>
                            <option value="CROSS">크로스 이동 (좌우 교차)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 text-gray-600">이동할 테이블 수</label>
                        <input
                            type="number"
                            name="moveLaneCount"
                            defaultValue={round.moveLaneCount || 1}
                            min="1"
                            className="input w-full border-2 focus:border-blue-500 transition-colors"
                            placeholder="예: 1"
                        />
                    </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 space-y-1 bg-white p-3 rounded border">
                    <p>• <strong>우측/좌측 이동</strong>: 지정된 테이블 수만큼 이동 (범위 초과 시 순환)</p>
                    <p>• <strong>크로스 이동</strong>: 1게임 후 홀수 레인은 좌측, 짝수 레인은 우측으로 이동</p>
                </div>
            </div>

            {round.tournament.type !== 'EVENT' && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        🏆 여성 챔프 시상 설정
                    </h4>
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-bold text-gray-600">여성 챔프 제도 사용:</label>
                        <select
                            name="hasFemaleChamp"
                            defaultValue={round.hasFemaleChamp ? 'true' : 'false'}
                            className="input w-32 border-2 focus:border-blue-500 transition-colors"
                        >
                            <option value="false">미사용 (N)</option>
                            <option value="true">사용 (Y)</option>
                        </select>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">• 사용(Y) 시 점수 입력 창에서 특정 인원을 '여성 챔프'로 지정할 수 있습니다.</p>
                </div>
            )}

            {round.tournament.type === 'CHAMP' && (
                <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 space-y-4">
                    <h4 className="font-black text-slate-800 flex items-center gap-2">
                        <span className="text-xl">📉</span> 직전 회차 입상자 마이너스 핸디 설정
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        {(() => {
                            const tSettings = JSON.parse(round.tournament.settings || '{}');
                            const roundHandicaps = tSettings.roundMinusHandicaps?.[round.roundNumber] || {
                                rank1: tSettings.minusHandicapRank1 || 0,
                                rank2: tSettings.minusHandicapRank2 || 0,
                                rank3: tSettings.minusHandicapRank3 || 0,
                                female: tSettings.minusHandicapFemale || 0
                            };
                            return (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">1위 차감 점수</label>
                                        <input name="minusHandicapRank1" type="number" defaultValue={roundHandicaps.rank1} className="input input-bordered w-full h-12 bg-white border-gray-200 focus:bg-white transition-all text-sm font-bold" placeholder="-20" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">2위 차감 점수</label>
                                        <input name="minusHandicapRank2" type="number" defaultValue={roundHandicaps.rank2} className="input input-bordered w-full h-12 bg-white border-gray-200 focus:bg-white transition-all text-sm font-bold" placeholder="-15" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">3위 차감 점수</label>
                                        <input name="minusHandicapRank3" type="number" defaultValue={roundHandicaps.rank3} className="input input-bordered w-full h-12 bg-white border-gray-200 focus:bg-white transition-all text-sm font-bold" placeholder="-10" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">여자챔프 차감</label>
                                        <input name="minusHandicapFemale" type="number" defaultValue={roundHandicaps.female} className="input input-bordered w-full h-12 bg-white border-gray-200 focus:bg-white transition-all text-sm font-bold" placeholder="-10" />
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
            <button type="submit" disabled={loading} className="btn btn-primary w-full py-3 font-bold text-lg shadow-md hover:shadow-lg transition-all">
                설정 저장
            </button>

            <div className="pt-6 border-t mt-6">
                <Link
                    href={`/centers/${round.tournament.centerId}/tournaments/${round.tournamentId}`}
                    className="btn bg-white border-2 border-primary text-primary w-full py-3 font-black text-lg shadow hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                >
                    🏆 챔프전 설정(대회 상세)으로 이동
                </Link>
                <p className="text-center text-xs text-gray-500 mt-2">대회 명칭, 소개, 규칙 등 전체 설정을 변경하려면 위 버튼을 누르세요.</p>
            </div>
        </form >
    );
}


// 3. Lanes Tab
function RoundLanesTab({ round, onUpdate, isManager }: { round: any, onUpdate: () => void, isManager?: boolean }) {
    const [loading, setLoading] = useState(false);
    const [startLane, setStartLane] = useState(round.startLane || 1);
    const [endLane, setEndLane] = useState(round.endLane || 10);

    // Parse existing config or default to empty
    const [laneConfig, setLaneConfig] = useState<Record<string, number[]>>(() => {
        try {
            try {
                try {
                    return round.laneConfig ? JSON.parse(round.laneConfig) : {};
                } catch (e) {
                    console.error("Failed to parse laneConfig", e);
                    return {};
                }
            } catch (e) {
                console.error("Failed to parse laneConfig", e);
                return {};
            }
        } catch {
            return {};
        }
    });

    // Helper to check if a slot is active
    const isSlotActive = (lane: number, slot: number) => {
        const laneKey = lane.toString();
        // Check string key, number key, and default
        const activeSlots = laneConfig[laneKey] || (laneConfig as any)[lane] || [1, 2, 3];
        // Check if slot is in array (handles both string and number items)
        return activeSlots.some((s: any) => s.toString() === slot.toString());
    };

    // Toggle slot
    const toggleSlot = (lane: number, slot: number) => {
        const laneKey = lane.toString();
        setLaneConfig(prev => {
            const currentSlots = prev[laneKey] || (prev as any)[lane] || [1, 2, 3];
            // Normalize to numbers for predictable state
            const numericSlots = currentSlots.map((s: any) => parseInt(s.toString()));
            const newSlots = numericSlots.includes(slot)
                ? numericSlots.filter((s: number) => s !== slot)
                : [...numericSlots, slot].sort((a: number, b: number) => a - b);
            return { ...prev, [laneKey]: newSlots };
        });
    };

    // Sync with server data
    useEffect(() => {
        try {
            if (round.laneConfig) {
                setLaneConfig(JSON.parse(round.laneConfig));
            }
        } catch (e) {
            console.error("Failed to parse laneConfig in useEffect", e);
        }
    }, [round.laneConfig]);

    const setAllDefault = () => {
        const newConfig: Record<string, number[]> = {};
        for (let i = parseInt(startLane); i <= parseInt(endLane); i++) {
            newConfig[i.toString()] = [1, 2, 3];
        }
        setLaneConfig(newConfig);
    };

    const setAllSelect = () => {
        const newConfig: Record<string, number[]> = {};
        for (let i = parseInt(startLane); i <= parseInt(endLane); i++) {
            newConfig[i.toString()] = [1, 2, 3, 4, 5, 6];
        }
        setLaneConfig(newConfig);
    };

    const setAllDeselect = () => {
        const newConfig: Record<string, number[]> = {};
        for (let i = parseInt(startLane); i <= parseInt(endLane); i++) {
            newConfig[i.toString()] = [];
        }
        setLaneConfig(newConfig);
    };

    async function handleLaneSettings() {
        setLoading(true);
        try {
            // 0. Validation: Capacity must match participant count and be explicitly saved
            const cleanConfig: Record<string, number[]> = {};
            for (let i = parseInt(startLane); i <= parseInt(endLane); i++) {
                const laneKey = i.toString();
                // Ensure we save the effective config (including defaults)
                cleanConfig[laneKey] = laneConfig[laneKey] ?? [1, 2, 3];
            }
            const totalSlots = Object.values(cleanConfig).reduce((sum, slots) => sum + slots.length, 0);
            const participantCount = round.participants.length;

            if (totalSlots !== participantCount) {
                alert(`설정된 총 레인 슬롯 수(${totalSlots})와 참가자 수(${participantCount})가 일치해야 합니다.\n\n현재 설정: ${totalSlots}개\n필요 인원: ${participantCount}명`);
                setLoading(false);
                return;
            }

            // 1. Save Range
            await updateLaneSettings(round.id, parseInt(startLane), parseInt(endLane));

            // 2. Save Config
            await updateLaneConfig(round.id, JSON.stringify(cleanConfig));

            alert('레인 설정이 저장되었습니다.');
            onUpdate();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleAutoAssign() {
        if (!confirm('현재 참가자들을 대상으로 레인을 랜덤 추첨하시겠습니까?\n기존 배정 내역은 덮어씌워집니다.')) return;

        setLoading(true);
        try {
            const res = await autoAssignRemaining(round.id);
            alert(res.message || '완료되었습니다.');
            onUpdate();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    }

    // Generate array of lanes to display in grid
    const lanes = [];
    for (let i = parseInt(startLane); i <= parseInt(endLane); i++) {
        lanes.push(i);
    }

    // Group participants by lane for the results view
    const laneMap: Record<number, any[]> = {};
    round.participants.forEach((p: any) => {
        if (p.lane) {
            const laneNum = Math.floor(p.lane / 10);
            if (!laneMap[laneNum]) laneMap[laneNum] = [];
            laneMap[laneNum].push(p);
        }
    });
    // Sort slots within each lane
    Object.keys(laneMap).forEach(key => {
        laneMap[Number(key)].sort((a, b) => (a.lane % 10) - (b.lane % 10));
    });
    const unassigned = round.participants.filter((p: any) => !p.lane);

    return (
        <div className="space-y-8">
            {/* 1. Lane Configuration Section - Admin Only */}
            {isManager && (
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-sm">Step 1</span>
                        레인 운영 설정
                    </h3>

                    <div className="flex flex-wrap items-end gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">시작 레인</label>
                            <input
                                type="number"
                                value={startLane}
                                onChange={(e) => setStartLane(e.target.value)}
                                className="input w-24 border-2 focus:border-blue-500 font-bold"
                            />
                        </div>
                        <span className="text-gray-400 font-bold pb-3">~</span>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">종료 레인</label>
                            <input
                                type="number"
                                value={endLane}
                                onChange={(e) => setEndLane(e.target.value)}
                                className="input w-24 border-2 focus:border-blue-500 font-bold"
                            />
                        </div>
                        <button
                            onClick={handleLaneSettings}
                            disabled={loading}
                            className="btn btn-primary font-bold shadow-md px-6"
                        >
                            설정 저장
                        </button>

                        <div className="ml-auto flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={setAllSelect}
                                className="btn bg-green-50 text-green-600 border border-green-200 font-bold hover:bg-green-100 text-[11px]"
                            >
                                ✅ 모두 선택 (1~6번)
                            </button>
                            <button
                                type="button"
                                onClick={setAllDefault}
                                className="btn bg-blue-50 text-blue-600 border border-blue-200 font-bold hover:bg-blue-100 text-[11px]"
                            >
                                🔄 기본 선택 (1~3번)
                            </button>
                            <button
                                type="button"
                                onClick={setAllDeselect}
                                className="btn bg-red-50 text-red-600 border border-red-200 font-bold hover:bg-red-100 text-[11px]"
                            >
                                ❌ 모두 해제
                            </button>
                            <button
                                onClick={handleAutoAssign}
                                disabled={loading || round.participants.length === 0}
                                className="btn bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 shadow-sm text-[11px]"
                            >
                                🎲 랜덤 일괄 배정
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                        <div className="flex justify-end items-center mb-4">
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">총 설정 슬롯: {Object.values(laneConfig).reduce((s, a) => s + a.length, 0)}개</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {lanes.map(lane => (
                                <div key={lane} className="flex items-center gap-3 bg-white p-2 px-3 rounded-lg border border-gray-100 shadow-sm hover:border-blue-300 transition-all group">
                                    <span className="font-black text-gray-800 text-sm min-w-[55px] group-hover:text-blue-600">{lane} 레인</span>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5, 6].map(slot => {
                                            const active = isSlotActive(lane, slot);
                                            return (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        toggleSlot(lane, slot);
                                                    }}
                                                    className={`w-10 h-10 rounded-lg text-sm font-black transition-all border-2 flex items-center justify-center relative shadow-md ${active
                                                        ? 'ring-2 ring-blue-400 z-10'
                                                        : 'opacity-60'
                                                        }`}
                                                    style={{
                                                        backgroundColor: active ? '#2563eb' : '#f3f4f6', // blue-600 vs gray-100
                                                        color: active ? '#ffffff' : '#9ca3af', // white vs gray-400
                                                        borderColor: active ? '#1e3a8a' : '#e5e7eb', // blue-900 vs gray-200
                                                    }}
                                                >
                                                    {active && (
                                                        <div className="absolute -top-1 -right-1 bg-yellow-400 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-lg animate-bounce">
                                                            <span className="text-[10px] text-blue-900 font-bold">✓</span>
                                                        </div>
                                                    )}
                                                    {slot}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Assignment Results View */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        {isManager && <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-sm">Step 2</span>}
                        배정 결과 확인
                    </h3>
                </div>

                {round.participants.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                        참가자가 없습니다. 참가자 탭에서 인원을 등록해주세요.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {lanes.map(lane => {
                            const ps = laneMap[lane] || [];
                            return (
                                <div key={lane} className="flex items-stretch border rounded-xl overflow-hidden bg-white shadow-sm hover:border-blue-300 transition-all">
                                    <div className={`w-20 flex flex-col items-center justify-center py-2 ${ps.length > 0 ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        <span className="text-[10px] font-bold opacity-60">LANE</span>
                                        <span className="text-xl font-black">{lane}</span>
                                    </div>
                                    <div className="flex-1 flex flex-wrap items-center p-3 gap-y-2 gap-x-6">
                                        {ps.length > 0 ? ps.map((p: any) => (
                                            <div key={p.id} className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-[10px] border border-blue-200">
                                                    {p.lane % 10}
                                                </div>
                                                <span className="font-bold text-sm text-gray-800">
                                                    {p.registration.user?.name || p.registration.guestName}
                                                    {(p.registration.guestTeamName || p.registration.team?.name) && (
                                                        <span className="ml-1 text-[10px] text-gray-400 font-medium">
                                                            ({p.registration.guestTeamName || p.registration.team?.name})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        )) : (
                                            <span className="text-gray-300 text-xs italic">배정된 선수가 없습니다.</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {unassigned.length > 0 && (
                            <div className="mt-6 border-t pt-6">
                                <h4 className="font-bold text-sm text-red-500 mb-3 flex items-center gap-2">
                                    ⚠️ 미배정 참가자 ({unassigned.length})
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {unassigned.map((p: any) => (
                                        <div key={p.id} className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-bold text-gray-500 border border-gray-200">
                                            {p.registration.guestTeamName ? `[${p.registration.guestTeamName}] ` : (p.registration.team ? `[${p.registration.team.name}] ` : '')}
                                            {p.registration.user ? p.registration.user.name : p.registration.guestName}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}


// 4. Scoring Tab
function RoundScoringTab({ round, onUpdate }: { round: any, onUpdate: () => void }) {
    const settings = (() => {
        try {
            return round.tournament?.settings ? JSON.parse(round.tournament.settings) : {};
        } catch (e) {
            console.error("Failed to parse settings", e);
            return {};
        }
    })();
    const gameCount = settings.gameCount || 3;

    const [loading, setLoading] = useState(false);

    // Initialize scores state
    const [scoreMap, setScoreMap] = useState<Record<string, { [key: number]: string }>>(() => {
        const initial: Record<string, { [key: number]: string }> = {};
        round.participants.forEach((p: any) => {
            initial[p.registrationId] = {};
            const pScores = round.individualScores.filter((s: any) => s.registrationId === p.registrationId);
            for (let g = 1; g <= gameCount; g++) {
                initial[p.registrationId][g] = pScores.find((s: any) => s.gameNumber === g)?.score.toString() || '';
            }
        });
        return initial;
    });

    const [femaleChampIds, setFemaleChampIds] = useState<string[]>(() =>
        round.participants.filter((p: any) => p.isFemaleChamp).map((p: any) => p.id)
    );

    // Initialize side game participation state


    const handleScoreChange = (regId: string, game: number, val: string) => {
        setScoreMap(prev => ({
            ...prev,
            [regId]: {
                ...prev[regId],
                [game]: val
            }
        }));
    };

    const handleExcelData = (rawApiData: any[]) => {
        if (!Array.isArray(rawApiData)) {
            console.error("rawApiData is not an array:", rawApiData);
            return;
        }
        let matchCount = 0;
        const newScoreMap = { ...scoreMap };

        // Constants for lane movement
        const moveType = round.moveLaneType;
        const moveCount = (round.moveLaneCount || 0);
        const offset = moveCount * 2;
        const firstLane = round.startLane || 1;
        const lastLane = round.endLane || 20;
        const totalLanes = (lastLane - firstLane) + 1;

        const calculateNextLane = (curr: number) => {
            let next = curr;
            if (moveType === 'RIGHT') {
                next = curr + offset;
                if (next > lastLane) next = next - totalLanes;
            } else if (moveType === 'LEFT') {
                next = curr - offset;
                if (next < firstLane) next = next + totalLanes;
            } else if (moveType === 'CROSS') {
                if (curr % 2 === 0) { // Even
                    next = curr + offset;
                    if (next > lastLane) next = next - totalLanes;
                } else { // Odd
                    next = curr - offset;
                    if (next < firstLane) next = next + totalLanes;
                }
            }
            return next;
        };

        // For each participant, match scores based on Lane & Slot
        round.participants.forEach((p: any) => {
            if (!p.lane) return;
            const startLane = Math.floor(p.lane / 10);
            const slot = p.lane % 10;

            let currentLane = startLane;
            const participantScores: (string | null)[] = new Array(gameCount).fill(null);

            for (let g = 1; g <= gameCount; g++) {
                if (g > 1) currentLane = calculateNextLane(currentLane);

                // Find score from AI data matching (currentLane, slot)
                const matched = rawApiData.find(r => {
                    const rLane = typeof r.lane === 'number' ? r.lane : parseInt(String(r.lane).replace(/[^0-9]/g, ''));
                    return rLane === currentLane && (parseInt(String(r.slot)) === slot);
                });

                if (matched && matched.games) {
                    if (matched.games[g - 1] !== undefined && matched.games[g - 1] !== null) {
                        participantScores[g - 1] = matched.games[g - 1].toString();
                    }
                }
            }

            if (participantScores.some(s => s !== null)) {
                if (!newScoreMap[p.registrationId]) newScoreMap[p.registrationId] = {};
                participantScores.forEach((s, i) => {
                    if (s !== null) newScoreMap[p.registrationId][i + 1] = s;
                });
                matchCount++;
            }
        });

        setScoreMap(newScoreMap);
        alert(`${matchCount}명의 점수가 레인/순번 기준으로 매칭되어 입력되었습니다.`);
    };

    async function handleSubmit() {
        setLoading(true);
        try {
            const updates: { regId: string, game: number, score: number }[] = [];

            round.participants.forEach((p: any) => {
                const scores = scoreMap[p.registrationId] || {};

                for (let g = 1; g <= gameCount; g++) {
                    const score = parseInt(scores[g] || '0');
                    updates.push({ regId: p.registrationId, game: g, score });
                }
            });

            await updateRoundScores(round.id, updates);

            if (round.hasFemaleChamp) {
                await updateFemaleChampParticipants(round.id, femaleChampIds);
            }

            alert('점수가 저장되었습니다.');
            onUpdate();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    }

    if (round.participants.length === 0) {
        return <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg">참가자를 먼저 선택해주세요.</div>;
    }

    // Grouping & Sorting logic
    const gameMode = round.tournament?.settings ? JSON.parse(round.tournament.settings).gameMode : 'INDIVIDUAL';
    const isTeamEvent = gameMode && gameMode.startsWith('TEAM_');

    // Sort participants first (by lane)
    const sortedParticipants = [...round.participants].sort((a, b) => {
        if (a.lane && b.lane) return a.lane - b.lane;
        if (a.lane) return -1;
        if (b.lane) return 1;
        const nameA = a.registration.user?.name || a.registration.guestName || '';
        const nameB = b.registration.user?.name || b.registration.guestName || '';
        return nameA.localeCompare(nameB);
    });

    return (
        <div className="space-y-4">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-col gap-1 flex-1 w-full">
                        <SmartExcelScoreUpload onDataParsed={handleExcelData} gameCount={gameCount} />
                        <div className="mt-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50">
                            <p className="text-xs font-bold text-blue-600 flex items-center gap-1.5 ml-1">
                                <span className="text-base">✨</span> 스마트 AI 분석 가이드
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                엑셀의 <strong>레인 번호</strong>를 AI가 인식하여, 해당 레인에 배정된 선수에게 점수를 매칭합니다. <br />
                                레이아웃이 바뀌거나 레인 이동이 있어도 엑셀에 기록된 레인 번호 기준으로 정확히 찾아냅니다.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 shrink-0">
                        <button
                            onClick={() => handleSubmit()}
                            disabled={loading}
                            className="btn btn-primary h-14 px-8 font-black text-lg shadow-[0_4px_20px_rgba(37,99,235,0.2)] hover:shadow-none hover:translate-y-0.5 transition-all flex items-center gap-2 border-2 border-blue-700"
                        >
                            {loading ? <span className="loading loading-spinner loading-sm"></span> : '💾'}
                            점수 전체 저장
                        </button>
                    </div>
                </div>
            </div>

            <form className="overflow-x-auto">
                <table className="w-full text-sm border-collapse bg-white shadow-md rounded-xl overflow-hidden border border-gray-200" style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr className="bg-gray-100 text-gray-600 uppercase text-[11px] font-bold tracking-tight">
                            <th className="py-3 px-2 border-b text-center" style={{ width: '60px', whiteSpace: 'nowrap' }}>레인</th>
                            <th className="py-3 px-2 border-b text-center" style={{ width: '90px', whiteSpace: 'nowrap' }}>팀</th>
                            <th className="py-3 px-2 border-b text-center" style={{ width: '130px', whiteSpace: 'nowrap' }}>이름</th>
                            <th className="py-3 px-1 border-b text-center" style={{ width: 'auto', whiteSpace: 'nowrap' }}>
                                점수(1-{gameCount}G)
                            </th>
                            <th className="py-3 px-2 border-b text-center" style={{ width: '60px', whiteSpace: 'nowrap' }}>핸디</th>
                            <th className="py-3 px-2 border-b text-center" style={{ width: '80px', whiteSpace: 'nowrap' }}>총점</th>
                            {round.hasFemaleChamp && (
                                <th className="py-3 px-2 border-b text-center text-pink-600" style={{ width: '60px', whiteSpace: 'nowrap' }}>여챔</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedParticipants.map((p: any) => {
                            const currentScores = scoreMap[p.registrationId] || {};
                            let totalScore = 0;
                            let gamesPlayed = 0;

                            for (let g = 1; g <= gameCount; g++) {
                                const val = parseInt(currentScores[g] || '0');
                                if (val > 0) {
                                    totalScore += val;
                                    gamesPlayed++;
                                }
                            }

                            const handicap = p.registration.handicap || 0;
                            const totalWithHandicap = totalScore + (handicap * gamesPlayed);

                            // Optimized widths for 1-5 games
                            const pxWidth = gameCount === 5 ? 85 : 100;
                            const fontSize = '18px';

                            // Grouping logic for background
                            const groupId = p.registration.entryGroupId;
                            const prevGroupId = sortedParticipants[sortedParticipants.indexOf(p) - 1]?.registration.entryGroupId;
                            const isFirstInGroup = groupId && groupId !== prevGroupId;

                            // Alternate background color per group if it's a team event
                            const groupIndex = groupId ? Array.from(new Set(sortedParticipants.map(sp => sp.registration.entryGroupId))).indexOf(groupId) : -1;
                            const groupBg = isTeamEvent && groupId
                                ? (groupIndex % 2 === 0 ? 'bg-blue-50/20' : 'bg-indigo-50/20')
                                : '';

                            return (
                                <tr key={p.id} className={`hover:bg-blue-50/50 transition-colors ${groupBg} ${isFirstInGroup ? 'border-t-2 border-slate-300' : ''}`}>
                                    <td className="p-2 text-center font-mono font-bold text-blue-600 bg-gray-50/30" style={{ width: '60px', whiteSpace: 'nowrap' }}>
                                        {formatLane(p.lane, p.isManual)}
                                    </td>
                                    <td className="p-2 text-center text-gray-600 truncate" style={{ width: '90px', whiteSpace: 'nowrap' }}>
                                        {p.registration.guestTeamName || p.registration.team?.name || '-'}
                                    </td>
                                    <td className="p-2 text-center font-bold text-gray-800 truncate" style={{ width: '130px', whiteSpace: 'nowrap' }}>
                                        {p.registration.user?.name || p.registration.guestName}
                                    </td>
                                    <td className="p-2 text-center">
                                        <div className="flex justify-center">
                                            <div className="flex items-center -space-x-px">
                                                {Array.from({ length: gameCount }, (_, i) => i + 1).map(g => (
                                                    <div key={g} className="relative group/input">
                                                        <input
                                                            type="number"
                                                            value={currentScores[g] || ''}
                                                            onChange={(e) => handleScoreChange(p.registrationId, g, e.target.value)}
                                                            className="h-11 text-center font-black bg-white text-gray-900 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 z-0 focus:z-10 p-0 transition-all shadow-inner"
                                                            style={{
                                                                width: `${pxWidth}px`,
                                                                fontSize: fontSize,
                                                                borderLeftWidth: g === 1 ? '1px' : '0px',
                                                                borderTopLeftRadius: g === 1 ? '6px' : '0px',
                                                                borderBottomLeftRadius: g === 1 ? '6px' : '0px',
                                                                borderTopRightRadius: g === gameCount ? '6px' : '0px',
                                                                borderBottomRightRadius: g === gameCount ? '6px' : '0px',
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-2 text-center text-xs text-gray-500" style={{ width: '60px' }}>
                                        {handicap > 0 ? `+${handicap}` : '-'}
                                    </td>
                                    <td className="p-2 text-center font-black text-lg text-blue-700" style={{ width: '80px' }}>
                                        {totalWithHandicap > 0 ? totalWithHandicap : '-'}
                                    </td>
                                    {round.hasFemaleChamp && (
                                        <td className="p-2 text-center" style={{ width: '60px' }}>
                                            <input
                                                type="checkbox"
                                                checked={femaleChampIds.includes(p.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setFemaleChampIds(prev => [...prev, p.id]);
                                                    } else {
                                                        setFemaleChampIds(prev => prev.filter(id => id !== p.id));
                                                    }
                                                }}
                                                className="checkbox checkbox-xs checkbox-secondary"
                                            />
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </form>
        </div>
    );
}


// 5. Side Game Tab
function RoundSideGameTab({ round }: { round: any }) {
    const settings = round.tournament?.settings ? JSON.parse(round.tournament.settings) : {};
    const gameCount = settings.gameCount || 3;
    const participants = round.participants;
    const scores = round.individualScores;

    const getRankings = (filterFn: (p: any) => boolean, gameNum: number) => {
        const pool = participants.filter(filterFn).map((p: any) => {
            const pScore = scores.find((s: any) => s.registrationId === p.registrationId && s.gameNumber === gameNum)?.score || 0;
            const handicap = p.registration.handicap || 0;
            return {
                id: p.registrationId,
                name: p.registration.user?.name || p.registration.guestName,
                team: p.registration.guestTeamName || p.registration.team?.name || '-',
                score: pScore,
                handicap: handicap,
                total: pScore > 0 ? pScore + handicap : 0
            };
        }).filter((r: any) => r.total > 0);

        // Sort: Total DESC, then Handicap ASC (lower handicap wins tie)
        return pool.sort((a: any, b: any) => {
            if (b.total !== a.total) return b.total - a.total;
            return a.handicap - b.handicap;
        }).slice(0, 10);
    };

    const sideGames = [
        { title: '🎯 기본 사이드', filter: (p: any) => p.sideBasic, color: 'blue', headerClass: 'bg-blue-600', subHeaderClass: 'bg-blue-50 text-blue-700' },
        { title: '⚽ 볼 사이드', filter: (p: any) => p.sideBall, color: 'indigo', headerClass: 'bg-indigo-600', subHeaderClass: 'bg-indigo-50 text-indigo-700' },
        { title: '🎁 번외 사이드', filter: (p: any) => p.sideExtra, color: 'amber', headerClass: 'bg-amber-600', subHeaderClass: 'bg-amber-50 text-amber-700' },
    ];

    return (
        <div className="space-y-12 pb-20">
            {sideGames.map((game, gIdx) => (
                <div key={gIdx} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className={`${game.headerClass} p-4`}>
                        <h3 className="text-white font-black text-xl flex items-center gap-2">
                            {game.title}
                            <span className="text-sm font-normal opacity-80">(각 게임별 TOP 10)</span>
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-gray-100">
                        {Array.from({ length: gameCount }, (_, i) => i + 1).map(gNum => {
                            const rankings = getRankings(game.filter, gNum);
                            return (
                                <div key={gNum} className="p-4">
                                    <h4 className={`text-center font-black text-lg mb-4 py-2 ${game.subHeaderClass} rounded-lg`}>
                                        {gNum}게임 순위
                                    </h4>
                                    <div className="space-y-2">
                                        {rankings.length > 0 ? (
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-gray-400 border-b">
                                                        <th className="pb-2 font-medium w-8">순위</th>
                                                        <th className="pb-2 text-left px-2 font-medium">이름(팀)</th>
                                                        <th className="pb-2 text-right font-medium">총점</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {rankings.map((r: any, idx: number) => {
                                                        const isTie = idx > 0 && r.total === rankings[idx - 1].total && r.handicap === rankings[idx - 1].handicap;
                                                        // Simplified tie-display: just show same rank number if logic dictates
                                                        let displayRank = idx + 1;
                                                        if (isTie) {
                                                            // Find first occurrence of this score+handicap combo
                                                            const firstIdx = rankings.findIndex((x: any) => x.total === r.total && x.handicap === r.handicap);
                                                            displayRank = firstIdx + 1;
                                                        }

                                                        return (
                                                            <tr key={r.id} className="hover:bg-gray-50">
                                                                <td className="py-2 text-center">
                                                                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold
                                                                        ${displayRank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                                            displayRank === 2 ? 'bg-slate-100 text-slate-700' :
                                                                                displayRank === 3 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'}`}>
                                                                        {displayRank}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 px-2">
                                                                    <div className="font-black text-gray-800">{r.name}</div>
                                                                    <div className="text-[10px] text-gray-400 truncate w-24">{r.team}</div>
                                                                </td>
                                                                <td className="py-2 text-right">
                                                                    <div className="font-black text-gray-900">{r.total}</div>
                                                                    <div className="text-[10px] text-gray-400">({r.score}+{r.handicap})</div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="py-10 text-center text-gray-300 text-xs italic">데이터 없음</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

// 6. Final Result Tab
function RoundFinalResultsTab({ round, isManager }: { round: any, isManager: boolean }) {
    if (round.tournament?.type === 'LEAGUE') {
        let settings: any = {};
        try {
            if (round.tournament?.settings) settings = JSON.parse(round.tournament.settings);
        } catch (e) { }
        return (
            <RoundResultSummary
                round={round}
                tournamentName={round.tournament.name}
                teamHandicapLimit={settings.teamHandicapLimit}
            />
        );
    }
    const settings = round.tournament?.settings ? JSON.parse(round.tournament.settings) : {};
    const gameCount = settings.gameCount || 3;

    // 1. Prepare and Sort Data
    const gameMode = round.tournament?.settings ? JSON.parse(round.tournament.settings).gameMode : 'INDIVIDUAL';
    const isTeamEvent = gameMode && gameMode.startsWith('TEAM_');

    let results = [];

    if (isTeamEvent) {
        // Aggregate by entryGroupId
        const groups: Record<string, any> = {};
        round.participants.forEach((p: any) => {
            const groupId = p.registration.entryGroupId || p.id; // Fallback to p.id if no group
            if (!groups[groupId]) {
                groups[groupId] = {
                    id: groupId,
                    members: [],
                    totalRaw: 0,
                    totalHandicap: 0,
                    gameScores: new Array(gameCount).fill(0),
                    teamName: p.registration.guestTeamName || p.registration.team?.name || '팀'
                };
            }
            const pScores = round.individualScores.filter((s: any) => s.registrationId === p.registrationId);
            let pTotalRaw = 0;
            let pGamesPlayed = 0;
            for (let g = 1; g <= gameCount; g++) {
                const s = pScores.find((sc: any) => sc.gameNumber === g)?.score || 0;
                groups[groupId].gameScores[g - 1] += s;
                pTotalRaw += s;
                if (s > 0) pGamesPlayed++;
            }
            const handicap = p.registration.handicap || 0;
            groups[groupId].totalRaw += pTotalRaw;
            groups[groupId].totalHandicap += (handicap * pGamesPlayed);
            groups[groupId].members.push(p.registration.user?.name || p.registration.guestName || 'Unknown');
        });

        results = Object.values(groups).map((g: any) => ({
            id: g.id,
            name: g.members.join(', '),
            team: g.teamName,
            scores: g.gameScores,
            total: g.totalRaw + g.totalHandicap,
            isTeam: true
        }));
    } else {
        const prevWinners = round.prevRoundWinners || {};
        const roundHandicaps = settings.roundMinusHandicaps?.[round.roundNumber] || {
            rank1: settings.minusHandicapRank1 || 0,
            rank2: settings.minusHandicapRank2 || 0,
            rank3: settings.minusHandicapRank3 || 0,
            female: settings.minusHandicapFemale || 0
        };
        const mRank1 = roundHandicaps.rank1;
        const mRank2 = roundHandicaps.rank2;
        const mRank3 = roundHandicaps.rank3;
        const mRankFemale = roundHandicaps.female;

        results = round.participants.map((p: any) => {
            const pScores = round.individualScores.filter((s: any) => s.registrationId === p.registrationId);

            const scores: number[] = [];
            let totalRaw = 0;
            let gamesPlayed = 0;

            for (let g = 1; g <= gameCount; g++) {
                const sRecord = pScores.find((s: any) => s.gameNumber === g);
                const score = sRecord?.score || 0;
                scores.push(score);
                totalRaw += score;
                if (sRecord) gamesPlayed++;
            }

            const handicap = p.registration.handicap || 0;
            let totalHandicap = handicap * gamesPlayed;

            // Apply minus handicaps if applicable (only if all games are played or it's finalized)
            // User requested: "마지막게임까지 진행하고 나면 그때 총점에 -20 하면돼"
            const pName = p.registration.user?.name || p.registration.guestName || 'Unknown';
            const pTeam = p.registration.guestTeamName || p.registration.team?.name || '개인회원';

            // Apply minus handicaps if applicable (only if all games are played or it's finalized)
            // User requested: "마지막게임까지 진행하고 나면 그때 총점에 -20 하면돼"
            let minusApplied = 0;
            if (gamesPlayed === gameCount) {
                const matchWinner = (winner: any) => winner && winner.name === pName && winner.team === pTeam;

                if (matchWinner(prevWinners.rank1)) minusApplied += Math.abs(mRank1);
                else if (matchWinner(prevWinners.rank2)) minusApplied += Math.abs(mRank2);
                else if (matchWinner(prevWinners.rank3)) minusApplied += Math.abs(mRank3);

                if (matchWinner(prevWinners.femaleChamp)) minusApplied += Math.abs(mRankFemale);
            }

            const validScores = scores.filter(s => s > 0);
            const hiLow = validScores.length > 1 ? (Math.max(...validScores) - Math.min(...validScores)) : 0;

            const finalHandicapValue = totalHandicap - minusApplied;
            const total = totalRaw + finalHandicapValue;

            return {
                id: p.registrationId,
                name: pName,
                team: pTeam,
                scores: scores,
                handicapEach: handicap,
                totalHandicap: finalHandicapValue, // Display adjusted handicap
                total,
                hiLow,
                hasMinusHandicap: minusApplied > 0
            };
        });
    }

    const sortedResults = results.map((r: any) => {
        const participant = round.participants.find((p: any) => p.registrationId === r.id);
        return { ...r, isFemaleChamp: participant?.isFemaleChamp || false };
    }).sort((a: any, b: any) => {
        if (b.total !== a.total) return b.total - a.total;
        // Tie-breaker 1: Lower Handicap priority
        const handicapA = a.handicapEach || 0;
        const handicapB = b.handicapEach || 0;
        if (handicapA !== handicapB) return handicapA - handicapB;
        // Tie-breaker 2: Lower Hi-Low priority
        const hiLowA = a.hiLow || 0;
        const hiLowB = b.hiLow || 0;
        return hiLowA - hiLowB;
    });

    const handleExcelDownload = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('최종결과');

        // 1. Add Title
        const titleRowValue = `${round.tournament.name} ${round.roundNumber}회차 결과`;
        const titleRow = worksheet.addRow([titleRowValue]);
        titleRow.font = { size: 16, bold: true };

        const lastColNum = 5 + gameCount; // Rank(1), Team(2), Name(3), G1...GN(gameCount), Handy(1), Total(1)
        worksheet.mergeCells(1, 1, 1, lastColNum);
        titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // Header background for Title
        titleRow.getCell(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF00' }
        };
        titleRow.getCell(1).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        worksheet.addRow([]); // Spacer

        // 2. Add Headers
        const headerRowValues = ['순위', '팀', '성함'];
        for (let i = 1; i <= gameCount; i++) headerRowValues.push(`${i}G`);
        headerRowValues.push('핸디', 'H-L', '총점');

        const headerRow = worksheet.addRow(headerRowValues);

        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'E7E9EB' }
            };
            cell.font = { bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // 3. Add Data Rows
        sortedResults.forEach((res: any, index: number) => {
            const rank = index + 1;
            const isFemaleChamp = res.isFemaleChamp;

            const rowData: any[] = [rank, res.team, res.name];
            res.scores.forEach((s: number) => {
                rowData.push(s > 0 ? (s + res.handicapEach) : '');
            });
            rowData.push(res.totalHandicap);
            rowData.push(res.hiLow || 0);
            rowData.push(res.total);

            const row = worksheet.addRow(rowData);

            row.eachCell((cell, colNumber) => {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                // Total Column Highlight
                if ((rank <= 3 || isFemaleChamp) && colNumber === lastColNum) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFF00' }
                    };
                }

                // Row Highlight
                if ((rank <= 3 || isFemaleChamp) && colNumber > 1) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFF00' }
                    };
                }
            });
        });

        // 4. Set Column Widths
        worksheet.getColumn(1).width = 8;
        worksheet.getColumn(2).width = 15;
        worksheet.getColumn(3).width = 15;
        for (let i = 0; i < gameCount; i++) {
            worksheet.getColumn(4 + i).width = 8;
        }
        worksheet.getColumn(4 + gameCount).width = 10;
        worksheet.getColumn(5 + gameCount).width = 8; // H-L column
        worksheet.getColumn(6 + gameCount).width = 12; // Total column

        // 5. Generate and Save
        const buffer = await workbook.xlsx.writeBuffer();
        const data = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(data, `${round.tournament.name}_${round.roundNumber}회차_최종결과.xlsx`);
    };

    // Precise split logic matching screenshot (27 rows per side)
    const leftColumn = sortedResults.slice(0, 27);
    const rightColumn = sortedResults.slice(27, 54);

    const TableComponent = ({ data, startRank, isRight }: { data: any[], startRank: number, isRight?: boolean }) => (
        <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid black',
            fontSize: '11px',
            color: 'black',
            backgroundColor: 'white',
            borderLeft: isRight ? 'none' : '1px solid black',
            tableLayout: 'fixed'
        }}>
            <thead>
                <tr style={{ backgroundColor: '#E7E9EB', height: '32px' }}>
                    <th style={{ border: '1px solid black', padding: '4px', width: '35px' }}>순위</th>
                    <th style={{ border: '1px solid black', padding: '4px' }}>팀</th>
                    <th style={{ border: '1px solid black', padding: '4px', width: '100px' }}>성함</th>
                    {Array.from({ length: gameCount }).map((_, i) => (
                        <th key={i} style={{ border: '1px solid black', padding: '4px', width: '50px' }}>{i + 1}G</th>
                    ))}
                    <th style={{ border: '1px solid black', padding: '4px', width: '50px' }}>핸디</th>
                    <th style={{ border: '1px solid black', padding: '4px', width: '40px' }}>H-L</th>
                    <th style={{ border: '1px solid black', padding: '4px', width: '60px' }}>총점</th>
                </tr>
            </thead>
            <tbody>
                {Array.from({ length: 27 }).map((_, idx) => {
                    const res = data[idx];
                    const rank = startRank + idx;
                    const isTop3 = rank <= 3;
                    const isFemaleChamp = res?.isFemaleChamp || false;
                    const shouldHighlight = isTop3 || isFemaleChamp;

                    if (!res) {
                        return (
                            <tr key={`empty-${rank}`} style={{ height: '26px' }}>
                                <td style={{ border: '1px solid black', textAlign: 'center' }}>&nbsp;{rank}</td>
                                <td style={{ border: '1px solid black' }}>&nbsp;</td>
                                <td style={{ border: '1px solid black' }}>&nbsp;</td>
                                {Array.from({ length: gameCount }).map((_, i) => (
                                    <td key={i} style={{ border: '1px solid black' }}>&nbsp;</td>
                                ))}
                                <td style={{ border: '1px solid black' }}>&nbsp;</td>
                                <td style={{ border: '1px solid black' }}>&nbsp;</td>
                                <td style={{ border: '1px solid black' }}>&nbsp;</td>
                            </tr>
                        );
                    }

                    return (
                        <tr key={res.id} style={{ height: '26px', backgroundColor: shouldHighlight ? '#FFFF00' : 'white' }}>
                            <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: 'bold', backgroundColor: 'white' }}>{rank}</td>
                            <td style={{ border: '1px solid black', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', padding: '0 2px', maxWidth: '80px', textOverflow: 'ellipsis' }}>{res.team}</td>
                            <td style={{
                                border: '1px solid black',
                                textAlign: 'center',
                                fontWeight: 'bold',
                                padding: '0 4px'
                            }}>
                                {res.name}
                                {isFemaleChamp && <span style={{ color: '#E91E63', fontSize: '9px', marginLeft: '2px' }}>(여챔)</span>}
                            </td>
                            {res.scores.map((s: number, i: number) => (
                                <td key={i} style={{ border: '1px solid black', textAlign: 'center' }}>
                                    {s > 0 ? s + res.handicapEach : ''}
                                </td>
                            ))}
                            <td style={{
                                border: '1px solid black',
                                textAlign: 'center',
                                color: res.hasMinusHandicap ? '#ef4444' : 'inherit',
                                fontWeight: res.hasMinusHandicap ? 'bold' : 'normal'
                            }}>
                                {res.totalHandicap === 0 ? '0' : res.totalHandicap}
                            </td>
                            <td style={{ border: '1px solid black', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                                {res.hiLow}
                            </td>
                            <td style={{ border: '1px solid black', textAlign: 'center', fontWeight: '900', backgroundColor: shouldHighlight ? '#FFFF00' : 'inherit' }}>
                                {res.total}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );

    return (
        <div style={{ backgroundColor: 'white', padding: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ width: '100%', maxWidth: '1000px', padding: '0 0 20px 0' }}>
                <div style={{ backgroundColor: '#FFFF00', border: '1px solid black', borderBottomWidth: '2px', padding: '12px 20px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    <h2 style={{ textAlign: 'center', fontSize: '20px', fontWeight: '900', color: 'black', margin: '0' }}>
                        {round.tournament.name} {round.roundNumber}회차 결과
                    </h2>
                    <div style={{
                        position: 'absolute',
                        right: '20px',
                        display: 'flex',
                        gap: '8px',
                        zIndex: 10
                    }} className="no-print">
                        {isManager && (
                            <>
                                <button
                                    onClick={handleExcelDownload}
                                    style={{
                                        backgroundColor: 'white',
                                        color: 'black',
                                        border: '1px solid black',
                                        borderRadius: '4px',
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    엑셀 다운로드
                                </button>
                                <button
                                    onClick={() => window.print()}
                                    style={{
                                        backgroundColor: 'white',
                                        color: 'black',
                                        border: '1px solid black',
                                        borderRadius: '4px',
                                        padding: '6px 14px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    출력
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', width: '100%', borderTop: 'none' }}>
                    <div style={{ flex: 1, minWidth: '450px' }}>
                        <TableComponent data={leftColumn} startRank={1} />
                    </div>
                    <div style={{ flex: 1, minWidth: '450px' }}>
                        <TableComponent data={rightColumn} startRank={28} isRight={true} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// 7. Tournament Edit Modal (Reused from EventManager)
function TournamentEditModal({ tournament, onClose, onUpdate }: { tournament: any, onClose: () => void, onUpdate?: () => void }) {
    const [loading, setLoading] = useState(false);
    const settings = tournament.settings ? JSON.parse(tournament.settings) : {};

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        try {
            await updateTournamentBasicInfo(tournament.id, formData);
            alert("대회 정보가 수정되었습니다.");
            onUpdate?.();
            onClose();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDateForInputLocal = (dateString: string) => {
        return formatDateForInput(dateString);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
                <div className="p-8 text-left">
                    <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
                        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <span className="p-2 bg-slate-100 rounded-lg">🔨</span> 대회 기본 정보 수정
                        </h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <span className="text-3xl">&times;</span>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">진행 모드</label>
                            <select name="gameMode" defaultValue={settings.gameMode} className="select select-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold">
                                <option value="INDIVIDUAL">개인전</option>
                                <option value="TEAM_2">2인조 전</option>
                                <option value="TEAM_3">3인조 전</option>
                                <option value="TEAM_4">4인조 전</option>
                                <option value="TEAM_5">5인조 전</option>
                                <option value="TEAM_6">6인조 전</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">대회 명칭</label>
                            <input name="name" type="text" defaultValue={tournament.name} className="input input-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" required />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">대회 시작 일시</label>
                                <input name="startDate" type="datetime-local" defaultValue={formatDateForInputLocal(tournament.startDate)} className="input input-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">접수 시작 일시</label>
                                <input name="registrationStart" type="datetime-local" defaultValue={formatDateForInputLocal(settings.registrationStart)} className="input input-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">경기 방식 (게임 수)</label>
                                <select name="gameCount" defaultValue={settings.gameCount} className="select select-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold">
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <option key={n} value={n}>{n}게임</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">참가 정원 (명)</label>
                                <input name="maxParticipants" type="number" defaultValue={tournament.maxParticipants} className="input input-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">참가 대상</label>
                                <input name="target" type="text" defaultValue={settings.target} className="input input-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">참가비</label>
                                <input name="entryFeeText" type="text" defaultValue={settings.entryFeeText} className="input input-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">입금 계좌</label>
                            <input name="bankAccount" type="text" defaultValue={settings.bankAccount} className="input input-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">핸디 적용 안내</label>
                                <input name="handicapInfo" type="text" defaultValue={settings.handicapInfo} className="input input-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">대회 패턴 (정비)</label>
                                <input name="pattern" type="text" defaultValue={settings.pattern} className="input input-bordered w-full h-14 bg-gray-50 border-gray-200 focus:bg-white transition-all text-sm font-bold" />
                            </div>
                        </div>

                        {tournament.type === 'CHAMP' && (
                            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 space-y-6">
                                <h4 className="font-black text-slate-800 flex items-center gap-2">
                                    <span className="text-xl">📉</span> 직전 회차 입상자 마이너스 핸디 설정
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">1위 차감 점수</label>
                                        <input name="minusHandicapRank1" type="number" defaultValue={settings.minusHandicapRank1 || 0} className="input input-bordered w-full h-12 bg-white border-gray-200 focus:bg-white transition-all text-sm font-bold" placeholder="-20" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">2위 차감 점수</label>
                                        <input name="minusHandicapRank2" type="number" defaultValue={settings.minusHandicapRank2 || 0} className="input input-bordered w-full h-12 bg-white border-gray-200 focus:bg-white transition-all text-sm font-bold" placeholder="-15" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">3위 차감 점수</label>
                                        <input name="minusHandicapRank3" type="number" defaultValue={settings.minusHandicapRank3 || 0} className="input input-bordered w-full h-12 bg-white border-gray-200 focus:bg-white transition-all text-sm font-bold" placeholder="-10" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">여자챔프 차감</label>
                                        <input name="minusHandicapFemale" type="number" defaultValue={settings.minusHandicapFemale || 0} className="input input-bordered w-full h-12 bg-white border-gray-200 focus:bg-white transition-all text-sm font-bold" placeholder="-10" />
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 font-bold ml-1">
                                    * 입력한 점수만큼 최종 총점에서 차감됩니다. (예: 20 입력 시 -20점 적용)
                                </p>
                            </div>
                        )}

                        <div className="flex gap-4 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all active:scale-95"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-300 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                            >
                                {loading ? "저장 중..." : "수정 완료"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// 8. Lucky Draw Tab
function RoundLuckyDrawTab({ round }: { round: any }) {
    const [winnerCount, setWinnerCount] = useState(1);
    const [excludeRankers, setExcludeRankers] = useState(true);
    const [winners, setWinners] = useState<any[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [currentCandidate, setCurrentCandidate] = useState<string | null>(null);
    const [isFinalized, setIsFinalized] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initial load from round data
    useEffect(() => {
        if (round.luckyDrawResult) {
            try {
                // Defensive parsing to handle malformed JSON gracefully
                const cleanResult = round.luckyDrawResult.trim();
                let data: any = {};
                try {
                    data = JSON.parse(cleanResult);
                } catch (e) {
                    console.error("Failed to parse GPT response", e);
                    throw new Error("결과 분석 중 오류가 발생했습니다. (JSON 파싱 실패)");
                }

                if (data.winners) setWinners(data.winners);
                if (data.winnerCount) setWinnerCount(data.winnerCount);
                if (data.excludeRankers !== undefined) setExcludeRankers(data.excludeRankers);
                if (data.isFinalized) setIsFinalized(true);
                if (data.winners && data.winners.length > 0) {
                    const lastWinner = data.winners[data.winners.length - 1];
                    setCurrentCandidate(lastWinner.registration.user?.name || lastWinner.registration.guestName);
                }
            } catch (e) {
                console.error("Failed to parse lucky draw result. Malformed JSON:", e);
                console.log("Raw result:", round.luckyDrawResult);
            }
        }
    }, [round.luckyDrawResult]);

    // 1. Calculate Ranks once to handle exclusion
    const sortedResults = [...round.participants].map((p: any) => {
        const pScores = round.individualScores.filter((s: any) => s.registrationId === p.registrationId);
        const total = pScores.reduce((sum: number, s: any) => sum + s.score, 0) + (p.registration.handicap || 0) * pScores.length;
        return { ...p, total };
    }).sort((a: any, b: any) => b.total - a.total);

    const topRankerIds = sortedResults.slice(0, 3).map((p: any) => p.registrationId);
    const femaleChampIds = round.participants.filter((p: any) => p.isFemaleChamp).map((p: any) => p.registrationId);
    const excludedIds = [...new Set([...topRankerIds, ...femaleChampIds])];

    const getEligibleList = () => {
        let list = round.participants.filter((p: any) => !winners.find(w => w.registrationId === p.registrationId));
        if (excludeRankers) {
            list = list.filter((p: any) => !excludedIds.includes(p.registrationId));
        }
        return list;
    };

    const handleDraw = async () => {
        const pool = getEligibleList();
        if (pool.length === 0) {
            alert('추첨 가능한 인원이 없습니다.');
            return;
        }

        setIsRunning(true);
        const startTime = Date.now();
        const duration = 2000; // 2 seconds animation

        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * pool.length);
            const candidate = pool[randomIndex];
            setCurrentCandidate(candidate.registration.user?.name || candidate.registration.guestName);

            if (Date.now() - startTime > duration) {
                clearInterval(interval);

                // Final selection
                const winnerIndex = Math.floor(Math.random() * pool.length);
                const winner = pool[winnerIndex];
                const winnerName = winner.registration.user?.name || winner.registration.guestName;

                setCurrentCandidate(winnerName);
                setWinners(prev => [...prev, winner]);
                setIsRunning(false);

                // Celebrate
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#FFD700', '#FFA500', '#FF4500']
                });
            }
        }, 80);
    };

    const resetDraw = () => {
        if (isFinalized) return;
        if (confirm('추첨 내역을 초기화하시겠습니까?')) {
            setWinners([]);
            setCurrentCandidate(null);
        }
    };

    const handleSave = async () => {
        if (winners.length === 0) return;
        if (!confirm("결과를 저장하시겠습니까? 저장 후에는 수정이나 초기화가 불가능합니다.")) return;

        setIsSaving(true);
        try {
            const resultData = {
                winners,
                winnerCount,
                excludeRankers,
                isFinalized: true
            };
            // Assuming updateLuckyDrawResult is imported or defined elsewhere
            await updateLuckyDrawResult(round.id, JSON.stringify(resultData));
            setIsFinalized(true);
            alert("성공적으로 저장되었습니다.");
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="bg-gray-50 p-10 rounded-[3rem] border-4 border-dashed border-gray-200 text-center w-full shadow-sm">
                <h3 className="text-3xl font-black text-gray-800 mb-8 flex items-center justify-center gap-3">
                    <span className="text-4xl">🎡</span> 행운권 추첨 설정
                </h3>

                <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 mb-16 px-6 py-4 bg-white rounded-2xl shadow-sm border max-w-5xl mx-auto">
                    <div className="flex items-center gap-4">
                        <label className="font-black text-xl text-gray-700 whitespace-nowrap">추첨 인원:</label>
                        <select
                            value={winnerCount}
                            onChange={(e) => setWinnerCount(parseInt(e.target.value))}
                            className="select select-bordered select-lg font-black text-xl w-36 h-14"
                            disabled={isRunning || winners.length > 0 || isFinalized}
                        >
                            {[1, 2, 3, 4, 5, 10, 15, 20].map(n => (
                                <option key={n} value={n}>{n}명</option>
                            ))}
                        </select>
                    </div>

                    <div
                        className={`flex items-center gap-4 select-none group ${isFinalized ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        onClick={() => !isRunning && winners.length === 0 && !isFinalized && setExcludeRankers(!excludeRankers)}
                    >
                        <input
                            type="checkbox"
                            checked={excludeRankers}
                            readOnly
                            className="checkbox checkbox-primary checkbox-lg w-8 h-8"
                            disabled={isRunning || winners.length > 0 || isFinalized}
                        />
                        <span className="font-black text-xl text-gray-700 group-hover:text-blue-600 transition-colors">입상자 제외 (1~3위 & 여챔)</span>
                    </div>
                </div>

                {/* Roulette Area - REFINED LARGE SCALE */}
                <div className="relative h-[500px] md:h-[650px] flex items-center justify-center bg-black rounded-[60px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.9)] mb-14 border-[20px] border-yellow-400 w-full">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-900/40 via-transparent to-black pointer-events-none"></div>

                    <div className="text-center z-10 transition-all px-10 w-full max-w-full overflow-hidden">
                        {isRunning ? (
                            <div
                                className="font-black text-yellow-400 animate-pulse tracking-tighter drop-shadow-[0_0_60px_rgba(250,204,21,0.8)] leading-tight whitespace-nowrap"
                                style={{ fontSize: 'min(12vw, 200px)' }}
                            >
                                {currentCandidate}
                            </div>
                        ) : winners.length > 0 && currentCandidate ? (
                            <div className="animate-bounce-slow">
                                <p
                                    className="text-yellow-400 font-black mb-8 tracking-[1em] drop-shadow-lg uppercase"
                                    style={{ fontSize: 'min(3vw, 40px)' }}
                                >
                                    🎊 Winner 🎊
                                </p>
                                <div
                                    className="font-black text-white drop-shadow-[0_0_80px_rgba(255,255,255,0.9)] leading-none py-12 whitespace-nowrap"
                                    style={{ fontSize: 'min(16vw, 260px)' }}
                                >
                                    {currentCandidate}
                                </div>
                            </div>
                        ) : (
                            <div
                                className="text-gray-700 font-black animate-pulse tracking-[0.3em] leading-tight"
                                style={{ fontSize: 'min(7vw, 100px)' }}
                            >
                                READY TO DRAW
                            </div>
                        )}
                    </div>

                    {/* Decorative Side Lights - REFINED SCALE */}
                    <div className="absolute left-8 top-0 bottom-0 flex flex-col justify-around py-16 w-10">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className={`w-8 h-8 rounded-full ${isRunning ? 'bg-yellow-400 shadow-[0_0_30px_#facc15] animate-pulse scale-125' : 'bg-gray-800'}`} style={{ animationDelay: `${i * 0.1}s` }}></div>
                        ))}
                    </div>
                    <div className="absolute right-8 top-0 bottom-0 flex flex-col justify-around py-16 w-10">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className={`w-8 h-8 rounded-full ${isRunning ? 'bg-yellow-400 shadow-[0_0_30px_#facc15] animate-pulse scale-125' : 'bg-gray-800'}`} style={{ animationDelay: `${i * 0.15}s` }}></div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col justify-center items-center gap-10 mb-8">
                    <button
                        onClick={handleDraw}
                        disabled={isRunning || winners.length >= winnerCount || isFinalized}
                        className="btn btn-lg min-h-[130px] w-full max-w-3xl bg-red-600 hover:bg-red-700 text-white font-black text-[3.5rem] rounded-[4rem] shadow-[0_25px_60px_rgba(220,38,38,0.4)] transform hover:scale-105 active:scale-95 transition-all border-0 disabled:bg-gray-400 disabled:shadow-none mb-2"
                    >
                        {isFinalized ? '추첨 완료 (잠금)' : winners.length >= winnerCount ? '추첨 완료' : `제 ${winners.length + 1}차 추첨하기`}
                    </button>
                    {!isFinalized && winners.length > 0 && !isRunning && (
                        <div className="w-full max-w-3xl flex flex-col gap-4 mt-4">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="btn btn-lg h-24 w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-4xl rounded-3xl shadow-xl transform active:scale-95 transition-all border-0"
                            >
                                {isSaving ? '저장 중...' : '💾 결과 저장하기 (잠금)'}
                            </button>
                            <p className="text-gray-400 text-base font-bold">⚠️ 저장 후에는 추첨 결과를 수정하거나 초기화할 수 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Winner List - ROBUST INLINE STYLE REDESIGN */}
            {winners.length > 0 && (
                <div style={{ maxWidth: '900px', margin: '6rem auto 12rem', position: 'relative' }}>
                    {/* Header Section */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '3rem', padding: '0 1rem', borderBottom: '4px solid #0f172a', paddingBottom: '1.5rem' }}>
                        <div>
                            <h4 style={{ margin: 0, fontWeight: 900, color: '#0f172a', fontSize: '3.5rem', letterSpacing: '-0.05em', lineHeight: 1 }}>
                                당첨자 명단
                            </h4>
                            <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontWeight: 700, fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>WINNERS LIST</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', backgroundColor: '#ffffff', border: '2px solid #f1f5f9', borderRadius: '1.25rem', padding: '0.75rem 1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: '#2563eb', fontWeight: 900, fontSize: '2rem' }}>{winners.length}</span>
                                <span style={{ color: '#e2e8f0', fontSize: '1.5rem', fontWeight: 300 }}>/</span>
                                <span style={{ color: '#64748b', fontWeight: 900, fontSize: '1.5rem' }}>{winnerCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                                <tr>
                                    <th style={{ padding: '2rem', color: '#64748b', fontWeight: 800, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em', width: '120px', textAlign: 'center' }}>순번</th>
                                    <th style={{ padding: '2rem', color: '#64748b', fontWeight: 800, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em', width: '40%' }}>소속 / 팀</th>
                                    <th style={{ padding: '2rem', color: '#64748b', fontWeight: 800, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>당첨자 성함</th>
                                </tr>
                            </thead>
                            <tbody>
                                {winners.map((winner, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', transition: 'background-color 0.2s' }}>
                                        <td style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '4.5rem', height: '4.5rem', backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '1.25rem', fontWeight: 900, fontSize: '1.75rem', fontStyle: 'italic', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                                                #{idx + 1}
                                            </div>
                                        </td>
                                        <td style={{ padding: '2.5rem 2rem' }}>
                                            <span style={{ fontWeight: 700, color: '#64748b', fontSize: '1.75rem', letterSpacing: '-0.025em' }}>
                                                {winner.registration.guestTeamName || winner.registration.team?.name || '개인'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '2.5rem 2rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                                <span style={{ fontWeight: 900, color: '#0f172a', fontSize: '3.5rem', letterSpacing: '-0.05em' }}>
                                                    {winner.registration.user?.name || winner.registration.guestName}
                                                </span>
                                                {idx === winners.length - 1 && !isRunning && (
                                                    <span style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '0.375rem 1rem', borderRadius: '1rem', fontWeight: 900, fontSize: '0.875rem', verticalAlign: 'middle' }}>
                                                        NEW!
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Reset Button Section - EXTREME SPACING & ROBUST DESIGN */}
                    {!isFinalized && winners.length > 0 && !isRunning && (
                        <div style={{ marginTop: '500px', marginBottom: '10rem', textAlign: 'center' }}>
                            <div style={{ display: 'inline-block', padding: '4rem', borderRadius: '3.5rem', backgroundColor: '#f8fafc', border: '4px dashed #e2e8f0' }}>
                                <div style={{ marginBottom: '2.5rem' }}>
                                    <h5 style={{ margin: 0, fontWeight: 900, color: '#94a3b8', fontSize: '2rem', marginBottom: '0.5rem' }}>RESTORE SESSION?</h5>
                                    <p style={{ margin: 0, color: '#cbd5e1', fontWeight: 700, fontSize: '1.125rem' }}>모든 추첨 데이터를 초기화하고 처음부터 다시 시작합니다.</p>
                                </div>
                                <button
                                    onClick={resetDraw}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: '2px solid transparent',
                                        color: '#cbd5e1',
                                        fontWeight: 900,
                                        fontSize: '1.75rem',
                                        padding: '1.5rem 3rem',
                                        borderRadius: '1.5rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.borderColor = '#fee2e2'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                                >
                                    🔄 전체 추첨 데이터 초기화
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function RoundDetailPageContent({ round, userId, isManager = false, centerId }: { round: any, userId?: string, isManager?: boolean, centerId?: string }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialTab = searchParams.get('tab') || 'overview';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [showEditModal, setShowEditModal] = useState(false);
    const [lotteryStatus, setLotteryStatus] = useState<'PENDING' | 'OPEN' | 'CLOSED'>('CLOSED');

    const statusMap: Record<string, { label: string, color: string }> = {
        UPCOMING: { label: STATUS_LABELS.UPCOMING, color: "bg-slate-500" },
        OPEN: { label: STATUS_LABELS.OPEN, color: "bg-green-500" },
        CLOSED: { label: STATUS_LABELS.CLOSED, color: "bg-red-500" },
        ONGOING: { label: STATUS_LABELS.ONGOING, color: "bg-blue-600" },
        FINISHED: { label: STATUS_LABELS.FINISHED, color: "bg-red-600" },
    };

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    useEffect(() => {
        const effectiveDateStr = round.effectiveDateStr;
        if (!effectiveDateStr) return;

        const checkTime = () => {
            const now = new Date();
            const start = new Date(effectiveDateStr);
            const twoHoursBefore = new Date(start.getTime() - 2 * 60 * 60 * 1000);
            const oneHourBefore = new Date(start.getTime() - 1 * 60 * 60 * 1000);

            if (now >= twoHoursBefore && now < oneHourBefore) {
                setLotteryStatus('OPEN');
            } else if (now < twoHoursBefore) {
                setLotteryStatus('PENDING');
            } else {
                setLotteryStatus('CLOSED');
            }
        };
        checkTime();
        const interval = setInterval(checkTime, 60000);
        return () => clearInterval(interval);
    }, [round.effectiveDateStr]);

    if (!round) return <div>Data not found</div>;

    const participation = round.participants.find((p: any) => p.registration.userId === userId);

    const tabs = [
        { id: 'overview', label: '대시보드' },
        ...(isManager ? [{ id: 'settings', label: '대회 설정' }] : []),
        { id: 'participants', label: '참가자' },
        { id: 'lanes', label: isManager ? '레인 배정' : '레인 현황' },
        { id: 'scoring', label: '점수 입력' },
        { id: 'sideGame', label: '사이드게임' },
        { id: 'finalResults', label: '최종결과' },
        { id: 'luckyDraw', label: '행운권 추첨' },
    ];

    const refresh = () => {
        router.refresh();
    };

    const hasResults = round.individualScores && round.individualScores.some((s: any) => s.score > 0);
    const shouldShowSimplifiedResults = !isManager &&
        round.tournament.type === 'CHAMP' &&
        (hasResults || (round.date && new Date() > new Date(round.date)));

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        router.replace(`${window.location.pathname}?tab=${tabId}`, { scroll: false });
    };

    return (
        <div className="space-y-6">
            {showEditModal && (
                <TournamentEditModal
                    tournament={round.tournament}
                    onClose={() => setShowEditModal(false)}
                    onUpdate={refresh}
                />
            )}
            <div className="mb-6">
                <Link
                    href={(() => {
                        const fromRecruit = searchParams.get('from') === 'recruit';
                        const baseUrl = round.tournament.type === 'EVENT'
                            ? `/centers/${round.tournament.centerId}`
                            : `/centers/${round.tournament.centerId}/tournaments/${round.tournament.id}`;
                        return fromRecruit ? `${baseUrl}?mode=recruit` : baseUrl;
                    })()}
                    className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors mb-2 w-fit group"
                >
                    <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors border border-gray-700">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </div>
                    <span className="text-sm font-medium">
                        {round.tournament.type === 'EVENT' ? '대회 목록으로 돌아가기' : '대회 정보로 돌아가기'}
                    </span>
                </Link>

                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded-md shadow uppercase tracking-wider leading-none">{round.tournament.name}</span>
                            <div className="flex flex-col md:flex-row md:items-center gap-2">
                                <span className="leading-tight">
                                    {isManager ? `${round.roundNumber}회차 상세 관리` : (shouldShowSimplifiedResults ? '대회 결과 및 정보' : `${round.roundNumber}회차 상세 정보`)}
                                </span>
                                {(() => {
                                    const effectiveDate = round.effectiveDateStr ? new Date(round.effectiveDateStr) : (round.date ? new Date(round.date) : null);
                                    const status = round.calculatedStatus || 'UPCOMING';
                                    const config = statusMap[status as any] || statusMap['UPCOMING'];
                                    return (
                                        <span className={`${config.color} text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm w-fit`}>
                                            {config.label}
                                        </span>
                                    );
                                })()}
                            </div>
                        </h1>
                        <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
                            <span>📅 {formatKSTDate(round.effectiveDateStr || round.date)}</span>
                            <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                            <span>👥 참가 {round.participants.length}명</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {isManager && round.tournament.type === 'EVENT' && (
                            <>
                                <button
                                    onClick={() => setShowEditModal(true)}
                                    className="btn btn-sm bg-white hover:bg-slate-100 text-slate-900 border-none font-black px-4"
                                >
                                    🔧 대회 정보 수정
                                </button>
                                <TournamentStatusDropdown
                                    tournamentId={round.tournament.id}
                                    currentStatus={round.tournament.status}
                                    statusMap={statusMap}
                                />
                                <DeleteTournamentButton tournamentId={round.tournament.id} />
                            </>
                        )}

                        {/* Lottery Button for Participants */}
                        {participation && !participation.lane && round.date && (
                            <div className="animate-fade-in">
                                {lotteryStatus === 'OPEN' ? (
                                    <Link
                                        href={`/centers/${round.tournament.centerId}/tournaments/${round.tournament.id}/rounds/${round.id}/lottery`}
                                        className="btn bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black shadow-lg border-0 hover:scale-105 transition-transform flex items-center gap-2 animate-pulse-slow"
                                    >
                                        <span className="text-xl">🎲</span>
                                        <span>내 레인 뽑기 (~{(() => {
                                            const effective = getEffectiveRoundDate(round.date, round.tournament.leagueTime);
                                            return effective ? new Date(effective.getTime() - 1 * 60 * 60 * 1000).toLocaleTimeString('ko-KR', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false,
                                                hourCycle: 'h23'
                                            }) : '';
                                        })()})</span>
                                    </Link>
                                ) : lotteryStatus === 'PENDING' ? (
                                    <button disabled className="btn bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed flex items-center gap-2">
                                        <span className="text-xl">⏳</span>
                                        <span>레인 추첨 대기중 ({(() => {
                                            const effective = getEffectiveRoundDate(round.date, round.tournament.leagueTime);
                                            return effective ? new Date(effective.getTime() - 2 * 60 * 60 * 1000).toLocaleTimeString('ko-KR', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false,
                                                hourCycle: 'h23'
                                            }) : '';
                                        })()} 오픈)</span>
                                    </button>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {
                isManager && (
                    <div className="flex border-b overflow-x-auto pb-1 scrollbar-hide">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`px-5 py-3 font-bold border-b-2 transition-all whitespace-nowrap text-sm md:text-base ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )
            }

            <div className="bg-white min-h-[400px]">
                {/* Simplified Result View for CHAMP Members in Closed Rounds */}
                {shouldShowSimplifiedResults ? (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* 1. Final Results Table */}
                        <div className="p-4 md:p-8">
                            <div className="flex items-center gap-3 mb-6 px-2">
                                <span className="text-2xl">📊</span>
                                <h3 className="text-xl font-black italic">최종 경기 결과</h3>
                            </div>
                            <RoundFinalResultsTab round={round} isManager={false} />
                        </div>

                        {/* 2. Lucky Draw Winners - Only show if exist */}
                        {round.luckyDrawResult && (() => {
                            try {
                                let result: any = {};
                                try {
                                    result = JSON.parse(round.luckyDrawResult);
                                } catch (e) { return null; }
                                if (result.winners && result.winners.length > 0) {
                                    return (
                                        <div className="p-4 md:p-8 pt-0">
                                            <div className="flex items-center gap-3 mb-6 px-2">
                                                <span className="text-2xl">🎁</span>
                                                <h3 className="text-xl font-black italic">행운권 추첨 당첨자</h3>
                                            </div>
                                            <div className="bg-slate-50 rounded-[2.5rem] p-8 border-2 border-slate-200 shadow-inner">
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {result.winners.map((winner: any, idx: number) => (
                                                        <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-1">
                                                            <span className="text-blue-600 font-black text-lg">
                                                                {winner.registration?.user?.name || winner.registration?.guestName}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400">
                                                                {winner.registration?.guestTeamName || winner.registration?.team?.name || '개인회원'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            } catch (e) { return null; }
                            return null;
                        })()}
                    </div>
                ) : (
                    <>
                        {activeTab === 'overview' && <RoundOverviewTab round={round} />}
                        {activeTab === 'settings' && isManager && <RoundSettingsTab round={round} onUpdate={refresh} />}
                        {activeTab === 'participants' && (
                            <RoundParticipantManager
                                rounds={round.tournament.rounds}
                                initialRoundId={round.id}
                                allRegistrations={round.tournament.registrations}
                                isManager={isManager}
                                onUpdate={refresh}
                                currentUserId={userId}
                                centerId={centerId || ''}
                                isEvent={round.tournament.type === 'EVENT'}
                                tournamentType={round.tournament.type}
                                hideRoundTabs={true}
                            />
                        )}
                        {activeTab === 'lanes' && <RoundLanesTab round={round} onUpdate={refresh} isManager={isManager} />}
                        {activeTab === 'scoring' && <RoundScoringTab round={round} onUpdate={refresh} />}
                        {activeTab === 'sideGame' && (
                            <div className="p-8 bg-slate-100/50">
                                {(() => {
                                    let settings: any = {};
                                    try {
                                        if (round.tournament?.settings) settings = JSON.parse(round.tournament.settings);
                                    } catch (e) { }
                                    const gCount = settings.gameCount || 3;
                                    return (
                                        <SideGameManager
                                            matchups={round.matchups}
                                            participants={round.participants}
                                            allIndividualScores={round.individualScores}
                                            roundId={round.id}
                                            isManager={isManager}
                                            tournamentType={round.tournament.type}
                                            gameCount={gCount}
                                            tournamentRegistrations={round.tournament.registrations}
                                        />
                                    );
                                })()}
                            </div>
                        )}
                        {activeTab === 'finalResults' && <RoundFinalResultsTab round={round} isManager={isManager || false} />}
                        {activeTab === 'luckyDraw' && <RoundLuckyDrawTab round={round} />}
                    </>
                )}
            </div>
        </div >
    );
}
