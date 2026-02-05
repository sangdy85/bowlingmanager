'use client';

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function YearSelector({ currentYear, activeYears }: { currentYear: number, activeYears?: number[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // 사용 가능한 연도가 있으면 그것을 사용, 없으면 올해 포함 과거 5년
    const thisYear = new Date().getFullYear();
    let years: number[];

    if (activeYears && activeYears.length > 0) {
        years = [...activeYears].sort((a, b) => b - a);
        // 현재 선택된 연도가 목록에 없으면 추가 (보여주기 위해)
        if (!years.includes(currentYear)) {
            years.unshift(currentYear);
        }
    } else {
        years = Array.from({ length: 5 }, (_, i) => thisYear - i);
    }

    const handleYearChange = (year: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("year", year.toString());
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            {years.map((year) => (
                <button
                    key={year}
                    onClick={() => handleYearChange(year)}
                    className={`btn ${currentYear === year ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ whiteSpace: 'nowrap' }}
                >
                    {year}년
                </button>
            ))}
        </div>
    );
}
