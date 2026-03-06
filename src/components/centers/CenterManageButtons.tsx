'use client';

import Link from "next/link";

interface CenterManageButtonsProps {
    centerId: string;
}

export default function CenterManageButtons({ centerId }: CenterManageButtonsProps) {
    const handleBlocked = (e: React.MouseEvent) => {
        e.preventDefault();
        alert("대표에 의해 차단된 기능입니다");
    };

    return (
        <div className="flex gap-2">
            <Link href={`/centers/${centerId}/edit`} className="btn btn-secondary text-sm h-10">정보 수정</Link>
            <button
                onClick={handleBlocked}
                className="btn btn-primary text-sm h-10"
            >
                + 새 대회 개최
            </button>
        </div>
    );
}
