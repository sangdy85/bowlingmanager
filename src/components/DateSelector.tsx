'use client';

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function DateSelector() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // URL에서 date 파라미터를 가져오거나 오늘 날짜를 기본값으로 사용
    const initialDate = searchParams.get("date") || new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).split('T')[0];
    const [date, setDate] = useState(initialDate);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        setDate(newDate);

        // URL 업데이트
        const params = new URLSearchParams(searchParams.toString());
        params.set("date", newDate);
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2 mb-4">
            <label htmlFor="dashboard-date" className="font-semibold">날짜 선택:</label>
            <input
                type="date"
                id="dashboard-date"
                value={date}
                onChange={handleDateChange}
                className="input py-1 px-3"
                style={{ width: 'auto' }}
            />
        </div>
    );
}
