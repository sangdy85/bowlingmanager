'use client';

import { useState, useMemo } from 'react';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updatePaymentStatus, deleteRegistration, removeFromRound, manualRegister, updateRegistration, updateRoundLanes, searchPlayers, bulkRegisterParticipants, updateEntryGroupId, autoAssignEntryGroups, updateSingleRegistrationGroup } from '@/app/actions/round-actions';
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

    // Grouping Selection State
    const [selectedRegIds, setSelectedRegIds] = useState<string[]>([]);

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

    const [loading, setLoading] = useState(false);
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

    const isIndividualMode = useMemo(() => {
        try {
            const settings = selectedRound?.tournament?.settings ? (typeof selectedRound.tournament.settings === 'string' ? JSON.parse(selectedRound.tournament.settings) : selectedRound.tournament.settings) : {};
            return (settings.gameMode || 'INDIVIDUAL') === 'INDIVIDUAL';
        } catch (e) {
            return true;
        }
    }, [selectedRound]);

    // Filter registrations to ONLY show those participating in the selected round
    const roundParticipants = useMemo(() => {
        const registrations = allRegistrations || [];
        if (isEvent) {
            return [...registrations].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
        if (!selectedRound) return [];

        // Match registration to RoundParticipant entry to get current round's entry order
        const participantMap = new Map();
        selectedRound.participants?.forEach((p: any) => {
            participantMap.set(p.registrationId, p.createdAt);
        });

        return registrations
            .filter(reg => participantMap.has(reg.id))
            .sort((a, b) => {
                const dateA = new Date(participantMap.get(a.id) || 0).getTime();
                const dateB = new Date(participantMap.get(b.id) || 0).getTime();
                return dateA - dateB;
            });
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
                await updateRegistration(selectedReg.id, selectedRound.id, {
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

    const handleToggleSelection = (regId: string) => {
        setSelectedRegIds(prev =>
            prev.includes(regId)
                ? prev.filter(id => id !== regId)
                : [...prev, regId]
        );
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedRegIds(roundParticipants.map(r => r.id));
        } else {
            setSelectedRegIds([]);
        }
    };

    const handleGroupSelected = async () => {
        if (selectedRegIds.length < 2) {
            alert("그룹화하려면 최소 2명 이상의 참가자를 선택해야 합니다.");
            return;
        }

        const groupName = prompt("그룹(팀) 이름을 입력하세요 (선택)", "");
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${groupName ? `_name_${groupName}` : ''}`;

        try {
            setLoading(true);
            await updateEntryGroupId(selectedRoundId, selectedRegIds, groupId);
            setSelectedRegIds([]);
            triggerUpdate();
            alert("그룹화가 완료되었습니다.");
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUngroupSelected = async () => {
        if (selectedRegIds.length === 0) return;
        if (!confirm("선택한 인원들의 그룹을 해제하시겠습니까?")) return;
        try {
            setLoading(true);
            await updateEntryGroupId(selectedRoundId, selectedRegIds, null);
            setSelectedRegIds([]);
            triggerUpdate();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoGroup = async () => {
        if (!selectedRound) return;

        let teamSize = 1;
        try {
            const settings = selectedRound.tournament.settings ? JSON.parse(selectedRound.tournament.settings) : {};
            const mode = settings.gameMode || 'INDIVIDUAL';
            if (mode === 'TEAM_2') teamSize = 2;
            else if (mode === 'TEAM_3') teamSize = 3;
            else if (mode === 'TEAM_4') teamSize = 4;
            else if (mode === 'TEAM_5') teamSize = 5;
            else if (mode === 'TEAM_6') teamSize = 6;
        } catch (e) { }

        if (teamSize === 1) {
            alert("개인전은 자동 편성이 필요하지 않습니다.");
            return;
        }

        if (!confirm(`${teamSize}인조 기준으로 조를 자동 편성하시겠습니까? 현재 명단 순서대로 편성됩니다.`)) return;

        try {
            setLoading(true);
            await autoAssignEntryGroups(selectedRound.id, teamSize);
            triggerUpdate();
            alert("자동 편성이 완료되었습니다.");
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateGroup = async (regId: string, groupNumStr: string) => {
        try {
            const groupId = groupNumStr ? `group_${groupNumStr}` : null;
            await updateSingleRegistrationGroup(regId, groupId, selectedRound.id);
            triggerUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDelete = async (regId: string) => {
        const isChampOrLeague = tournamentType === 'CHAMP' || tournamentType === 'LEAGUE';

        const message = isChampOrLeague
            ? "이 회차에서만 제외하시겠습니까?\n(다른 회차의 기록과 대회 참가 정보는 유지됩니다.)"
            : "정말 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.";

        if (!confirm(message)) return;

        try {
            if (isChampOrLeague) {
                await removeFromRound(selectedRound.id, regId);
            } else {
                await deleteRegistration(regId);
            }
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
        const data = roundParticipants.map((reg, idx) => {
            const row: any = {};
            if (!isIndividualMode) {
                row['조'] = reg.entryGroupId ? reg.entryGroupId.replace('group_', '') : '';
            }
            row['순번'] = idx + 1 > maxParticipants && maxParticipants > 0 ? `대기 ${idx + 1 - maxParticipants}` : idx + 1;
            row['팀명'] = (reg.guestTeamName ?? reg.team?.name) || '개인';
            row['성함'] = reg.guestName ?? reg.user?.name;
            row['핸디캡'] = reg.handicap ?? reg.user?.handicap ?? 0;
            row['입금현황'] = reg.paymentStatus === 'PAID' ? '입금완료' : '입금대기';
            row['레인'] = (() => {
                const p = selectedRound.participants?.find((p: any) => p.registrationId === reg.id);
                return formatLane(p?.lane, p?.isManual);
            })();
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Participants");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const finalData = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        const isEventMode = tournamentType === 'EVENT';
        saveAs(finalData, isEventMode
            ? `참가자명단_${new Date().toLocaleDateString()}.xlsx`
            : `참가자명단_${selectedRound.roundNumber}회차_${new Date().toLocaleDateString()}.xlsx`);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert("엑셀 파일에 데이터가 없습니다.");
                    return;
                }

                // Map Korean columns to English keys
                const mappedData = data.map((row: any) => {
                    const groupVal = row['조'] || row['그룹'] || '';
                    return {
                        teamName: row['팀명'] || row['소속'] || '',
                        name: row['이름'] || row['성함'] || row['닉네임'],
                        entryGroupId: groupVal ? `group_${groupVal}` : undefined,
                        handicap: Number(row['핸디'] || row['핸디캡'] || 0),
                        paymentStatus: row['현황'] || row['입금현황'] || 'PENDING',
                        laneDisplay: row['레인'] || row['레인번호'] || ''
                    };
                }).filter(p => p.name); // Final validation: must have name

                if (mappedData.length === 0) {
                    alert("올바른 형식의 데이터가 없습니다. (이름 컬럼 필수)");
                    return;
                }

                if (!confirm(`${mappedData.length}명의 데이터를 업로드하시겠습니까? (이름과 팀명이 같으면 기존 참가자 정보와 연결됩니다. 이름이 같고 팀명이 다르면 새로운 참가자로 등록됩니다.)`)) return;

                setLoading(true);
                const res = await bulkRegisterParticipants(selectedRound.id, mappedData);

                if (res.success) {
                    alert(`업로드 완료!\n신규 등록: ${res.createdTitle}명\n기존 수정: ${res.updatedTitle}명${res.errors.length > 0 ? `\n오류: ${res.errors.length}건` : ''}`);
                    triggerUpdate();
                }
            } catch (err: any) {
                console.error(err);
                alert("엑셀 파싱 중 오류가 발생했습니다: " + err.message);
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const downloadTemplate = () => {
        const data = [
            { '조': 1, '순번': 1, '팀명': '볼링팀A', '이름': '홍길동', '핸디': 0, '현황': '입금대기', '레인': '1-1' },
            { '조': 1, '순번': 2, '팀명': '볼링팀A', '이름': '김철수', '핸디': 10, '현황': '입금완료', '레인': '1-2' },
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const finalData = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(finalData, `참가자등록_양식.xlsx`);
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
                                {tournamentType === 'EVENT' ? '참가 명단' : `${r.roundNumber}회차 명단`}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50 p-5 rounded-2xl border-2 border-slate-200 gap-4 mt-6">
                <div>
                    {(!hideRoundTabs || isManager) && (
                        <h3 className="text-xl font-black text-slate-800">
                            {isManager ? (isEvent ? '참가자 명단' : '참가자 명단 관리') : '참가자 명단'}
                            {tournamentType !== 'EVENT' && (
                                <span className="text-primary text-base ml-2">({selectedRound?.roundNumber}회차)</span>
                            )}
                        </h3>
                    )}
                    <p className="text-xs font-bold text-slate-500 mt-1">
                        현재 참여 인원: <span className="text-slate-900">{roundParticipants.length}명</span>
                    </p>
                </div>
                {isManager && (
                    <div className="flex flex-wrap gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleExcelUpload}
                            accept=".xlsx, .xls"
                            className="hidden"
                        />
                        <button
                            onClick={downloadTemplate}
                            className="btn bg-white border-2 border-slate-300 text-slate-600 h-12 px-4 font-black hover:bg-slate-50 transition-all text-xs"
                            title="양식 다운로드"
                        >
                            📄 양식
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading}
                            className="btn bg-white border-2 border-green-600 text-green-600 h-12 px-5 font-black hover:bg-green-50 transition-all text-xs flex items-center gap-1"
                        >
                            📊 엑셀 업로드
                        </button>
                        {!isIndividualMode && (
                            <button
                                onClick={handleAutoGroup}
                                className="btn bg-purple-600 text-white h-12 px-5 font-black hover:bg-purple-700 shadow-lg shadow-purple-600/20 text-xs flex items-center gap-1"
                            >
                                🔄 팀 자동 편성
                            </button>
                        )}
                        <button
                            onClick={openRegisterModal}
                            className="btn btn-primary h-12 px-6 font-black shadow-lg shadow-primary/20 flex items-center gap-2"
                        >
                            <span className="text-lg">+</span> 수동 등록
                        </button>
                    </div>
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
                                    {!isIndividualMode && <th className="border-2 border-slate-900 p-1 font-black" style={{ width: '70px' }}>조</th>}
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

                                    const handicap = reg.handicap ?? reg.user?.handicap ?? '0';
                                    const isPaid = reg.paymentStatus === 'PAID';

                                    return (
                                        <tr
                                            key={reg.id}
                                            className="text-center h-12 hover:bg-blue-50 transition-colors"
                                            style={{ backgroundColor: bgColor }}
                                        >
                                            {!isIndividualMode && (
                                                <td className="border-2 border-slate-900 p-1">
                                                    <input
                                                        type="number"
                                                        key={`${reg.id}-${reg.entryGroupId}`}
                                                        defaultValue={reg.entryGroupId ? reg.entryGroupId.replace('group_', '') : ''}
                                                        onBlur={(e) => handleUpdateGroup(reg.id, e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                (e.target as HTMLInputElement).blur();
                                                            }
                                                        }}
                                                        className="w-full h-8 text-center border-0 bg-transparent font-black text-blue-600 focus:bg-blue-50 focus:outline-none"
                                                        placeholder="-"
                                                    />
                                                </td>
                                            )}
                                            <td className={`border-2 border-slate-900 p-1 font-black ${isWaitlisted ? 'text-amber-600' : ''}`}>
                                                {isWaitlisted ? `대기 ${waitNumber}` : idx + 1}
                                            </td>
                                            <td className="border-2 border-slate-900 p-1 truncate px-4">
                                                {(reg.guestTeamName ?? reg.team?.name) || '개인'}
                                            </td>
                                            <td className="border-2 border-slate-900 p-1 truncate px-4 font-black">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span>{reg.guestName ?? reg.user?.name}</span>
                                                    {!isIndividualMode && reg.entryGroupId && (
                                                        <span className="text-[9px] bg-slate-800 text-white px-1.5 py-0.5 rounded leading-none">
                                                            조: {reg.entryGroupId.replace('group_', '')}
                                                        </span>
                                                    )}
                                                </div>
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

            {/* Manager-only: List of tournament registrants NOT in this round (Deleted as requested) */}
        </div>
    );
}
