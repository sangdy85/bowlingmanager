import prisma from "@/lib/prisma";

export type MobileTeamRole = "OWNER" | "MANAGER" | "MEMBER";

type TeamRecord = {
    id: string;
    name: string;
    ownerId: string | null;
    User: { id: string }[];
    _count: { members: number };
};

type MembershipRecord = {
    team: TeamRecord;
};

type MemberRecord = {
    id: string;
    alias: string | null;
    userId: string;
    user: {
        name: string;
        handicap: number | null;
    };
};

export type MobileTeamsDependencies = {
    listMemberships(userId: string): Promise<MembershipRecord[]>;
    findAccessibleTeam(userId: string, teamId: string): Promise<TeamRecord | null>;
    listMembers(teamId: string): Promise<MemberRecord[]>;
};

const defaultDependencies: MobileTeamsDependencies = {
    listMemberships(userId) {
        return prisma.teamMember.findMany({
            where: {
                userId,
                team: { isActive: true },
            },
            orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
            select: {
                team: {
                    select: {
                        id: true,
                        name: true,
                        ownerId: true,
                        User: { select: { id: true } },
                        _count: { select: { members: true } },
                    },
                },
            },
        });
    },
    findAccessibleTeam(userId, teamId) {
        return prisma.team.findFirst({
            where: {
                id: teamId,
                isActive: true,
                members: { some: { userId } },
            },
            select: {
                id: true,
                name: true,
                ownerId: true,
                User: { select: { id: true } },
                _count: { select: { members: true } },
            },
        });
    },
    listMembers(teamId) {
        return prisma.teamMember.findMany({
            where: { teamId },
            orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
            select: {
                id: true,
                alias: true,
                userId: true,
                user: {
                    select: {
                        name: true,
                        handicap: true,
                    },
                },
            },
        });
    },
};

export async function listMobileTeams(
    userId: string,
    dependencies: MobileTeamsDependencies = defaultDependencies,
) {
    const memberships = await dependencies.listMemberships(userId);
    return memberships.map(({ team }) => ({
        id: team.id,
        name: team.name,
        myRole: teamRole(team, userId),
        memberCount: team._count.members,
    }));
}

export async function getMobileTeamDetail(
    userId: string,
    teamId: string,
    dependencies: MobileTeamsDependencies = defaultDependencies,
) {
    const team = await dependencies.findAccessibleTeam(userId, teamId);
    if (!team) return null;

    return {
        id: team.id,
        name: team.name,
        myRole: teamRole(team, userId),
        memberCount: team._count.members,
    };
}

export async function listMobileTeamMembers(
    userId: string,
    teamId: string,
    dependencies: MobileTeamsDependencies = defaultDependencies,
) {
    const team = await dependencies.findAccessibleTeam(userId, teamId);
    if (!team) return null;

    const members = (await dependencies.listMembers(teamId)).map((member) => ({
        id: member.id,
        name: member.alias || member.user.name,
        role: teamRole(team, member.userId),
        handicap: member.user.handicap,
    }));
    members.sort((left, right) => left.name.localeCompare(right.name, "ko") || left.id.localeCompare(right.id));
    return members;
}

function teamRole(team: Pick<TeamRecord, "ownerId" | "User">, userId: string): MobileTeamRole {
    if (team.ownerId === userId) return "OWNER";
    if (team.User.some((manager) => manager.id === userId)) return "MANAGER";
    return "MEMBER";
}
