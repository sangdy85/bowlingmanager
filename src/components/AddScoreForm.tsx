
'use client';

import { useActionState, useState } from "react";
import { addScore, addBulkScores } from "@/app/actions/score";
import Link from "next/link";
import { GeminiParsedRow } from "@/app/actions/gemini-score";

import ExcelUpload from "./ExcelUpload";
import GeminiScoreUpload from "./GeminiScoreUpload";

interface Team {
    id: string;
    name: string;
    members: { id: string; name: string }[];
}

interface AddScoreFormProps {
    teams: Team[];
    currentUserId: string;
}

export default function AddScoreForm({ teams, currentUserId }: AddScoreFormProps) {
    const [mode, setMode] = useState<'manual' | 'excel' | 'ocr'>('manual');
    const [state, dispatch, isPending] = useActionState(addScore, null);

    // OCR State
    const [ocrRows, setOcrRows] = useState<GeminiParsedRow[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ success: boolean; message: string } | null>(null);

    // Shared Form State
    const [gameCount, setGameCount] = useState(3);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id || "");
    const [selectedUserId, setSelectedUserId] = useState(currentUserId);
    const [gameType, setGameType] = useState("정기전");
    const [memo, setMemo] = useState("");

    const GAME_TYPES = ["정기전", "벙개", "상주", "교류전", "기타"];

    const currentTeam = teams.find(t => t.id === selectedTeamId);
    const currentTeamMembers = currentTeam?.members || [];

    const handleGameCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setGameCount(Number(e.target.value));
    };

    const handleBulkSave = async () => {
        setIsSaving(true);
        setSaveMessage(null);
        try {
            const commonData = {
                teamId: selectedTeamId,
                gameType,
                date,
                memo
            };

            const result = await addBulkScores(commonData, ocrRows);
            setSaveMessage(result);
            if (result.success) {
                setOcrRows([]);
            }
        } catch (e) {
            console.error(e);
            setSaveMessage({ success: false, message: "저장 중 오류가 발생했습니다." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: mode === 'ocr' ? '800px' : '500px', transition: 'max-width 0.3s' }}>
                <h1 className="text-center mb-6" style={{ fontSize: '1.5rem' }}>점수 기록</h1>

                {/* Common Fields */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex flex-col gap-2">
                        <label className="label">날짜</label>
                        <input
                            type="date"
                            className="input"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="label">게임 분류</label>
                        <select
                            className="input"
                            value={gameType}
                            onChange={(e) => setGameType(e.target.value)}
                        >
                            {GAME_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                    <label className="label">팀 선택</label>
                    <select
                        className="input"
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                    >
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-2 mb-6">
                    <label className="label">메모 (선택)</label>
                    <input
                        type="text"
                        className="input"
                        placeholder="예: 정기전, 연습 등"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                    />
                </div>

                {/* Tabs */}
                <div className="flex border-b mb-6">
                    <button
                        className={`flex-1 pb-2 text-sm font-bold ${mode === 'manual' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                        onClick={() => setMode('manual')}
                    >
                        직접 입력
                    </button>
                    <button
                        className={`flex-1 pb-2 text-sm font-bold ${mode === 'excel' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                        onClick={() => setMode('excel')}
                    >
                        엑셀 업로드
                    </button>
                    <button
                        className={`flex-1 pb-2 text-sm font-bold ${mode === 'ocr' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                        onClick={() => setMode('ocr')}
                    >
                        ⚡ AI 자동 분석
                    </button>
                </div>

                {/* Mode Specific Content */}
                {mode === 'excel' ? (
                    <ExcelUpload />
                ) : mode === 'ocr' ? (
                    <div className="flex flex-col gap-4">
                        <GeminiScoreUpload
                            knownMembers={currentTeamMembers.map(m => m.name)}
                            rows={ocrRows}
                            setRows={setOcrRows}
                        />

                        {saveMessage && (
                            <div className={`p-3 text-sm rounded-lg text-center font-bold ${saveMessage.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {saveMessage.message}
                            </div>
                        )}

                        <div className="flex gap-2 mt-4">
                            <Link href="/dashboard" className="btn btn-secondary w-full">취소</Link>
                            <button
                                onClick={handleBulkSave}
                                className="btn btn-primary w-full"
                                disabled={isSaving || ocrRows.length === 0}
                            >
                                {isSaving ? '저장 중...' : `${ocrRows.length}건 일괄 저장`}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Manual Input Form */
                    <form action={dispatch} className="flex flex-col gap-4">
                        {/* Hidden inputs to pass common state to server action */}
                        <input type="hidden" name="date" value={date} />
                        <input type="hidden" name="gameType" value={gameType} />
                        <input type="hidden" name="teamId" value={selectedTeamId} />
                        <input type="hidden" name="memo" value={memo} />

                        <div className="flex flex-col gap-2">
                            <label className="label">대상 멤버</label>
                            <select
                                name="targetUserId"
                                className="input"
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                            >
                                {currentTeamMembers.map(member => (
                                    <option key={member.id} value={member.id}>
                                        {member.name} {member.id === currentUserId ? '(나)' : ''}
                                    </option>
                                ))}
                                <option value="guest">직접 입력 (비회원)</option>
                            </select>
                        </div>

                        {selectedUserId === 'guest' && (
                            <div className="flex flex-col gap-2">
                                <label className="label">비회원 이름</label>
                                <input
                                    type="text"
                                    name="guestName"
                                    className="input"
                                    placeholder="이름을 입력하세요"
                                    required
                                />
                            </div>
                        )}

                        <div className="flex gap-4">
                            <div className="w-full">
                                <label className="label">게임 수</label>
                                <select
                                    className="input"
                                    value={gameCount}
                                    onChange={handleGameCountChange}
                                >
                                    {[...Array(10)].map((_, i) => (
                                        <option key={i + 1} value={i + 1}>{i + 1}게임</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="label">점수 입력</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[...Array(gameCount)].map((_, i) => (
                                    <input
                                        key={i}
                                        type="number"
                                        name="score"
                                        className="input text-center"
                                        placeholder={`${i + 1}G`}
                                        min="0"
                                        max="300"
                                        required
                                    />
                                ))}
                            </div>
                        </div>

                        {state?.success && (
                            <div className="p-3 mb-4 text-sm text-green-700 bg-green-100 rounded-lg text-center font-bold">
                                {state.message}
                            </div>
                        )}
                        {state?.success === false && (
                            <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg text-center font-bold">
                                {state.message}
                            </div>
                        )}

                        <div className="flex gap-2 mt-4">
                            <Link href="/dashboard" className="btn btn-secondary w-full">취소</Link>
                            <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                                {isPending ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
