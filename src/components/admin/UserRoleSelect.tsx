'use client';

import { updateUserRole } from "@/app/actions/admin";
import { useState } from "react";

interface UserRoleSelectProps {
    userId: string;
    initialRole: string;
}

export default function UserRoleSelect({ userId, initialRole }: UserRoleSelectProps) {
    const [role, setRole] = useState(initialRole);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleRoleChange = async (newRole: string) => {
        setIsUpdating(true);
        try {
            await updateUserRole(userId, newRole);
            setRole(newRole);
        } catch (error) {
            alert("권한 변경 중 오류가 발생했습니다.");
            setRole(role); // Revert on error
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <select
            name="role"
            value={role}
            disabled={isUpdating}
            className={`bg-transparent text-xs border border-secondary/20 rounded px-2 py-1 outline-none focus:border-primary transition-colors ${isUpdating ? 'opacity-50' : ''}`}
            onChange={(e) => handleRoleChange(e.target.value)}
        >
            <option value="USER">일반</option>
            <option value="CENTER_ADMIN">볼링장 관리자</option>
            <option value="SUPER_ADMIN">슈퍼 관리자</option>
        </select>
    );
}
