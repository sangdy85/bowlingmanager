import prisma from "@/lib/prisma";
import { PUBLIC_ORIGIN } from "@/lib/public-web";

export const TEAM_CODE_LENGTH = 6;

export type TeamMembershipRole = "OWNER" | "MANAGER" | "MEMBER";
export type JoinTeamStatus =
    | "JOINED"
    | "ALREADY_MEMBER"
    | "INVALID_CODE"
    | "TEAM_NOT_FOUND"
    | "TEAM_INACTIVE";

type TeamRecord = {
    id: string;
    name: string;
    isActive: boolean;
    ownerId: string | null;
    User: { id: string }[];
    _count: { members: number };
};

type SameNameMember = { id: string; alias: string | null };

export type TeamMembershipDependencies = {
    findTeamByCode(code: string): Promise<TeamRecord | null>;
    findMembership(userId: string, teamId: string): Promise<unknown | null>;
    findUserName(userId: string): Promise<string | null>;
    listSameNameMembers(teamId: string, name: string): Promise<SameNameMember[]>;
    updateMemberAlias(memberId: string, alias: string): Promise<void>;
    createMembership(userId: string, teamId: string, alias: string | null): Promise<void>;
    migrateUserRecords(userId: string, teamId: string): Promise<void>;
};

export type JoinTeamResult = {
    status: JoinTeamStatus;
    team?: {
        id: string;
        name: string;
        myRole: TeamMembershipRole;
        memberCount: number;
    };
};

const defaultDependencies: TeamMembershipDependencies = {
    findTeamByCode(code) {
        return prisma.team.findUnique({
            where: { code },
            select: {
                id: true,
                name: true,
                isActive: true,
                ownerId: true,
                User: { select: { id: true } },
                _count: { select: { members: true } },
            },
        });
    },
    findMembership(userId, teamId) {
        return prisma.teamMember.findUnique({
            where: { userId_teamId: { userId, teamId } },
            select: { id: true },
        });
    },
    async findUserName(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        return user?.name ?? null;
    },
    listSameNameMembers(teamId, name) {
        return prisma.teamMember.findMany({
            where: { teamId, user: { name } },
            orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
            select: { id: true, alias: true },
        });
    },
    async updateMemberAlias(memberId, alias) {
        await prisma.teamMember.update({ where: { id: memberId }, data: { alias } });
    },
    async createMembership(userId, teamId, alias) {
        await prisma.teamMember.create({ data: { userId, teamId, alias } });
    },
    async migrateUserRecords(userId, teamId) {
        try {
            await Promise.all([
                prisma.score.updateMany({ where: { userId }, data: { teamId } }),
                prisma.tournamentRegistration.updateMany({ where: { userId }, data: { teamId } }),
                prisma.leagueMatchupIndividualScore.updateMany({ where: { userId }, data: { teamId } }),
            ]);
            console.log("Team record migration completed.");
        } catch (error) {
            // Preserve the existing best-effort migration behavior: membership
            // remains valid even if a legacy record cannot be linked.
            console.error("Migration failed:", error);
        }
    },
};

export function normalizeTeamCode(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const code = value.trim().toUpperCase();
    return new RegExp(`^[A-Z0-9]{${TEAM_CODE_LENGTH}}$`).test(code) ? code : null;
}

export function teamInviteUrl(code: string): string {
    return `${PUBLIC_ORIGIN}/invite/team/${encodeURIComponent(code)}`;
}

export async function joinTeamByCode(
    input: { userId: string; code: unknown },
    dependencies: TeamMembershipDependencies = defaultDependencies,
): Promise<JoinTeamResult> {
    const code = normalizeTeamCode(input.code);
    if (!code) return { status: "INVALID_CODE" };

    const team = await dependencies.findTeamByCode(code);
    if (!team) return { status: "TEAM_NOT_FOUND" };
    if (!team.isActive) return { status: "TEAM_INACTIVE" };

    const existing = await dependencies.findMembership(input.userId, team.id);
    if (existing) {
        return {
            status: "ALREADY_MEMBER",
            team: teamSummary(team, input.userId, team._count.members),
        };
    }

    const userName = await dependencies.findUserName(input.userId);
    if (!userName) throw new Error("Joining user was not found.");

    const sameNameMembers = await dependencies.listSameNameMembers(team.id, userName);
    const suffixes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let newAlias: string | null = null;
    if (sameNameMembers.length > 0) {
        if (sameNameMembers.length >= suffixes.length) {
            throw new Error("Too many members share the same name.");
        }
        for (let index = 0; index < sameNameMembers.length; index += 1) {
            const targetAlias = `${userName} ${suffixes[index]}`;
            if (sameNameMembers[index].alias !== targetAlias) {
                await dependencies.updateMemberAlias(sameNameMembers[index].id, targetAlias);
            }
        }
        newAlias = `${userName} ${suffixes[sameNameMembers.length]}`;
    }

    await dependencies.createMembership(input.userId, team.id, newAlias);
    await dependencies.migrateUserRecords(input.userId, team.id);

    return {
        status: "JOINED",
        team: teamSummary(team, input.userId, team._count.members + 1),
    };
}

function teamSummary(team: TeamRecord, userId: string, memberCount: number) {
    const myRole: TeamMembershipRole = team.ownerId === userId
        ? "OWNER"
        : team.User.some((manager) => manager.id === userId)
          ? "MANAGER"
          : "MEMBER";
    return { id: team.id, name: team.name, myRole, memberCount };
}

type PublicInviteDependencies = {
    findActiveTeam(code: string): Promise<{ name: string; _count: { members: number } } | null>;
};

const publicInviteDependencies: PublicInviteDependencies = {
    findActiveTeam(code) {
        return prisma.team.findFirst({
            where: { code, isActive: true },
            select: { name: true, _count: { select: { members: true } } },
        });
    },
};

export async function getPublicTeamInvite(
    codeValue: unknown,
    dependencies: PublicInviteDependencies = publicInviteDependencies,
) {
    const code = normalizeTeamCode(codeValue);
    if (!code) return null;
    const team = await dependencies.findActiveTeam(code);
    if (!team) return null;
    return { code, name: team.name, memberCount: team._count.members };
}
