'use server';

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function generateTeamCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createTeam(prevState: string | undefined, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return "로그인이 필요합니다.";
    }

    const name = formData.get("name") as string;
    if (!name) {
        return "팀 이름을 입력해주세요.";
    }

    const code = generateTeamCode();

    try {
        const team = await prisma.team.create({
            data: {
                name,
                code,
                ownerId: session.user.id, // Set owner immediately
                members: {
                    create: {
                        userId: session.user.id,
                        // Alias defaults to null (original name)
                    }
                }
            }
        });

        // No need for raw query fix if we set ownerId in create, 
        // assuming no circular dependency issues. 
        // If previous issue was file lock, this might be safe now.

    } catch (error) {
        console.error(error);
        return "팀 생성 중 오류가 발생했습니다.";
    }

    revalidatePath("/dashboard");
    redirect("/dashboard");
}

export async function joinTeam(prevState: string | undefined, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return "로그인이 필요합니다.";
    }

    const code = formData.get("code") as string;
    if (!code) {
        return "팀 코드를 입력해주세요.";
    }

    try {
        const team = await prisma.team.findUnique({
            where: { code }
        });

        if (!team) {
            return "유효하지 않은 팀 코드입니다.";
        }

        // Check for existing membership
        const existingMember = await prisma.teamMember.findUnique({
            where: {
                userId_teamId: {
                    userId: session.user.id,
                    teamId: team.id
                }
            }
        });

        if (existingMember) {
            return "이미 가입된 팀입니다.";
        }

        const userName = session.user.name!;

        // 1. Fetch all members to check for name collisions
        const allMembers = await prisma.teamMember.findMany({
            where: { teamId: team.id },
            include: { user: true },
            orderBy: { joinedAt: 'asc' }
        });

        // 2. Identify collision group (Members with same base name)
        // We look for members whose original name matches, OR whose current alias suggests they are this person?
        // Actually, strictly speaking, we check against their *User Name*.
        // If "John" joins, we look for other users named "John".
        const sameNameMembers = allMembers.filter(m => m.user.name === userName);

        let newAlias: string | null = null;

        if (sameNameMembers.length > 0) {
            // Collision detected!
            // We have existing members [John (joined 2024), John (joined 2025)...]
            // And now new John (now).

            // Re-assign aliases for ALL of them + new one.
            // Suffixes: A, B, C...
            const suffixes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

            // Update existing members
            for (let i = 0; i < sameNameMembers.length; i++) {
                const member = sameNameMembers[i];
                const targetAlias = `${userName} ${suffixes[i]}`; // "John A"

                if (member.alias !== targetAlias) {
                    await prisma.teamMember.update({
                        where: { id: member.id },
                        data: { alias: targetAlias }
                    });
                }
            }

            // Set alias for the NEW member (next suffix)
            newAlias = `${userName} ${suffixes[sameNameMembers.length]}`; // "John B" (if length was 1)
        }

        // 3. Create Key
        await prisma.teamMember.create({
            data: {
                userId: session.user.id,
                teamId: team.id,
                alias: newAlias
            }
        });

    } catch (error) {
        console.error(error);
        return "팀 가입 중 오류가 발생했습니다.";
    }

    revalidatePath("/dashboard");
    redirect("/dashboard");
}

export async function leaveTeam(teamId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return "로그인이 필요합니다.";
    }

    try {
        const team = await prisma.team.findUnique({
            where: { id: teamId },
        });

        if (!team) return "존재하지 않는 팀입니다.";

        if (team.ownerId === session.user.id) {
            return "팀장은 탈퇴할 수 없습니다. 소유권을 이전하거나 팀을 삭제하세요.";
        }

        // Find existing member record to get alias for score preservation
        const member = await prisma.teamMember.findUnique({
            where: {
                userId_teamId: {
                    userId: session.user.id,
                    teamId: team.id
                }
            },
            include: { user: true }
        });

        if (member) {
            const displayName = member.alias || member.user.name;

            // Preserve scores as guest records
            await prisma.score.updateMany({
                where: {
                    teamId: team.id,
                    userId: session.user.id
                },
                data: {
                    userId: null,
                    guestName: displayName
                }
            });

            // Delete membership
            await prisma.teamMember.delete({
                where: {
                    userId_teamId: {
                        userId: session.user.id,
                        teamId: team.id
                    }
                }
            });
        }

    } catch (error) {
        console.error(error);
        return "팀 탈퇴 중 오류가 발생했습니다.";
    }

    revalidatePath("/dashboard");
    redirect("/dashboard");
}

