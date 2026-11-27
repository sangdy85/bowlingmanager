'use client';

import { useState } from 'react';
import { updateLeagueRoundDate } from '@/app/actions/league-actions';
import { formatKSTMonthDay, formatDateForInput, formatKSTDate } from '@/lib/tournament-utils';

interface RoundDateEditorProps {
    roundId: string;
    initialDate: Date | null;
    isManager: boolean;
}

export default function RoundDateEditor({ roundId, initialDate, isManager }: RoundDateEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Use full datetime format for input
    const formattedDateTime = formatDateForInput(initialDate);

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDateTime = e.target.value; // YYYY-MM-DDTHH:mm
        if (!newDateTime) return;

        setLoading(true);
        try {
            await updateLeagueRoundDate(roundId, newDateTime);
            setIsEditing(false);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Check if it has time to decide display format
    const kst = initialDate ? new Date(new Date(initialDate).getTime() + 9 * 60 * 60000) : null;
    const hasTime = kst ? (kst.getUTCHours() !== 0 || kst.getUTCMinutes() !== 0) : false;
    const label = hasTime ? formatKSTDate(initialDate) : formatKSTMonthDay(initialDate);

    if (!isManager) {
        return (
            <div className="py-1.5 px-0.5 text-[10px] font-bold" style={{ backgroundColor: '#FFCC00' }}>
                {label}
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="py-1 px-0.5" style={{ backgroundColor: '#FFCC00' }}>
                <input
                    type="datetime-local"
                    defaultValue={formattedDateTime}
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
            className="py-1.5 px-0.5 text-[10px] font-bold cursor-pointer hover:bg-yellow-400 transition-colors group relative leading-tight"
            style={{ backgroundColor: '#FFCC00' }}
            title="날짜/시간 수정하려면 클릭"
        >
            {label}
            <span className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 text-[8px]">✏️</span>
        </div>
    );
}
