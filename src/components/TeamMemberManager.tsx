'use client';

import { useState } from 'react';
import { kickMember, transferOwnership, toggleManager } from "@/app/actions/team";

interface Member {
    id: string;
    name: string;
    email: string;
    alias?: string | null;
}

interface TeamMemberManagerProps {
    teamId: string;
    members: Member[];
    managers: Member[];
    ownerId: string | null;
    currentUserId: string;
}

export default function TeamMemberManager({ teamId, members, managers, ownerId, currentUserId }: TeamMemberManagerProps) {
    const [isPending, setIsPending] = useState(false);

    // Only allow access if current user is owner
    if (currentUserId !== ownerId) return <div className="p-4 text-center text-red-500">권한이 없습니다.</div>;

    const handleKick = async (memberId: string, memberName: string) => {
        if (!confirm(`${memberName}님을 정말로 강퇴하시겠습니까?`)) return;

        setIsPending(true);
        const result = await kickMember(teamId, memberId);
        setIsPending(false);

        alert(result.message);
    };

    const handleTransfer = async (memberId: string, memberName: string) => {
        if (!confirm(`${memberName}님에게 팀장 권한을 위임하시겠습니까?\n위임 후에는 일반 팀원으로 변경됩니다.`)) return;

        setIsPending(true);
        const result = await transferOwnership(teamId, memberId);
        setIsPending(false);

        alert(result.message);
    };

    const handleToggleManager = async (memberId: string, memberName: string, isManager: boolean) => {
        const action = isManager ? "해제" : "지정";
        if (!confirm(`${memberName}님을 매니저로 ${action}하시겠습니까?`)) return;

        setIsPending(true);
        const result = await toggleManager(teamId, memberId);
        setIsPending(false);

        alert(result.message);
    };

    return (
        <div className="bg-background rounded-lg shadow border w-full">
            <div className="p-4 border-b bg-muted/30">
                <h2 className="font-bold text-lg">팀원 관리 목록</h2>
                <p className="text-sm text-secondary-foreground">팀원을 강퇴하거나 관리할 수 있습니다.</p>
            </div>

            <div className="p-4">
                {members.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">팀원이 없습니다.</p>
                ) : (
                    <ul className="space-y-3">
                        {members.map(member => {
                            const isManager = managers.some(m => m.id === member.id);

                            return (
                                <li key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/10 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="font-bold flex items-center gap-2">
                                            {member.alias ? (
                                                <>
                                                    {member.alias}
                                                    <span className="text-xs font-normal text-muted-foreground">({member.name})</span>
                                                </>
                                            ) : (
                                                member.name
                                            )}
                                            {member.id === currentUserId && <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">나</span>}
                                            {member.id === ownerId && (
                                                <img
                                                    src="/images/leader-badge.png"
                                                    alt="팀장"
                                                    className="h-5 w-auto object-contain ml-1"
                                                    title="팀장"
                                                />
                                            )}
                                            {member.id !== ownerId && isManager && (
                                                <img
                                                    src="/images/manager-badge.png"
                                                    alt="매니저"
                                                    className="h-5 w-auto object-contain ml-1"
                                                    title="매니저"
                                                />
                                            )}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{member.email}</span>
                                    </div>

                                    {member.id !== currentUserId && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleToggleManager(member.id, member.name, isManager)}
                                                disabled={isPending}
                                                className={`px-3 py-1.5 text-xs border rounded transition-colors disabled:opacity-50 ${isManager
                                                    ? "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                                    : "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                                                    }`}
                                            >
                                                {isManager ? "매니저 해제" : "매니저 지정"}
                                            </button>
                                            <button
                                                onClick={() => handleTransfer(member.id, member.name)}
                                                disabled={isPending}
                                                className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 hover:text-blue-700 hover:border-blue-300 transition-colors disabled:opacity-50"
                                            >
                                                팀장 위임
                                            </button>
                                            <button
                                                onClick={() => handleKick(member.id, member.name)}
                                                disabled={isPending}
                                                className="px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 hover:text-red-700 hover:border-red-300 transition-colors disabled:opacity-50"
                                            >
                                                강퇴
                                            </button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
