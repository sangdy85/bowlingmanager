'use client';

import { useState, useRef, useEffect } from 'react';
import { analyzeScoreboardWithGemini, GeminiParsedRow } from '@/app/actions/gemini-score';
import { parseReviewedScoreImport, REVIEWED_SCORE_MAX_BYTES } from '@/lib/reviewed-score-import';
import type { ScoreImageCrop } from '@/lib/score-image-crop';
import { analyzeScoreboardAutomatically } from '@/lib/scoreboard-auto-analysis';
import ScorePhotoCrop from './ScorePhotoCrop';
import styles from './GeminiScoreUpload.module.css';

interface GeminiScoreUploadProps {
    knownMembers: string[];
    rows: GeminiParsedRow[];
    setRows: (rows: GeminiParsedRow[]) => void;
    disabled?: boolean;
    onAnalyzingChange?: (analyzing: boolean) => void;
}

export default function GeminiScoreUpload({ knownMembers, rows, setRows, disabled = false, onAnalyzingChange }: GeminiScoreUploadProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStage, setAnalysisStage] = useState('점수판 분석 중…');
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);
    const [showQuotaModal, setShowQuotaModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const reviewedFileRef = useRef<HTMLInputElement>(null);
    const selectedPhoto = useRef<File | null>(null);
    const [gameCount, setGameCount] = useState(0);
    const analysisBusy = useRef(false);
    const [photo, setPhoto] = useState<File | null>(null);
    const [crop, setCrop] = useState<ScoreImageCrop | undefined>();
    const requestVersion = useRef(0);
    useEffect(() => () => { requestVersion.current++; }, []);
    useEffect(() => {
        onAnalyzingChange?.(isAnalyzing);
        return () => onAnalyzingChange?.(false);
    }, [isAnalyzing, onAnalyzingChange]);

    const handleReviewedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || isAnalyzing || disabled) return;
        const version = ++requestVersion.current;
        setIsAnalyzing(true);
        setMessage(null);
        try {
            if (file.size > REVIEWED_SCORE_MAX_BYTES) throw new Error('점수 파일은 1MB 이하여야 합니다.');
            const parsed = parseReviewedScoreImport(await file.text(), knownMembers);
            if (version !== requestVersion.current) return;
            setRows(parsed.rows);
            setPhoto(null); selectedPhoto.current = null; setCrop(undefined);
            setMessage({ type: 'success', text: `${parsed.rows.length}명 불러오기 완료 · 팀원 ${parsed.matchedCount}명 일치${parsed.unmatchedNames.length ? ` · 비회원 ${parsed.unmatchedNames.length}명 확인 필요` : ''}. 날짜와 팀을 확인한 뒤 저장해주세요.` });
        } catch (error) {
            if (version === requestVersion.current) setMessage({ type: 'error', text: error instanceof Error ? error.message : '점수 파일을 불러오지 못했습니다.' });
        } finally {
            if (version === requestVersion.current) {
                setIsAnalyzing(false);
                if (reviewedFileRef.current) reviewedFileRef.current.value = '';
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || isAnalyzing || disabled) return;
        selectedPhoto.current = file;
        setPhoto(file); setCrop(undefined); setGameCount(0); setRows([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        void runAnalysis(file, { gameCount: 0 });
    };

    const runAnalysis = async (file: File, options: { gameCount: number; crop?: ScoreImageCrop; forceRefresh?: boolean }) => {
        if (analysisBusy.current || isAnalyzing || disabled) return;
        analysisBusy.current = true;
        const version = ++requestVersion.current;
        setMessage(null);
        setShowQuotaModal(false);
        setIsAnalyzing(true);
        setAnalysisStage(options.forceRefresh ? '점수를 다시 분석하고 있습니다…' : '점수판을 자동 분석하고 있습니다…');

        try {
            const analysis = await analyzeScoreboardAutomatically(async (engine, automaticCrop) => {
                const formData = new FormData();
                formData.append('image', file);
                formData.append('knownMembers', JSON.stringify(knownMembers));
                formData.append('engine', String(engine));
                formData.append('gameCount', String(options.gameCount));
                if (automaticCrop ?? options.crop) formData.append('crop', JSON.stringify(automaticCrop ?? options.crop));
                if (options.forceRefresh) formData.append('forceRefresh', 'true');
                return analyzeScoreboardWithGemini(formData);
            }, {
                expectedGameCount: options.gameCount,
                knownMembers,
                preciseOnly: options.forceRefresh,
                isCurrent: () => version === requestVersion.current,
                onPrecision: () => setAnalysisStage('읽히지 않은 점수를 정밀 분석으로 보완하고 있습니다…'),
            });
            const { result, coverage } = analysis;
            if (version !== requestVersion.current) return;

            if (result.success && result.data) {
                if (!options.forceRefresh && !options.crop && analysis.suggestedCrop) setCrop(analysis.suggestedCrop);
                setRows(result.data);
                const missing = result.data.reduce((sum, row) => sum + (row.scoreSlots?.filter(value => value === null).length || 0), 0);
                setMessage({ type: missing || analysis.precisionIssue ? 'warning' : 'success', text: `${result.data.length}명 · 점수 칸 인식률 ${Math.floor(coverage.ratio * 100)}% (${coverage.valid}/${coverage.total}칸)${analysis.engine === 3 ? ' · 정밀 분석 완료' : ''}${missing ? ` · 확인할 빈칸 ${missing}개` : ''}. 원본과 대조한 뒤 저장해주세요.${analysis.precisionIssue ? ` ${analysis.precisionIssue} 기본 결과를 확인해주세요.` : ''}${result.message?.includes('일부') ? ` ${result.message}` : ''}` });
            } else if (result.errorType === 'QUOTA') {
                setShowQuotaModal(true);
                setMessage({ type: 'error', text: result.message || '사진 분석 한도에 도달했습니다.' });
            } else {
                setMessage({ type: 'error', text: result.message?.includes('게임 수를 읽지 못') ? '게임 수를 읽지 못했습니다. ‘원본 사진 · 보조 기능’에서 게임 수를 지정한 뒤 다시 분석해주세요.' : result.message || "분석에 실패했습니다." });
            }
        } catch (err) {
            if (version !== requestVersion.current) return;
            console.error(err);
            setMessage({ type: 'error', text: "이미지 처리 중 오류가 발생했습니다." });
        } finally {
            analysisBusy.current = false;
            if (version === requestVersion.current) {
                setIsAnalyzing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const removeRow = (index: number) => {
        setRows(rows.filter((_, i) => i !== index));
    };

    return (
        <div className={styles.root}>
            {/* Header / Upload Tool */}
            <div className={styles.toolbar}>
                <div className="flex items-center gap-3">
                    <span className="text-3xl">⚡</span>
                    <div>
                        <h3 className="font-bold text-base leading-none mb-1">AI 자동 분석</h3>
                        <p className="text-xs text-muted-foreground">사진을 올리면 사용 가능한 무료 분석 서비스로 자동 처리합니다.</p>
                    </div>
                </div>

                <div className={styles.controls}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                    />
                    <button
                        type="button" onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || isAnalyzing}
                        className="btn btn-primary btn-md gap-2 shadow-md hover:scale-105 transition-transform"
                    >
                        {isAnalyzing ? (
                            <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                            <span className="text-lg">📸</span>
                        )}
                        <span>{isAnalyzing ? '분석 중…' : '사진 올리기'}</span>
                    </button>
                    {photo && <button type="button" disabled={disabled || isAnalyzing} onClick={() => selectedPhoto.current && runAnalysis(selectedPhoto.current, { gameCount, crop, forceRefresh: true })} className="btn btn-outline btn-md">다시 분석</button>}
                </div>
            </div>
            {photo && !isAnalyzing && <p className={styles.hint}>빠지거나 잘못 읽힌 점수는 직접 수정하거나 다시 분석해주세요. 다시 분석하면 자동으로 읽은 결과로 바뀝니다.</p>}
            {photo && !isAnalyzing && <p className={styles.hint}>인식률은 읽힌 점수 칸의 비율이며 숫자의 정확도를 보장하지 않습니다. 누락된 선수도 원본과 함께 확인해주세요.</p>}
            <details className={styles.tools}>
                <summary>{photo ? '원본 사진 · 보조 기능' : '검토 점수 파일 불러오기'}</summary>
                <div className={styles.toolsContent}>
                    {photo && <>
                        <ScorePhotoCrop file={photo} value={crop} disabled={isAnalyzing || disabled} onChange={setCrop} />
                        <p className={styles.hint}>원본 확인이나 영역 조정이 필요할 때만 사용하세요. 조정한 영역은 ‘다시 분석’에 적용됩니다.</p>
                        <label>게임 수를 읽지 못한 경우
                            <select aria-label="게임 수" value={gameCount} disabled={disabled || isAnalyzing} onChange={e => setGameCount(Number(e.target.value))} className="select">
                                <option value={0}>자동</option>
                                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}게임</option>)}
                            </select>
                        </label>
                    </>}
                    <input type="file" ref={reviewedFileRef} onChange={handleReviewedFile} accept="application/json,.json" hidden />
                    <button type="button" onClick={() => reviewedFileRef.current?.click()} disabled={disabled || isAnalyzing} className="btn btn-outline btn-md">검토 점수 불러오기</button>
                </div>
            </details>

            {/* Analysis Result Area */}
            <div className="border rounded-xl bg-card overflow-hidden shadow-sm flex flex-col">
                <div className={styles.resultHeader}>
                    <div>이름</div>
                    <div>게임별 점수 · 0~300</div>
                    <div></div>
                </div>

                <div className={styles.rows}>
                    {isAnalyzing && (
                        <div className={styles.overlay} role="status">
                            <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
                            <p className="font-bold text-lg">{analysisStage}</p>
                            <p className="text-sm text-muted-foreground mt-1">입력할 점수를 준비하고 있습니다.<br />잠시만 기다려주세요.</p>
                        </div>
                    )}

                    {rows.length === 0 && !isAnalyzing ? (
                        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/60 space-y-3">
                            <div className="text-6xl grayscale opacity-30">📸</div>
                            <p className="text-sm font-medium">분석할 사진을 업로드해 주세요.</p>
                        </div>
                    ) : (
                        rows.map((row, idx) => (
                            <div key={idx} className={styles.row}>
                                <RowInput
                                    member={row.memberName}
                                    slots={row.scoreSlots ?? row.scores}
                                    warnings={row.reviewWarnings}
                                    disabled={disabled || isAnalyzing}
                                    knownMembers={knownMembers}
                                    onUpdate={(m, s) => {
                                        const newRows = [...rows];
                                        newRows[idx] = { ...row, memberName: m, scoreSlots: s, scores: s.every((value): value is number => value !== null) ? s : [] };
                                        setRows(newRows);
                                    }}
                                />
                                <button
                                    type="button" disabled={disabled || isAnalyzing}
                                    onClick={() => removeRow(idx)}
                                    className={styles.remove}
                                    title="행 삭제"
                                >
                                    ✕
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {message && (
                <div className={styles[message.type]} role={message.type === 'error' ? 'alert' : 'status'}>
                    {message.text}
                </div>
            )}

            {rows.length > 0 && !isAnalyzing && (
                <div className="flex flex-col gap-2 pt-2">
                    <div className="text-[10px] text-muted-foreground text-center italic">
                        ※ 실제 저장하려면 아래 하단의 &apos;저장&apos; 버튼을 눌러주세요.
                    </div>
                </div>
            )}

            <datalist id="known-members-datalist">
                {knownMembers.map((m: string) => (
                    <option key={m} value={m} />
                ))}
            </datalist>

            {/* Quota Exceeded Modal */}
            {showQuotaModal && (
                <div className={styles.modal} role="dialog" aria-modal="true" aria-label="무료 사용량 초과">
                    <div className={styles.dialog}>
                        <div className="text-center space-y-4">
                            <div className="text-4xl">🤖</div>
                            <h3 className="text-lg font-bold">무료 사용량 초과</h3>
                            <p className="text-muted-foreground text-sm">
                                {message?.text || '사진 분석 한도에 도달했습니다. 직접 입력하거나 다음 이용 기간에 다시 시도해주세요.'}
                            </p>
                            <button
                                onClick={() => setShowQuotaModal(false)}
                                className="btn btn-primary w-full"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function RowInput({ member, slots, warnings, disabled, knownMembers, onUpdate }: {
    member: string;
    slots: (number | null)[];
    warnings?: string[];
    disabled: boolean;
    knownMembers: string[];
    onUpdate: (m: string, s: (number | null)[]) => void;
}) {
    // Local state to allow free typing (including commas) without premature re-formatting
    const [localText, setLocalText] = useState(slots.map(value => value ?? '').join(', '));

    // Sync from props only if the incoming scores are semantically different from our current local input.
    // This prevents the "typed comma disappears" issue.
    useEffect(() => {
        const currentParsed = parseScoreInput(localText);
        const isDifferent = JSON.stringify(currentParsed) !== JSON.stringify(slots);
        if (isDifferent) {
            setLocalText(slots.map(value => value ?? '').join(', '));
        }
        // We omit localText from deps to prevent loop on typing, effectively syncing only on props change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slots]);

    return (
        <>
            <div className={styles.name}>
                <input
                    list="known-members-datalist"
                    className="input h-9 text-sm w-full bg-muted/20 border-transparent focus:border-primary/30 transition-colors"
                    value={member}
                    aria-label="선수 이름" disabled={disabled}
                    onChange={(e) => onUpdate(e.target.value, slots)}
                    placeholder="이름"
                />
                {!knownMembers.includes(member) && member && member !== 'Unknown' && (
                    <span className={styles.guest}>
                        비회원
                    </span>
                )}
            </div>
            <div className={styles.scoreSection}>
            <div className={styles.games}>
                {slots.map((value, index) => <label key={index}>{index + 1}게임
                    <input aria-label={`${member} ${index + 1}게임 점수`} aria-invalid={value === null} className="input" inputMode="numeric" disabled={disabled}
                        placeholder="확인" value={localText.split(',')[index]?.trim() ?? ''}
                        onChange={e => { const parts=localText.split(','); parts[index]=e.target.value; const next=parts.join(','); setLocalText(next); onUpdate(member,parseScoreInput(next)); }} />
                </label>)}
            </div>
            {slots.includes(null) && <p className={styles.hint}>빈칸을 원본과 대조해주세요. 게임 순서는 유지됩니다.</p>}
            {!!warnings?.length && <details className={styles.warnings}><summary>인식 원문·확인 안내</summary>{warnings.map((warning, index) => <p key={index}>{warning}</p>)}</details>}
            </div>
        </>
    );
}

function parseScoreInput(text: string): (number | null)[] {
    return text.split(',').map(value => /^\d{1,3}$/.test(value.trim()) && Number(value.trim()) <= 300 ? Number(value.trim()) : null);
}
