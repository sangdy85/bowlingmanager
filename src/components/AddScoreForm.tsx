
'use client';

import { useActionState, useState, useEffect } from "react";
import { addScore, addBulkScores } from "@/app/actions/score";
import Link from "next/link";
import { GeminiParsedRow } from "@/app/actions/gemini-score";

import dynamic from 'next/dynamic';

const ExcelUpload = dynamic(() => import("./ExcelUpload"), { ssr: false });
import GeminiScoreUpload from "./GeminiScoreUpload";
import styles from "./AddScoreForm.module.css";

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
    const [date, setDate] = useState(""); // Initialize with empty string to prevent hydration mismatch
    const [defaultDate, setDefaultDate] = useState("");
    
    useEffect(() => {
        // Set the date on the client side after hydration
        setDefaultDate(new Date().toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        setDate(defaultDate);
    }, [defaultDate]);

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
        <div className={styles.page}>
            <section className={styles.shell}>
                <header className={styles.header}>
                    <h1 className={styles.title}>점수 기록</h1>
                    <p className={styles.subtitle}>직접 입력, 엑셀 업로드 또는 AI 자동 분석으로 기록을 저장합니다.</p>
                </header>

                {/* Common Fields */}
                <div className={styles.commonGrid}>
                    <div className={styles.field}>
                        <label className="label">날짜</label>
                        <input
                            type="date"
                            className="input"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className={styles.field}>
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

                <div className={styles.field + " " + styles.full}>
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

                <div className={styles.field + " " + styles.full}>
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
                <div className={styles.tabs}>
                    <button
                        className={[styles.tab, mode === 'manual' ? styles.tabActive : ''].filter(Boolean).join(' ')}
                        onClick={() => setMode('manual')}
                    >
                        직접 입력
                    </button>
                    <button
                        className={[styles.tab, mode === 'excel' ? styles.tabActive : ''].filter(Boolean).join(' ')}
                        onClick={() => setMode('excel')}
                    >
                        엑셀 업로드
                    </button>
                    <button
                        className={[styles.tab, mode === 'ocr' ? styles.tabActive : ''].filter(Boolean).join(' ')}
                        onClick={() => setMode('ocr')}
                    >
                        ⚡ AI 자동 분석
                    </button>
                </div>

                {/* Mode Specific Content */}
                {mode === 'excel' ? (
                    <div className={styles.modePanel}><ExcelUpload teamId={selectedTeamId} /></div>
                ) : mode === 'ocr' ? (
                    <div className={styles.modePanel}>
                        <GeminiScoreUpload
                            knownMembers={currentTeamMembers.map(m => m.name)}
                            rows={ocrRows}
                            setRows={setOcrRows}
                        />

                        {saveMessage && (
                            <div className={[styles.message, saveMessage.success ? styles.success : styles.error].join(' ')}>
                                {saveMessage.message}
                            </div>
                        )}

                        <div className={styles.actions}>
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
                    <form action={dispatch} className={styles.modePanel}>
                        {/* Hidden inputs to pass common state to server action */}
                        <input type="hidden" name="date" value={date} />
                        <input type="hidden" name="gameType" value={gameType} />
                        <input type="hidden" name="teamId" value={selectedTeamId} />
                        <input type="hidden" name="memo" value={memo} />

                        <div className={styles.field}>
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
                            <div className={styles.field}>
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

                        <div className={styles.field}>
                            <label className="label">점수 입력</label>
                            <div className={styles.scoreGrid}>
                                {[...Array(gameCount)].map((_, i) => (
                                    <input
                                        key={i}
                                        type="number"
                                        name="score"
                                        className="input text-center"
                                        placeholder={`${i + 1}G`}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        min="0"
                                        max="300"
                                        required
                                    />
                                ))}
                            </div>
                        </div>

                        {state?.success && (
                            <div className={[styles.message, styles.success].join(" ")}>
                                {state.message}
                            </div>
                        )}
                        {state?.success === false && (
                            <div className={[styles.message, styles.error].join(" ")}>
                                {state.message}
                            </div>
                        )}

                        <div className={styles.actions}>
                            <Link href="/dashboard" className="btn btn-secondary w-full">취소</Link>
                            <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                                {isPending ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
