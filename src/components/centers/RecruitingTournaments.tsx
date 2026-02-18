'use client';

import Link from 'next/link';

interface Props {
    centerId: string;
    tournaments: {
        id: string;
        name: string;
        startDateLabel: string;
        type: string;
        status: string; // Pre-calculated: UPCOMING, OPEN, CLOSED, ONGOING, FINISHED
        maxParticipants: number;
        participantCount: number;
        isRegistered: boolean;
        roundId?: string;
    }[];
    isManager?: boolean;
}

export default function ActiveTournaments({ tournaments, centerId, isManager = false }: Props) {
    if (tournaments.length === 0) return null;

    return (
        <section className="card p-6 border-l-8 border-primary shadow-lg bg-slate-900 mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                <span className="text-2xl">🔥</span> 모집 중인 대회
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tournaments.map(t => {
                    // Button Label & Color
                    let buttonText = '참가 신청';
                    let buttonColor = '#2563eb'; // blue-600
                    let buttonShadowColor = 'rgba(37, 99, 235, 0.2)';

                    if (isManager) {
                        buttonText = '대회 관리';
                        buttonColor = '#2563eb';
                    } else if (t.isRegistered) {
                        buttonText = '신청 완료';
                        buttonColor = '#16a34a'; // green-600
                        buttonShadowColor = 'rgba(22, 163, 74, 0.2)';
                    } else if (t.status === 'ONGOING') {
                        buttonText = '대회 진행중';
                        buttonColor = '#2563eb';
                    } else if (t.status === 'CLOSED') {
                        buttonText = '접수 마감';
                        buttonColor = '#64748b'; // slate-500
                        buttonShadowColor = 'rgba(100, 116, 139, 0.2)';
                    }

                    // Link URL logic
                    let href = `/centers/${centerId}/tournaments/${t.id}`;
                    if (t.type === 'CHAMP' && t.roundId) {
                        // Use correct recruiting mode tab for CHAMP
                        href = `/centers/${centerId}/tournaments/${t.id}?mode=recruit`;
                    }

                    return (
                        <div key={t.id} className="bg-slate-800 shadow-lg flex flex-row items-center justify-between" style={{ border: '2px solid #3b82f6', padding: '32px', gap: '32px', minHeight: '140px', borderRadius: '20px' }}>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-medium text-gray-400">
                                        {t.type === 'LEAGUE' ? '상주리그' : t.type === 'CHAMP' ? '챔프전' : '이벤트'}
                                    </span>
                                </div>
                                <h3 className="font-bold text-lg mb-1 truncate text-white" title={t.name}>
                                    {t.name} <span className="text-gray-400 font-medium text-sm">({t.participantCount}/{t.maxParticipants})</span>
                                </h3>
                                <p className="text-sm text-gray-300">
                                    📅 {t.startDateLabel}
                                </p>
                            </div>
                            <div className="flex items-center gap-6 shrink-0">
                                <div className="text-right hidden sm:block">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">신청 인원</p>
                                    <p className="text-lg font-black text-white leading-none">
                                        {t.participantCount}<span className="text-xs text-gray-500 ml-1 font-bold">/ {t.maxParticipants}</span>
                                    </p>
                                </div>
                                <Link
                                    href={href}
                                    className="btn text-sm font-black border-none h-12 px-6 flex items-center shadow-lg transition-all hover:opacity-90"
                                    style={{
                                        backgroundColor: buttonColor,
                                        color: 'white',
                                        boxShadow: `0 10px 15px -3px ${buttonShadowColor}`
                                    }}
                                >
                                    {buttonText}
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
