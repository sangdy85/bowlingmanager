'use client';

import { useState } from 'react';
import { updateLeagueRoundDate } from '@/app/actions/league-actions';
import { formatKSTMonthDay, getKSTDateString } from '@/lib/tournament-utils';

interface RoundDateEditorProps {
    roundId: string;
    initialDate: Date | null;
    isManager: boolean;
}

export default function RoundDateEditor({ roundId, initialDate, isManager }: RoundDateEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    const formattedDate = getKSTDateString(initialDate);

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        if (!newDate) return;

        setLoading(true);
        try {
            await updateLeagueRoundDate(roundId, newDate);
            setIsEditing(false);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isManager) {
        return (
            <div className="py-1.5 px-0.5 text-[10px] font-bold" style={{ backgroundColor: '#FFCC00' }}>
                {formatKSTMonthDay(initialDate)}
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="py-1 px-0.5" style={{ backgroundColor: '#FFCC00' }}>
                <input
                    type="date"
                    defaultValue={formattedDate}
                    onChange={handleChange}
                    onBlur={() => !loading && setIsEditing(false)}
                    autoFocus
                    className="w-full text-[10px] p-0.5 border-none bg-white text-black font-bold focus:ring-1 focus:ring-primary rounded"
                />
            </div>
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className="py-1.5 px-0.5 text-[10px] font-bold cursor-pointer hover:bg-yellow-400 transition-colors group relative"
            style={{ backgroundColor: '#FFCC00' }}
            title="날짜 수정하려면 클릭"
        >
            {formatKSTMonthDay(initialDate)}
            <span className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 text-[8px]">✏️</span>
        </div>
    );
}
