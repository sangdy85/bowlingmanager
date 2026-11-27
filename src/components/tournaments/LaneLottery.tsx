'use client';

import { useState, useEffect } from 'react';
import { drawLane } from '@/app/actions/round-actions';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';

interface LaneLotteryProps {
    roundId: string;
    registrationId: string;
    laneConfig: Record<string, number[]>; // { "1": [1,2,3] }
    startLane: number;
    endLane: number;
    currentLane: number | null;
    roundDate: string;
}

export default function LaneLottery({ roundId, registrationId, laneConfig, startLane, endLane, currentLane, roundDate }: LaneLotteryProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<number | null>(currentLane);
    const [error, setError] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);
    const router = useRouter();

    // Calculate total capacity
    let totalCapacity = 0;
    if (Object.keys(laneConfig).length > 0) {
        Object.values(laneConfig).forEach(slots => totalCapacity += slots.length);
    } else if (startLane && endLane) {
        totalCapacity = (endLane - startLane + 1) * 3; // Default 3
    }

    // Generate mysterious boxes
    const boxes = Array.from({ length: totalCapacity }, (_, i) => i);

    const handleDraw = async () => {
        if (loading || result) return;

        setError('');
        setLoading(true);
        setIsDrawing(true);

        try {
            // Fake delay for suspense
            await new Promise(resolve => setTimeout(resolve, 1500));

            const res = await drawLane(roundId, registrationId);
            setResult(res.lane);

            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#3b82f6', '#10b981', '#f59e0b']
            });

            setTimeout(() => {
                const lane = Math.floor(res.lane / 10);
                const slot = res.lane % 10;
                alert(`축하합니다! ${lane}번 레인의 ${slot}번 자리(슬롯)에 배정되었습니다.`);
                router.refresh(); // Refresh to update any parent state
            }, 500);

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
            setIsDrawing(false);
        }
    };

    if (result) {
        return (
            <div className="flex flex-col items-center justify-center py-12 animate-fade-in-up">
                <div className="text-6xl mb-4">🎳</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">당신의 레인은?</h2>
                <div className="text-5xl font-black text-blue-600 bg-blue-50 px-8 py-6 rounded-2xl border-2 border-blue-200 shadow-lg mb-6">
                    {(() => {
                        if (!result) return '';
                        const lane = Math.floor(result / 10);
                        const slot = result % 10;
                        return `${lane}번 레인 - ${slot}번`;
                    })()}
                </div>
                <p className="text-gray-500 mb-8">배정이 완료되었습니다. 좋은 경기 되세요!</p>
                <button onClick={() => router.back()} className="btn btn-primary px-8 font-bold">돌아가기</button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto p-4">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-white drop-shadow-md mb-2">🍀 행운의 레인 뽑기 🍀</h2>
                <p className="text-blue-100 font-bold">박스를 선택하여 레인을 배정받으세요!</p>
                {error && <div className="mt-4 bg-red-500/90 text-white px-4 py-2 rounded-lg font-bold shadow animate-pulse">{error}</div>}
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 perspective-1000">
                {boxes.map((i) => (
                    <button
                        key={i}
                        disabled={loading}
                        onClick={handleDraw}
                        className={`
                            aspect-square rounded-xl shadow-lg border-b-4 transition-all transform duration-300
                            flex items-center justify-center text-3xl
                            ${isDrawing
                                ? 'bg-gray-200 border-gray-300 scale-90 opacity-50 cursor-wait'
                                : 'bg-gradient-to-br from-yellow-300 to-yellow-500 border-yellow-600 hover:-translate-y-1 hover:brightness-110 active:border-b-0 active:translate-y-1'
                            }
                        `}
                    >
                        {isDrawing ? '⏳' : '❓'}
                    </button>
                ))}
            </div>

            <div className="mt-12 text-center text-blue-200 text-sm">
                * 공정한 추첨을 위해 무작위로 배정됩니다.<br />
                * 한 번 배정된 레인은 변경할 수 없습니다.
            </div>
        </div>
    );
}
