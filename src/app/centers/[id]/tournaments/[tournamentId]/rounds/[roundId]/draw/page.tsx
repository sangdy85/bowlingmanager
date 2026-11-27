'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { drawLane } from '@/app/actions/round-actions';
import { formatLane } from '@/lib/tournament-utils';
import confetti from 'canvas-confetti';

export default function LaneDrawPage() {
    const router = useRouter();
    const params = useParams();
    const { id: centerId, tournamentId, roundId } = params as { id: string, tournamentId: string, roundId: string };

    const [isSpinning, setIsSpinning] = useState(false);
    const [resultLane, setResultLane] = useState<number | null>(null);
    const [rotation, setRotation] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [availableLanes, setAvailableLanes] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchInitialData() {
            try {
                const response = await fetch(`/api/rounds/${roundId}/available-lanes`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.lanes && data.lanes.length > 0) {
                        setAvailableLanes(data.lanes);
                    } else {
                        // Fallback UI data
                        setAvailableLanes([11, 12, 13, 21, 22, 23]);
                    }
                } else {
                    setAvailableLanes([11, 12, 13, 21, 22, 23]);
                }
            } catch (e) {
                setAvailableLanes([11, 12, 13, 21, 22, 23]);
            } finally {
                setIsLoading(false);
            }
        }
        fetchInitialData();
    }, [roundId]);

    const handleSpin = async () => {
        if (isSpinning || resultLane) return;

        setIsSpinning(true);
        setError(null);

        try {
            const res = await drawLane(roundId, "");

            if (!res.success) {
                throw new Error((res as any).message || "추첨에 실패했습니다.");
            }

            const lane = res.lane as number;

            // 2. Prepare Animation
            let laneIndex = availableLanes.indexOf(lane);
            if (laneIndex === -1) {
                // If the result lane is not in the list, add it to ensure animation hits it
                setAvailableLanes(prev => [...prev, lane]);
                laneIndex = availableLanes.length;
            }

            const totalSlices = availableLanes.length;
            const sliceAngle = 360 / Math.max(totalSlices, 1);
            const extraSpins = 8 + Math.floor(Math.random() * 5); // 8-12 spins

            // Target: top marker (0 deg). 
            // Rotation calculation to land exactly on the center of the chosen slice
            const targetRotation = rotation + (extraSpins * 360) + (360 - (laneIndex * sliceAngle + sliceAngle / 2));

            // Start spinning
            setRotation(targetRotation);

            // 3. Wait for animation to finish (5 seconds)
            setTimeout(() => {
                setIsSpinning(false);
                setResultLane(lane); // Update UI to show the "Board"
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#3b82f6', '#4f46e5', '#facc15']
                });
            }, 5000);

        } catch (e: any) {
            setError(e.message);
            setIsSpinning(false);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center font-black bg-slate-950 text-white">데이터 로딩 중...</div>;

    const currentSliceAngle = 360 / Math.max(availableLanes.length, 1);

    // SVG Path generator for wheel slices
    const getPathData = (index: number) => {
        const radius = 250;
        const centerX = 250;
        const centerY = 250;
        const startAngle = index * currentSliceAngle;
        const endAngle = (index + 1) * currentSliceAngle;

        const x1 = centerX + radius * Math.cos((startAngle - 90) * Math.PI / 180);
        const y1 = centerY + radius * Math.sin((startAngle - 90) * Math.PI / 180);
        const x2 = centerX + radius * Math.cos((endAngle - 90) * Math.PI / 180);
        const y2 = centerY + radius * Math.sin((endAngle - 90) * Math.PI / 180);

        const largeArcFlag = currentSliceAngle > 180 ? 1 : 0;
        return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    };

    const getFontSize = () => {
        if (availableLanes.length > 50) return 'text-[10px]';
        if (availableLanes.length > 40) return 'text-[12px]';
        if (availableLanes.length > 30) return 'text-[14px]';
        if (availableLanes.length > 20) return 'text-base';
        return 'text-xl';
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600/20 to-transparent pointer-events-none" />

            {/* Top Navigation */}
            <div className="absolute top-4 left-4 z-50">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-full text-slate-300 transition-all font-bold group"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    <span>돌아가기</span>
                </button>
            </div>

            <div className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-8 md:gap-12">
                <div className="text-center space-y-2 md:space-y-4">
                    <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                        LANE DRAW
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs md:text-base">Fortune Wheel</p>
                </div>

                {/* The Wheel Container */}
                <div className="relative w-full max-w-[320px] sm:max-w-[400px] md:max-w-[500px] aspect-square">
                    <div className="absolute inset-0 rounded-full bg-blue-600/10 blur-[80px]" />

                    {/* SVG Container for both Marker and Wheel */}
                    <svg viewBox="0 0 500 500" className="w-full h-full overflow-visible relative z-10">
                        {/* Rotatable Wheel Group */}
                        <g
                            style={{
                                transform: `rotate(${rotation}deg)`,
                                transformOrigin: '250px 250px',
                                transition: rotation === 0 ? 'none' : 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)'
                            }}
                        >
                            {availableLanes.map((lane, i) => (
                                <g key={`${lane}-${i}`}>
                                    <path
                                        d={getPathData(i)}
                                        fill={i % 2 === 0 ? '#2563eb' : '#4338ca'}
                                        stroke="#1e293b"
                                        strokeWidth="1"
                                    />
                                    <text
                                        x="250"
                                        y="100"
                                        fill="white"
                                        textAnchor="middle"
                                        className={`${getFontSize()} font-black fill-white pointer-events-none drop-shadow-lg`}
                                        transform={`rotate(${i * currentSliceAngle + currentSliceAngle / 2}, 250, 250) rotate(90, 250, 100)`}
                                    >
                                        {lane >= 11 ? `${Math.floor(lane / 10)}-${lane % 10}` : lane}
                                    </text>
                                </g>
                            ))}

                            {/* Center hub (Rotates with wheel) */}
                            <circle cx="250" cy="250" r="40" fill="white" className="shadow-lg" />
                            <circle cx="250" cy="250" r="32" fill="#0f172a" />
                            <text x="250" y="260" fontSize="26" textAnchor="middle" className="pointer-events-none">🎳</text>
                        </g>

                        {/* Static Marker (Rendered LAST to be on top) */}
                        <g className="drop-shadow-[0_5px_15px_rgba(0,0,0,0.6)]">
                            <path
                                d="M250 55 L225 0 H275 Z"
                                fill="#FACC15"
                                stroke="white"
                                strokeWidth="3"
                                strokeLinejoin="round"
                            />
                            <circle cx="250" cy="15" r="5" fill="#B45309" />
                        </g>
                    </svg>
                </div>

                {/* Control / Result Area */}
                <div className="w-full max-w-md space-y-6 md:space-y-8 flex flex-col items-center">
                    {resultLane && !isSpinning ? (
                        <div className="animate-in zoom-in-95 duration-700 text-center space-y-4 md:space-y-6">
                            <div className="space-y-1">
                                <p className="text-lg md:text-xl font-bold text-slate-400">배정된 레인은</p>
                                <p className="text-7xl md:text-9xl font-black text-yellow-400 drop-shadow-[0_0_40px_rgba(250,204,21,0.7)] animate-bounce mt-2">
                                    {formatLane(resultLane)}
                                </p>
                            </div>
                            <button
                                onClick={() => router.back()}
                                className="w-full h-16 md:h-20 px-12 bg-white text-slate-900 hover:bg-yellow-50 font-black text-xl md:text-2xl rounded-2xl shadow-2xl transition-all active:scale-95 border-b-4 border-slate-200"
                            >
                                목록으로 돌아가기
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleSpin}
                            disabled={isSpinning || !!resultLane}
                            className={`h-20 md:h-24 w-full text-2xl md:text-3xl font-black rounded-3xl transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-4 ${isSpinning || !!resultLane
                                ? 'bg-slate-800 text-slate-600 border-2 border-slate-700'
                                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] animate-gradient border-b-8 border-indigo-900 hover:brightness-110 active:border-b-0 active:translate-y-1'
                                }`}
                        >
                            {isSpinning ? (
                                <>
                                    <span className="w-6 h-6 md:w-8 md:h-8 border-4 border-indigo-200 border-t-transparent rounded-full animate-spin" />
                                    행운의 레인 추첨 중...
                                </>
                            ) : (
                                <>
                                    <span>🎰</span> 레인 추첨하기
                                </>
                            )}
                        </button>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-400 font-bold text-center w-full">
                            ⚠️ {error}
                        </div>
                    )}
                </div>

                <div className="text-slate-500 font-medium text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    참가자당 1회만 추첨 가능합니다
                </div>
            </div>

            <style jsx>{`
                @keyframes gradient {
                    0% { background-position: 0% center; }
                    50% { background-position: 100% center; }
                    100% { background-position: 0% center; }
                }
                .animate-gradient {
                    animation: gradient 3s ease infinite;
                }
            `}</style>
        </div>
    );
}

