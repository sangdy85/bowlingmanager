'use client';

import { useRef } from 'react';
import Link from 'next/link';
import GrandFinaleCumulativeManager, { GrandFinaleCumulativeRef } from './GrandFinaleCumulativeManager';

interface GrandFinaleLeaderboardViewProps {
    centerId: string;
    tournamentId: string;
    tournament: any;
    finishedRounds: any[];
    pointConfig: any;
    hasGrandFinale: string;
}

export default function GrandFinaleLeaderboardView({
    centerId,
    tournamentId,
    tournament,
    finishedRounds,
    pointConfig,
    hasGrandFinale
}: GrandFinaleLeaderboardViewProps) {
    const leaderboardRef = useRef<GrandFinaleCumulativeRef>(null);

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', paddingBottom: '80px', color: '#000000' }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
                {/* Header Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <Link
                            href={`/centers/${centerId}/tournaments/${tournamentId}`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                backgroundColor: '#ffffff',
                                border: '2px solid #000000',
                                fontSize: '14px',
                                fontWeight: '900',
                                color: '#000000',
                                textDecoration: 'none',
                                boxShadow: '4px 4px 0px 0px #000000'
                            }}
                        >
                            <span>←</span>
                            GO TO TOURNAMENT HOME
                        </Link>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '32px',
                        paddingBottom: '32px',
                        borderBottom: '4px solid #000000'
                    }} className="md:flex-row md:items-end">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'inline-block', alignSelf: 'flex-start', paddingLeft: '16px', paddingRight: '16px', paddingTop: '6px', paddingBottom: '6px', backgroundColor: '#000000', color: '#ffffff', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
                                LEADERBOARD STATUS
                            </div>
                            <h1 style={{ fontSize: '48px', fontWeight: '900', color: '#000000', letterSpacing: '-0.02em', lineHeight: '1.1', textTransform: 'uppercase' }}>
                                {tournament.name} <br />
                                <span style={{ color: '#9ca3af' }}>POINT STATUS</span>
                            </h1>
                        </div>

                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            backgroundColor: '#ffffff',
                            border: '2px solid #000000',
                            padding: '24px',
                            boxShadow: '8px 8px 0px 0px #000000',
                            minWidth: '320px'
                        }}>
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '900', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Total Registrations</span>
                                    <div style={{ fontSize: '42px', fontWeight: '900', color: '#000000', fontVariantNumeric: 'tabular-nums', lineHeight: '1' }}>
                                        {tournament.registrations.length}
                                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#d1d5db', marginLeft: '8px', textTransform: 'uppercase' }}>Players</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                                <button
                                    onClick={() => leaderboardRef.current?.downloadExcel()}
                                    style={{
                                        flex: 1,
                                        backgroundColor: '#22c55e',
                                        color: '#ffffff',
                                        padding: '12px',
                                        fontWeight: '900',
                                        fontSize: '13px',
                                        border: '2px solid #000000',
                                        boxShadow: '4px 4px 0px 0px #000000',
                                        cursor: 'pointer',
                                        textTransform: 'uppercase'
                                    }}
                                >
                                    엑셀 저장
                                </button>
                                <button
                                    onClick={() => leaderboardRef.current?.downloadImage()}
                                    style={{
                                        flex: 1,
                                        backgroundColor: '#3b82f6',
                                        color: '#ffffff',
                                        padding: '12px',
                                        fontWeight: '900',
                                        fontSize: '13px',
                                        border: '2px solid #000000',
                                        boxShadow: '4px 4px 0px 0px #000000',
                                        cursor: 'pointer',
                                        textTransform: 'uppercase'
                                    }}
                                >
                                    이미지 저장
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {hasGrandFinale === 'CUMULATIVE' ? (
                    <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                        <GrandFinaleCumulativeManager
                            ref={leaderboardRef}
                            tournament={tournament}
                            centerId={centerId}
                            isManager={false}
                        />
                    </div>
                ) : (
                    <div style={{ padding: '80px', textAlign: 'center', border: '2px dashed #d1d5db', backgroundColor: '#ffffff' }}>
                        <div style={{ fontSize: '60px', marginBottom: '24px' }}>🚫</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Grand Finale Not Enabled</div>
                        <p style={{ color: '#6b7280' }}>This tournament does not have Point Accumulation enabled for the Grand Finale.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
