import prisma from "@/lib/prisma";

export class MobileSuperAdminError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = "MobileSuperAdminError";
    }
}

type ManagedTeamRecord = {
    id: string;
    name: string;
    code: string;
    bowlerHiddenEnabled: boolean;
    seasonRankingEnabled: boolean;
};

export type MobileSuperAdminDependencies = {
    findUserRole(userId: string): Promise<{ role: string } | null>;
    listTeams(): Promise<ManagedTeamRecord[]>;
    findTeam(teamId: string): Promise<ManagedTeamRecord | null>;
    updateBowlerHidden(teamId: string, enabled: boolean): Promise<ManagedTeamRecord>;
};

const teamSelect = {
    id: true,
    name: true,
    code: true,
    bowlerHiddenEnabled: true,
    seasonRankingEnabled: true,
} as const;

const defaultDependencies: MobileSuperAdminDependencies = {
    findUserRole(userId) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });
    },
    listTeams() {
        return prisma.team.findMany({
            where: { isActive: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            select: teamSelect,
        });
    },
    findTeam(teamId) {
        return prisma.team.findFirst({
            where: { id: teamId, isActive: true },
            select: teamSelect,
        });
    },
    updateBowlerHidden(teamId, enabled) {
        return prisma.team.update({
            where: { id: teamId },
            data: { bowlerHiddenEnabled: enabled },
            select: teamSelect,
        });
    },
};

async function requireCurrentSuperAdmin(
    userId: string,
    dependencies: MobileSuperAdminDependencies,
) {
    const user = await dependencies.findUserRole(userId);
    if (user?.role !== "SUPER_ADMIN") {
        throw new MobileSuperAdminError(
            "FORBIDDEN",
            "슈퍼 관리자 권한이 필요합니다.",
            403,
        );
    }
}

export async function listMobileSuperAdminTeams(
    userId: string,
    dependencies: MobileSuperAdminDependencies = defaultDependencies,
) {
    await requireCurrentSuperAdmin(userId, dependencies);
    return dependencies.listTeams();
}

export async function setMobileTeamBowlerHiddenEnabled(
    userId: string,
    teamId: string,
    enabled: boolean,
    dependencies: MobileSuperAdminDependencies = defaultDependencies,
) {
    await requireCurrentSuperAdmin(userId, dependencies);
    const team = await dependencies.findTeam(teamId);
    if (!team) {
        throw new MobileSuperAdminError(
            "TEAM_NOT_FOUND",
            "동호회를 찾을 수 없습니다.",
            404,
        );
    }
    return dependencies.updateBowlerHidden(team.id, enabled);
}