export async function kickMember(teamId: string, memberId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    try {
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { managers: true }
        });
        if (!team) return { success: false, message: "존재하지 않는 팀입니다." };

        const isOwner = team.ownerId === session.user.id;
        const isManager = team.managers.some(m => m.id === session.user.id);

        if (!isOwner && !isManager) {
            return { success: false, message: "권한이 없습니다." };
        }

        // Managers cannot kick the owner or other managers
        const targetIsOwner = team.ownerId === memberId;
        const targetIsManager = team.managers.some(m => m.id === memberId);

        if (!isOwner && (targetIsOwner || targetIsManager)) {
            return { success: false, message: "매니저는 팀장이나 다른 매니저를 강퇴할 수 없습니다." };
        }

        if (memberId === session.user.id) {
            return { success: false, message: "자기 자신은 강퇴할 수 없습니다." };
        }

        // Find user name/alias to preserve scores
        // We need the member record
        const memberToCheck = await prisma.teamMember.findUnique({
            where: {
                userId_teamId: {
                    userId: memberId,
                    teamId: teamId
                }
            },
            include: { user: true }
        });

        if (memberToCheck) {
            const displayName = memberToCheck.alias || memberToCheck.user.name;

            // Convert past scores to 'guest' scores to preserve history
            await prisma.score.updateMany({
                where: {
                    teamId: teamId,
                    userId: memberId
                },
                data: {
                    userId: null,
                    guestName: displayName
                }
            });

            // Delete membership
            await prisma.teamMember.delete({
                where: {
                    userId_teamId: {
                        userId: memberId,
                        teamId: teamId
                    }
                }
            });
        }

        revalidatePath(`/team/${teamId}`);
        return { success: true, message: "팀원을 강퇴했습니다." };

    } catch (error) {
        console.error(error);
        return { success: false, message: "강퇴 처리 중 오류가 발생했습니다." };
    }
}

export async function deleteGuestRecords(teamId: string, guestName: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    try {
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { managers: true }
        });
        if (!team) return { success: false, message: "존재하지 않는 팀입니다." };

        const isOwner = team.ownerId === session.user.id;
        const isManager = team.managers.some(m => m.id === session.user.id);

        if (!isOwner && !isManager) {
            return { success: false, message: "권한이 없습니다." };
        }

        // Delete all scores matching the guest name and having no userId
        const result = await prisma.score.deleteMany({
            where: {
                teamId: teamId,
                userId: null,
                guestName: guestName
            }
        });

        revalidatePath(`/team/${teamId}`);
        return { success: true, message: `'${guestName}'의 기록 ${result.count}건을 삭제했습니다.` };

    } catch (error) {
        console.error(error);
        return { success: false, message: "기록 삭제 중 오류가 발생했습니다." };
    }
}

export async function mergeGuestStats(teamId: string, guestName: string, targetMemberId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    try {
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { managers: true }
        });
        if (!team) return { success: false, message: "존재하지 않는 팀입니다." };

        const isOwner = team.ownerId === session.user.id;
        const isManager = team.managers.some(m => m.id === session.user.id);

        if (!isOwner && !isManager) {
            return { success: false, message: "권한이 없습니다." };
        }

        // Check if target member exists in the team
        const targetMember = await prisma.teamMember.findUnique({
            where: {
                userId_teamId: {
                    userId: targetMemberId,
                    teamId: teamId
                }
            }
        });

        if (!targetMember) {
            return { success: false, message: "대상 팀원을 찾을 수 없습니다." };
        }

        // Update scores
        const result = await prisma.score.updateMany({
            where: {
                teamId: teamId,
                userId: null,
                guestName: guestName
            },
            data: {
                userId: targetMemberId,
                guestName: null
            }
        });

        revalidatePath(`/team/${teamId}`);
        return { success: true, message: `'${guestName}'의 기록 ${result.count}건을 통합했습니다.` };

    } catch (error) {
        console.error(error);
        return { success: false, message: "기록 통합 중 오류가 발생했습니다." };
    }
}

export async function transferOwnership(teamId: string, newOwnerId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, message: "로그인이 필요합니다." };
    }

    try {
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { members: true }
        });

        if (!team) return { success: false, message: "팀을 찾을 수 없습니다." };
        if (team.ownerId !== session.user.id) return { success: false, message: "권한이 없습니다." };

        const isMember = team.members.some(m => m.userId === newOwnerId);
        if (!isMember) return { success: false, message: "팀원이 아닙니다." };

        await prisma.team.update({
            where: { id: teamId },
            data: { ownerId: newOwnerId }
        });

        revalidatePath(`/team/${teamId}`);
        return { success: true, message: "팀장 권한을 위임했습니다." };
    } catch (error) {
        console.error(error);
        return { success: false, message: "권한 위임 중 오류가 발생했습니다." };
    }
}

export async function toggleManager(teamId: string, memberId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "로그인이 필요합니다." };

    try {
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { managers: true }
        });
        if (!team) return { success: false, message: "팀을 찾을 수 없습니다." };
        if (team.ownerId !== session.user.id) return { success: false, message: "권한이 없습니다." };

        const isManager = team.managers.some(m => m.id === memberId);

        if (isManager) {
            await prisma.team.update({
                where: { id: teamId },
                data: { managers: { disconnect: { id: memberId } } }
            });
            revalidatePath(`/team/${teamId}`);
            return { success: true, message: "매니저 권한을 해제했습니다." };
        } else {
            await prisma.team.update({
                where: { id: teamId },
                data: { managers: { connect: { id: memberId } } }
            });
            revalidatePath(`/team/${teamId}`);
            return { success: true, message: "매니저로 지정했습니다." };
        }
    } catch (error) {
        console.error(error);
        return { success: false, message: "처리 중 오류가 발생했습니다." };
    }
}
