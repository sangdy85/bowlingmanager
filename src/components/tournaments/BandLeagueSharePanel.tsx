'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    disconnectBand,
    getAvailableBands,
    getBandConnectionStatus,
    getBandShareHistory,
    previewLeagueWeeklyBandPost,
    retryBandShare,
    shareLeagueWeeklyResultToBand,
} from "@/app/actions/band-actions";

type BandItem = {
    bandKey: string;
    name: string;
    cover: string | null;
    memberCount: number | null;
};

type HistoryItem = {
    id: string;
    bandName: string;
    tournamentId: string | null;
    roundNumber: number | null;
    status: string;
    postKey: string | null;
    errorMessage: string | null;
    createdAt: string;
};

type Status = {
    configured: boolean;
    connected: boolean;
    expiresAt: string | null;
};

export default function BandLeagueSharePanel({
    tournamentId,
    tournamentName,
    selectedRound,
}: {
    tournamentId: string;
    tournamentName: string;
    selectedRound: number;
}) {
    const [status, setStatus] = useState<Status | null>(null);
    const [bands, setBands] = useState<BandItem[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [selectedBandKey, setSelectedBandKey] = useState("");
    const [draft, setDraft] = useState("");
    const [showPreview, setShowPreview] = useState(false);
    const [doPush, setDoPush] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const selectedBand = useMemo(
        () => bands.find((band) => band.bandKey === selectedBandKey) || null,
        [bands, selectedBandKey],
    );

    const loadHistory = useCallback(async () => {
        try {
            setHistory(await getBandShareHistory(8));
        } catch {
            setHistory([]);
        }
    }, []);

    const loadConnection = useCallback(async () => {
        setLoading("status");

        try {
            const nextStatus = await getBandConnectionStatus();
            setStatus(nextStatus);

            if (nextStatus.connected) {
                const available = await getAvailableBands();
                setBands(available);

                setSelectedBandKey((current) => {
                    if (
                        current
                        && available.some((band) => band.bandKey === current)
                    ) {
                        return current;
                    }

                    return available[0]?.bandKey || "";
                });
            } else {
                setBands([]);
                setSelectedBandKey("");
            }

            await loadHistory();
        } catch {
            setMessage("BAND 연결 상태를 확인하지 못했습니다.");
        } finally {
            setLoading(null);
        }
    }, [loadHistory]);

    useEffect(() => {
        void loadConnection();
    }, [loadConnection]);

    const startConnect = () => {
        const returnTo = window.location.pathname + window.location.search;
        window.location.href =
            `/api/integrations/band/connect?returnTo=${encodeURIComponent(returnTo)}`;
    };

    const handleDisconnect = async () => {
        if (!window.confirm("연결된 BAND 계정을 해제할까요?")) return;

        setLoading("disconnect");
        setMessage(null);

        try {
            await disconnectBand();
            setStatus((current) => current
                ? { ...current, connected: false, expiresAt: null }
                : current);
            setBands([]);
            setSelectedBandKey("");
            setShowPreview(false);
            setMessage("BAND 연결을 해제했습니다.");
        } catch {
            setMessage("BAND 연결 해제에 실패했습니다.");
        } finally {
            setLoading(null);
        }
    };

    const handlePreview = async () => {
        setLoading("preview");
        setMessage(null);

        try {
            const preview = await previewLeagueWeeklyBandPost(
                tournamentId,
                selectedRound,
            );
            setDraft(preview.content);
            setShowPreview(true);
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "BAND 공유 미리보기를 만들지 못했습니다.",
            );
        } finally {
            setLoading(null);
        }
    };

    const handlePublish = async () => {
        if (!selectedBandKey || !draft.trim()) {
            setMessage("게시할 BAND와 본문을 확인해주세요.");
            return;
        }

        setLoading("publish");
        setMessage(null);

        try {
            const result = await shareLeagueWeeklyResultToBand({
                tournamentId,
                roundNumber: selectedRound,
                bandKey: selectedBandKey,
                content: draft,
                doPush,
            });

            setMessage(result.message);

            if (result.success) {
                setShowPreview(false);
                await loadHistory();
            }
        } catch {
            setMessage("BAND 게시 요청을 완료하지 못했습니다.");
        } finally {
            setLoading(null);
        }
    };

    const handleRetry = async (historyId: string) => {
        setLoading(`retry:${historyId}`);
        setMessage(null);

        try {
            const result = await retryBandShare(historyId);
            setMessage(result.message);

            if (result.success) {
                await loadHistory();
            }
        } catch {
            setMessage("BAND 재게시 요청을 완료하지 못했습니다.");
        } finally {
            setLoading(null);
        }
    };

    return (
        <section className="mt-8 rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black text-slate-900">
                            BAND 공유
                        </h3>
                        {status?.connected && (
                            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">
                                연결됨
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-600">
                        {tournamentName} {selectedRound}주차 결과를 확인한 뒤 직접 게시합니다.
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                        기존 결과표 이미지 4종 다운로드 기능은 그대로 유지됩니다.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {status?.connected ? (
                        <>
                            <button
                                type="button"
                                onClick={handlePreview}
                                disabled={Boolean(loading)}
                                className="btn min-h-11 border-2 border-black bg-emerald-600 px-4 font-black text-white hover:bg-emerald-700"
                            >
                                {loading === "preview"
                                    ? "미리보기 생성 중..."
                                    : "🟢 BAND에 공유"}
                            </button>
                            <button
                                type="button"
                                onClick={handleDisconnect}
                                disabled={Boolean(loading)}
                                className="btn min-h-11 border border-slate-300 bg-white px-3 text-sm font-bold text-slate-600"
                            >
                                연결 해제
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={startConnect}
                            disabled={
                                Boolean(loading)
                                || status?.configured === false
                            }
                            className="btn min-h-11 border-2 border-black bg-[#00c73c] px-4 font-black text-white hover:brightness-95 disabled:opacity-50"
                        >
                            BAND 계정 연결
                        </button>
                    )}
                </div>
            </div>

            {status?.configured === false && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                    서버에 BAND API 환경변수가 아직 설정되지 않았습니다.
                </div>
            )}

            {message && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">
                    {message}
                </div>
            )}

            {status?.connected && bands.length === 0 && loading !== "status" && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-600">
                    연결된 계정에서 게시 가능한 BAND 목록을 찾지 못했습니다.
                </div>
            )}

            {showPreview && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row">
                        <label className="flex-1">
                            <span className="mb-1 block text-xs font-black text-slate-600">
                                게시할 BAND
                            </span>
                            <select
                                value={selectedBandKey}
                                onChange={(event) => setSelectedBandKey(event.target.value)}
                                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800"
                            >
                                {bands.map((band) => (
                                    <option
                                        key={band.bandKey}
                                        value={band.bandKey}
                                    >
                                        {band.name}
                                        {band.memberCount !== null
                                            ? ` (${band.memberCount}명)`
                                            : ""}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700">
                            <input
                                type="checkbox"
                                checked={doPush}
                                onChange={(event) => setDoPush(event.target.checked)}
                            />
                            BAND 멤버에게 새 글 알림 요청
                        </label>
                    </div>

                    <label className="mt-4 block">
                        <span className="mb-1 block text-xs font-black text-slate-600">
                            게시글 미리보기 · 수정 가능
                        </span>
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            rows={18}
                            maxLength={10000}
                            className="w-full resize-y rounded-xl border-2 border-slate-200 bg-white p-3 text-sm font-medium leading-6 text-slate-800 focus:border-emerald-500 focus:outline-none"
                        />
                    </label>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs font-semibold text-slate-500">
                            {selectedBand
                                ? `게시 대상: ${selectedBand.name}`
                                : "게시할 BAND를 선택하세요."}
                            {" · "}
                            {draft.length.toLocaleString()} / 10,000자
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowPreview(false)}
                                disabled={loading === "publish"}
                                className="btn border border-slate-300 bg-white px-4 font-bold text-slate-600"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handlePublish}
                                disabled={
                                    loading === "publish"
                                    || !selectedBandKey
                                    || !draft.trim()
                                }
                                className="btn border-2 border-black bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700"
                            >
                                {loading === "publish"
                                    ? "게시 중..."
                                    : "최종 확인 후 게시"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {history.length > 0 && (
                <div className="mt-5">
                    <h4 className="text-sm font-black text-slate-700">
                        최근 BAND 게시 이력
                    </h4>
                    <div className="mt-2 grid gap-2">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-slate-800">
                                        {item.bandName}
                                        {item.roundNumber
                                            ? ` · ${item.roundNumber}주차`
                                            : ""}
                                    </p>
                                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                        {new Date(item.createdAt).toLocaleString("ko-KR")}
                                        {" · "}
                                        {item.status === "SUCCESS"
                                            ? "게시 성공"
                                            : "게시 실패"}
                                    </p>
                                    {item.errorMessage && (
                                        <p className="mt-1 text-xs font-bold text-red-600">
                                            {item.errorMessage}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleRetry(item.id)}
                                    disabled={Boolean(loading)}
                                    className="btn btn-sm border border-slate-300 bg-slate-50 font-black text-slate-700"
                                >
                                    {loading === `retry:${item.id}`
                                        ? "재게시 중..."
                                        : "재게시"}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
