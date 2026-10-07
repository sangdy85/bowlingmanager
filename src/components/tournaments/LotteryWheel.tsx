'use client';

import type { CSSProperties } from 'react';
import { getSpinRotation, participantName, type LotteryParticipant } from '@/lib/lottery-ui';
import styles from './LotteryAndLane.module.css';

const colors = ['#1d4ed8', '#0f766e', '#6d28d9', '#be123c', '#92400e', '#0369a1'];

export default function LotteryWheel({ participants, selectedIndex, spinId, running, onFinish }: {
    participants: LotteryParticipant[]; selectedIndex: number | null; spinId: number; running: boolean; onFinish: () => void;
}) {
    const count = participants.length;
    const angle = count ? 360 / count : 360;
    const rotation = selectedIndex === null ? 0 : getSpinRotation(selectedIndex, count);
    const point = (degrees: number, radius: number) => {
        const radians = (degrees - 90) * Math.PI / 180;
        return [200 + radius * Math.cos(radians), 200 + radius * Math.sin(radians)];
    };
    return <div className={styles.wheelFrame}>
        <span className={styles.pointer} aria-hidden="true" />
        <svg viewBox="0 0 400 400" role="img" aria-label={count ? `${count}명의 후보가 동일한 크기의 칸에 표시된 추첨 돌림판` : '추첨 후보가 없는 돌림판'}>
            <g key={spinId} className={running ? styles.spinning : undefined} onAnimationEnd={onFinish}
                style={{ transformOrigin: '200px 200px', transform: `rotate(${rotation}deg)`, '--end-angle': `${rotation}deg` } as CSSProperties}>
                {!count && <circle cx="200" cy="200" r="190" fill="#e2e8f0" />}
                {participants.map((person, index) => {
                    const [x1, y1] = point(index * angle, 190);
                    const [x2, y2] = point((index + 1) * angle, 190);
                    const [tx, ty] = point((index + 0.5) * angle, count <= 12 ? 120 : 155);
                    const name = participantName(person);
                    return <g key={person.registrationId}>
                        {count === 1 ? <circle cx="200" cy="200" r="190" fill={colors[0]} /> : <path d={`M200 200 L${x1} ${y1} A190 190 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} fill={colors[index % colors.length]} stroke="white" strokeWidth={count > 60 ? 0.5 : 2} />}
                        {count <= 60 && <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fill="white" fontWeight="750" fontSize={count <= 12 ? 14 : 10}
                            transform={`rotate(${(index + 0.5) * angle}, ${tx}, ${ty})`}>{count <= 12 ? `${index + 1}. ${name.length > 6 ? name.slice(0, 6) + '…' : name}` : index + 1}</text>}
                    </g>;
                })}
            </g>
            <circle cx="200" cy="200" r="43" fill="white" stroke="#dbe3ee" strokeWidth="6" />
            <text x="200" y="202" textAnchor="middle" dominantBaseline="middle" fill="#1e40af" fontWeight="850" fontSize="14">{running ? '추첨 중' : '행운권'}</text>
        </svg>
    </div>;
}
