'use client';

import { useState, useMemo } from 'react';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updatePaymentStatus, deleteRegistration, manualRegister, updateRegistration, updateRoundLanes, searchPlayers } from '@/app/actions/round-actions';
import { formatLane } from '@/lib/tournament-utils';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';

interface RoundParticipantManagerProps {
    rounds: any[];
    initialRoundId?: string;
    allRegistrations: any[];
    onUpdate?: () => void;
    isManager?: boolean;
    hideRoundTabs?: boolean;
    maxParticipants?: number;
    isEvent?: boolean;
    currentUserId?: string;
    centerId: string;
    tournamentType?: string;
}

import { checkAndCancelUnpaidRegistrations } from '@/app/actions/round-actions';
import { useEffect } from 'react';

export default function RoundParticipantManager({
    rounds,
    initialRoundId,
    allRegistrations,
    onUpdate,
    isManager = false,
    hideRoundTabs = false,
    maxParticipants = 0,
    isEvent = false,
    currentUserId,
    centerId,
    tournamentType
}: RoundParticipantManagerProps) {
    const router = useRouter();
    const tableRef = useRef<HTMLDivElement>(null);

    // Default to initialRoundId or the latest round if not found
    const defaultRoundId = initialRoundId || (rounds && rounds.length > 0 ? rounds[0].id : '');
    const [selectedRoundId, setSelectedRoundId] = useState(defaultRoundId);

    // Auto Cancel Trigger on Mount
    useEffect(() => {
        if (selectedRoundId && isManager) {
            checkAndCancelUnpaidRegistrations(selectedRoundId).then(res => {
                if (res && res.count > 0) {
                    console.log(`Auto-canceled ${res.count} unpaid registrations.`);
                    if (onUpdate) onUpdate(); // Refresh UI if needed
                }
            });
        }
    }, [selectedRoundId, isManager]);

    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedReg, setSelectedReg] = useState<any>(null);
    const [manualType, setManualType] = useState<'MEMBER' | 'GUEST'>('GUEST');
    const [manualName, setManualName] = useState('');
    const [manualTeam, setManualTeam] = useState('');
    const [manualHandicap, setManualHandicap] = useState<number | ''>('');

    // Lane Manual Edit State
    const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
    const [tempLaneValue, setTempLaneValue] = useState<string>('');

    // Member Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const selectedRound = useMemo(() => {
        return rounds.find(r => r.id === selectedRoundId) || rounds[0];
    }, [rounds, selectedRoundId]);

    // Filter registrations to ONLY show those participating in the selected round
    const roundParticipants = useMemo(() => {
        const registrations = allRegistrations || [];
        if (isEvent) {
            return [...registrations].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
        if (!selectedRound) return [];
        const participantRegIds = new Set(selectedRound.participants?.map((p: any) => p.registrationId) || []);

        return registrations
            .filter(reg => participantRegIds.has(reg.id))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [allRegistrations, selectedRound, isEvent]);

    const openRegisterModal = () => {
        setIsEditMode(false);
        setManualName('');
        setManualTeam('');
        setManualHandicap('');
        setShowModal(true);
    };

    const openEditModal = (reg: any) => {
        setIsEditMode(true);
        setSelectedReg(reg);
        setManualName(reg.guestName || reg.user?.name || '');
        setManualTeam(reg.guestTeamName || reg.team?.name || '');
        setManualHandicap(reg.handicap ?? reg.user?.handicap ?? '');
        setShowModal(true);
    };

    const triggerUpdate = () => {
        if (onUpdate) onUpdate();
        router.refresh();
    };

    const handleSaveParticipant = async () => {
        try {
            if (!selectedRound) throw new Error("라운드를 선택해주세요.");

            if (isEditMode && selectedReg) {
                await updateRegistration(selectedReg.id, {
                    guestName: manualName,
                    guestTeamName: manualTeam,
                    handicap: manualHandicap === '' ? 0 : Number(manualHandicap)
                });
            } else {
                await manualRegister(selectedRound.id, {
                    type: manualType,
                    userId: selectedUserId || undefined,
                    guestName: manualName,
                    guestTeam: manualTeam,
                    handicap: manualHandicap === '' ? 0 : Number(manualHandicap)
                });
            }
            setShowModal(false);
            setSelectedUserId(null); // Reset after save
            triggerUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleSearchMembers = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const results = await searchPlayers(searchQuery, centerId);
            setSearchResults(results);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const selectMember = async (user: any) => {
        if (!confirm(`"${user.name}"님을 참가자로 등록하시겠습니까?`)) return;

        try {
            await manualRegister(selectedRound.id, {
                type: 'MEMBER',
                userId: user.id,
                guestName: user.name,
                guestTeam: user.teamName,
                handicap: user.handicap ?? 0
            });

            // Clear search and reset
            setSearchResults([]);
            setSearchQuery('');
            triggerUpdate();
            alert("등록되었습니다.");
        } catch (e: any) {
            console.error(e);
            alert(e.message || "등록 중 오류가 발생했습니다.");
        }
    };

    const handleUpdatePayment = async (regId: string, newStatus: string) => {
        try {
            await updatePaymentStatus(regId, newStatus);
            triggerUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDelete = async (regId: string) => {
        if (!confirm('정말 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.')) return;
        try {
            await deleteRegistration(regId);
            triggerUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleManualLaneSave = async (participantId: string) => {
        try {
            if (!tempLaneValue || !tempLaneValue.includes('-')) {
                throw new Error("레인 형식이 올바르지 않습니다. (예: 1-2)");
            }
            const [lane, slot] = tempLaneValue.split('-').map(Number);
            if (isNaN(lane) || isNaN(slot)) {
                throw new Error("레인 형식이 올바르지 않습니다. (예: 1-2)");
            }
            const encodedLane = lane * 10 + slot;
            await updateRoundLanes(selectedRound.id, [{ participantId, lane: encodedLane }]);
            setEditingLaneId(null);
            triggerUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const downloadExcel = () => {
        const data = roundParticipants.map((reg, idx) => ({
            '순번': idx + 1 > maxParticipants && maxParticipants > 0 ? `대기 ${idx + 1 - maxParticipants}` : idx + 1,
            '팀명': reg.guestTeamName || reg.team?.name || '개인',
            '성함': reg.user?.name || reg.guestName,
            '핸디캡': reg.user?.handicap ?? reg.handicap ?? 0,
            '입금현황': reg.paymentStatus === 'PAID' ? '입금완료' : '입금대기',
            '레인': (() => {
                const p = selectedRound.participants?.find((p: any) => p.registrationId === reg.id);
                return formatLane(p?.lane, p?.isManual);
            })()
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Participants");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const finalData = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(finalData, `참가자명단_${selectedRound.roundNumber}회차_${new Date().toLocaleDateString()}.xlsx`);
    };

    const saveAsImage = async () => {
        if (tableRef.current === null) return;
        try {
            const dataUrl = await toPng(tableRef.current, { backgroundColor: '#ffffff', quality: 1, pixelRatio: 2 });
            saveAs(dataUrl, `참가자명단_${selectedRound.roundNumber}회차_${new Date().toLocaleDateString()}.png`);
        } catch (err) {
            console.error('oops, something went wrong!', err);
        }
    };

    if (!rounds || rounds.length === 0) return null;

    return (
        <div className="space-y-6">
            {/* Round Selection Tabs */}
            {!hideRoundTabs && (
                <div className="flex flex-wrap gap-2 pb-2 border-b-2 border-primary/10">
                    {rounds.map((r) => {
                        const isActive = r.id === selectedRoundId;
                        return (
                            <button
                                key={r.id}
                                onClick={() => setSelectedRoundId(r.id)}
                                className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all shadow-sm ${isActive
                                    ? 'bg-primary text-primary-foreground scale-105 shadow-primary/20'
                                    : 'bg-secondary/5 text-secondary-foreground hover:bg-secondary/20 shadow-none'
                                    }`}
                            >
                                {r.roundNumber}회차 명단
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50 p-5 rounded-2xl border-2 border-slate-200 gap-4">
                <div>
                    {(!hideRoundTabs || isManager) && (
                        <h3 className="text-xl font-black text-slate-800">
                            {isManager ? (isEvent ? '참가자 명단' : '참가자 명단 관리') : '참가자 명단'}
                            <span className="text-primary text-base ml-2">({selectedRound?.roundNumber}회차)</span>
                        </h3>
                    )}
                    <p className="text-xs font-bold text-slate-500 mt-1">
                        현재 참여 인원: <span className="text-slate-900">{roundParticipants.length}명</span>
                        {maxParticipants > 0 && (
                            <span className="text-slate-500 ml-1">
                                (정원: {maxParticipants}명 / 대기: {Math.max(0, roundParticipants.length - maxParticipants)}명)
                            </span>
                        )}
                    </p>
                </div>
                {isManager && (
                    <button
                        onClick={openRegisterModal}
                        className="btn btn-primary h-12 px-8 font-black shadow-lg shadow-primary/20 flex items-center gap-2"
                    >
                        <span className="text-lg">+</span> 수동 등록
                    </button>
                )}
            </div>

            {/* Manual Register / Edit Form (Inline) */}
            {showModal && (
                <div
                    className="bg-slate-100 rounded-2xl border-2 border-slate-900 overflow-hidden animate-in slide-in-from-top-4 duration-300 mt-8 mb-8 shadow-xl"
                >
                    <div className="bg-slate-900 px-6 py-3 flex justify-between items-center">
                        <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                            {isEditMode ? '참가자 정보 수정' : '신규 참가자 수동 등록'}
                        </h3>
                        <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-2xl font-light">×</button>
                    </div>

                    <div className="p-6">
                        <div className="flex flex-col lg:flex-row items-end gap-4">
                            {!isEditMode && (
                                <div className="flex bg-white p-1 rounded-xl border border-slate-200 h-[52px]">
                                    <button
                                        onClick={() => setManualType('MEMBER')}
                                        className={`px-4 text-[11px] font-black rounded-lg transition-all ${manualType === 'MEMBER' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}
                                    >
                                        회원 검색
                                    </button>
                                    <button
                                        onClick={() => setManualType('GUEST')}
                                        className={`px-4 text-[11px] font-black rounded-lg transition-all ${manualType === 'GUEST' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}
                                    >
                                        직접 입력
                                    </button>
                                </div>
                            )}

                            {manualType === 'MEMBER' && !isEditMode ? (
                                <div className="flex-1 w-full lg:w-auto relative">
                                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase">회원 이름 검색</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearchMembers()}
                                            className="flex-1 h-[52px] border-2 border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:border-primary transition-all text-black bg-white"
                                            placeholder="회원 이름을 입력하세요"
                                        />
                                        <button
                                            onClick={handleSearchMembers}
                                            disabled={isSearching}
                                            className="px-6 h-[52px] bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-slate-800 transition-all disabled:bg-slate-400"
                                        >
                                            {isSearching ? '...' : '검색'}
                                        </button>
                                    </div>

                                    {searchResults.length > 0 && (
                                        <div className="absolute top-[100%] left-0 right-0 mt-2 bg-white border-2 border-slate-900 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto overflow-x-hidden">
                                            {searchResults.map((user: any, index: number) => (
                                                <button
                                                    key={`${user.id}-${index}`}
                                                    onClick={() => selectMember(user)}
                                                    className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center group transition-colors"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 group-hover:text-primary">{user.name}</span>
                                                        <span className="text-[10px] font-bold text-slate-400">{user.teamName || '팀 없음'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-500">핸디: {user.handicap ?? 0}</span>
                                                        <span className="text-xs text-primary opacity-0 group-hover:opacity-100 font-black">선택 +</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {isSearching && searchResults.length === 0 && (
                                        <div className="absolute top-[100%] left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-xl p-4 text-center text-xs font-bold text-slate-400 z-50">
                                            검색 중...
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 w-full lg:w-auto">
                                        <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase">팀명 (선택)</label>
                                        <input
                                            type="text"
                                            value={manualTeam}
                                            onChange={(e) => {
                                                setManualTeam(e.target.value);
                                                if (selectedUserId) setSelectedUserId(null);
                                            }}
                                            className="w-full h-[52px] border-2 border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:border-primary transition-all text-black bg-white"
                                            placeholder="개인"
                                        />
                                    </div>
                                    <div className="flex-1 w-full lg:w-auto">
                                        <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase">성함</label>
                                        <input
                                            type="text"
                                            value={manualName}
                                            onChange={(e) => {
                                                setManualName(e.target.value);
                                                if (selectedUserId) setSelectedUserId(null);
                                            }}
                                            className="w-full h-[52px] border-2 border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:border-primary transition-all text-black bg-white"
                                            placeholder="이름"
                                        />
                                    </div>
                                    <div className="w-full lg:w-28">
                                        <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase">핸디캡</label>
                                        <input
                                            type="number"
                                            value={manualHandicap}
                                            onChange={(e) => setManualHandicap(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full h-[52px] border-2 border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:border-primary transition-all text-black bg-white"
                                            placeholder="0"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSaveParticipant}
                                        className="w-full lg:w-40 h-[52px] bg-blue-600 text-white rounded-xl font-black text-sm shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all outline-none"
                                    >
                                        {isEditMode ? '저장하기' : (selectedUserId ? '회원 등록' : '등록하기')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div ref={tableRef} className="bg-white p-2 border-2 border-slate-900 rounded-2xl shadow-2xl min-h-[400px] overflow-hidden">
                <div className="overflow-x-auto">
                    {roundParticipants.length === 0 ? (
                        <div className="text-center text-slate-400 font-bold py-20 w-full italic">
                            (해당 회차에 등록된 참가자가 없습니다)
                        </div>
                    ) : (
                        <table
                            className="w-full text-sm border-collapse"
                            style={{
                                color: 'black',
                                tableLayout: 'fixed',
                                minWidth: '800px'
                            }}
                        >
                            <thead>
                                <tr className="text-center" style={{ height: '48px', backgroundColor: '#e2e8f0', color: '#1e293b' }}>
                                    <th className="border-2 border-slate-900 p-1 font-black" style={{ width: '60px' }}>순번</th>
                                    <th className="border-2 border-slate-900 p-1 font-black" style={{ width: '150px' }}>팀명</th>
                                    <th className="border-2 border-slate-900 p-1 font-black" style={{ width: '150px' }}>성함</th>
                                    <th className="border-2 border-slate-900 p-1 font-black" style={{ width: '80px' }}>핸디</th>
                                    <th className="border-2 border-slate-900 p-1 font-black" style={{ width: '110px' }}>현황</th>
                                    <th className="border-2 border-slate-900 p-1 font-black" style={{ width: '180px' }}>레인</th>
                                    <th className="border-2 border-slate-900 p-1 font-black" style={{ width: '70px' }}>관리</th>
                                </tr>
                            </thead>
                            <tbody className="font-bold">
                                {roundParticipants.map((reg: any, idx: number) => {
                                    const participant = selectedRound.participants?.find((p: any) => p.registrationId === reg.id);

                                    const isWaitlisted = maxParticipants > 0 && idx + 1 > maxParticipants;
                                    const waitNumber = isWaitlisted ? idx + 1 - maxParticipants : 0;
                                    const isCurrentUser = currentUserId && reg.userId === currentUserId;

                                    const isEven = idx % 2 === 1;
                                    const bgColor = isCurrentUser ? '#e0f2fe' : (isWaitlisted ? '#fffbeb' : (isEven ? '#f8fafc' : '#FFFFFF')); // Sky blue for current user

                                    const handicap = reg.user?.handicap ?? reg.handicap ?? '0';
                                    const isPaid = reg.paymentStatus === 'PAID';

                                    return (
                                        <tr
                                            key={reg.id}
                                            className="text-center h-12 hover:bg-blue-50 transition-colors"
                                            style={{ backgroundColor: bgColor }}
                                        >
                                            <td className={`border-2 border-slate-900 p-1 font-black ${isWaitlisted ? 'text-amber-600' : ''}`}>
                                                {isWaitlisted ? `대기 ${waitNumber}` : idx + 1}
                                            </td>
                                            <td className="border-2 border-slate-900 p-1 truncate px-4">
                                                {reg.guestTeamName || reg.team?.name || '개인'}
                                            </td>
                                            <td className="border-2 border-slate-900 p-1 truncate px-4 font-black">
                                                {reg.user?.name || reg.guestName}
                                            </td>
                                            <td className="border-2 border-slate-900 p-1">
                                                {handicap}
                                            </td>
                                            <td className="border-2 border-slate-900 p-1">
                                                {isManager ? (
                                                    <select
                                                        value={reg.paymentStatus}
                                                        onChange={(e) => handleUpdatePayment(reg.id, e.target.value)}
                                                        className={`text-[11px] px-2 py-1.5 rounded-lg font-black border transition-all cursor-pointer outline-none h-8 w-full text-center appearance-none ${isPaid
                                                            ? 'bg-blue-600 text-white border-blue-700'
                                                            : 'bg-red-500 text-white border-red-600'
                                                            }`}
                                                    >
                                                        <option value="PENDING" className="bg-white text-black text-center">입금 대기</option>
                                                        <option value="PAID" className="bg-white text-black text-center">입금 완료</option>
                                                    </select>
                                                ) : (
                                                    <div className="flex items-center justify-center">
                                                        <span className={`text-[11px] px-3 py-1 rounded-full font-black ${isPaid ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                            {isPaid ? '입금 완료' : '입금 대기'}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="border-2 border-slate-900 p-1 font-black whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-2">
                                                    {editingLaneId === participant?.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <select
                                                                value={tempLaneValue}
                                                                onChange={(e) => setTempLaneValue(e.target.value)}
                                                                className="w-24 h-8 text-center border-2 border-blue-400 rounded-md text-[11px] font-black outline-none bg-white"
                                                            >
                                                                <option value="">레인 선택</option>
                                                                {(() => {
                                                                    const options = [];
                                                                    try {
                                                                        const config = selectedRound.laneConfig ? JSON.parse(selectedRound.laneConfig) : {};
                                                                        if (Object.keys(config).length > 0) {
                                                                            Object.entries(config).forEach(([lane, slots]: any) => {
                                                                                slots.forEach((slot: number) => {
                                                                                    const val = parseInt(lane) * 10 + slot;
                                                                                    options.push({ val, label: `${lane}-${slot}` });
                                                                                });
                                                                            });
                                                                        } else if (selectedRound.startLane && selectedRound.endLane) {
                                                                            for (let l = selectedRound.startLane; l <= selectedRound.endLane; l++) {
                                                                                for (let s = 1; s <= 3; s++) {
                                                                                    const val = l * 10 + s;
                                                                                    options.push({ val, label: `${l}-${s}` });
                                                                                }
                                                                            }
                                                                        }
                                                                    } catch (e) { }
                                                                    return options.sort((a, b) => a.val - b.val).map(opt => (
                                                                        <option key={opt.val} value={opt.label}>{opt.label}</option>
                                                                    ));
                                                                })()}
                                                            </select>
                                                            <button
                                                                onClick={() => handleManualLaneSave(participant.id)}
                                                                className="w-8 h-8 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 transition-colors"
                                                            >
                                                                💾
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingLaneId(null)}
                                                                className="w-8 h-8 bg-slate-200 text-slate-600 rounded-md text-xs hover:bg-slate-300 transition-colors"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {participant?.lane ? (
                                                                <span className="text-primary">{formatLane(participant.lane, participant?.isManual)}</span>
                                                            ) : (
                                                                (() => {
                                                                    let canDraw = false;
                                                                    try {
                                                                        const config = selectedRound.laneConfig ? JSON.parse(selectedRound.laneConfig) : {};
                                                                        if (Object.keys(config).length > 0) canDraw = true;
                                                                    } catch (e) { }
                                                                    if (!canDraw) canDraw = !!(selectedRound.startLane && selectedRound.endLane);

                                                                    return canDraw && isCurrentUser && !isWaitlisted ? (
                                                                        <Link
                                                                            href={`/centers/${centerId}/tournaments/${selectedRound.tournamentId}/rounds/${selectedRound.id}/draw`}
                                                                            className="btn btn-xs bg-blue-600 text-white hover:bg-blue-700 border-0 h-8 font-black whitespace-nowrap"
                                                                        >
                                                                            🎰 레인 추첨
                                                                        </Link>
                                                                    ) : (
                                                                        <span className="text-slate-300 font-normal italic text-xs">미배정</span>
                                                                    );
                                                                })()
                                                            )}
                                                            {isManager && participant && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingLaneId(participant.id);
                                                                        setTempLaneValue(participant.lane ? formatLane(participant.lane).replace('(수동)', '') : '');
                                                                    }}
                                                                    className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-400 rounded-md hover:bg-blue-50 hover:text-blue-500 transition-colors"
                                                                    title="레인 수동 변경"
                                                                >
                                                                    ✏️
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="border-2 border-slate-900 p-1">
                                                <div className="flex items-center justify-center gap-2">
                                                    {isManager ? (
                                                        <>
                                                            <button
                                                                onClick={() => openEditModal(reg)}
                                                                className="w-10 h-8 flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                                                title="수정"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(reg.id)}
                                                                className="w-10 h-8 flex items-center justify-center bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                                                                title="삭제"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400 font-normal">-</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Manager-only: List of tournament registrants NOT in this round (Hide for CHAMP) */}
            {isManager && !isEvent && tournamentType !== 'CHAMP' && (
                <div className="mt-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <span>👥</span> 대회 전체 신청자 중 미참여 인원
                        </h4>
                        <span className="text-xs font-bold text-slate-400">
                            {allRegistrations.filter((reg: any) => !roundParticipants.some((p: any) => p.id === reg.id)).length}명
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(allRegistrations || [])
                            .filter((reg: any) => !roundParticipants.some((p: any) => p.id === reg.id))
                            .map((reg: any) => (
                                <div key={reg.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-slate-800">{reg.user?.name || reg.guestName}</span>
                                        <span className="text-[10px] font-bold text-slate-400">{reg.guestTeamName || reg.team?.name || '개인'}</span>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await manualRegister(selectedRound.id, {
                                                    type: reg.userId ? 'MEMBER' : 'GUEST',
                                                    userId: reg.userId || undefined,
                                                    guestName: reg.guestName || undefined,
                                                    guestTeam: reg.guestTeamName || undefined,
                                                    handicap: reg.handicap || reg.user?.handicap || 0
                                                });
                                                if (res.success) {
                                                    window.location.reload();
                                                }
                                            } catch (e: any) {
                                                alert(e.message);
                                            }
                                        }}
                                        className="btn btn-xs bg-slate-100 hover:bg-primary hover:text-white border-0 text-slate-600 font-bold px-3 h-8 rounded-lg transition-all"
                                    >
                                        + 회차 추가
                                    </button>
                                </div>
                            ))}
                        {(allRegistrations || []).filter((reg: any) => !roundParticipants.some((p: any) => p.id === reg.id)).length === 0 && (
                            <div className="col-span-full py-6 text-center text-xs font-bold text-slate-400 italic">
                                모든 신청자가 이 회차에 참여 중입니다.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
