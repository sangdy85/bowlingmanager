'use client';

import { useFormStatus } from "react-dom";

interface LeaveTeamButtonProps {
    onLeave: () => Promise<any>;
}

export default function LeaveTeamButton({ onLeave }: LeaveTeamButtonProps) {
    return (
        <form action={async () => {
            if (confirm("정말 팀을 탈퇴하시겠습니까? 기록은 유지되지만 팀 목록에서 제외됩니다.")) {
                await onLeave();
            }
        }} className="flex items-center">
            <SubmitButton />
        </form>
    );
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="btn h-10 px-4 min-w-[100px] text-sm flex items-center justify-center shadow-sm"
            style={{
                backgroundColor: '#ffffff',
                color: '#ef4444', // Red text for destructive action
                border: '1px solid #d1d5db'
            }}
        >
            {pending ? "탈퇴 중..." : "팀 탈퇴"}
        </button>
    );
}
