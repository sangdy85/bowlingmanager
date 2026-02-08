import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import YearSelector from "@/components/YearSelector";
import CopyButton from "@/components/CopyButton";
import LeaveTeamButton from "@/components/LeaveTeamButton";
import { leaveTeam } from "@/app/actions/team";
import TeamBoardSection from "@/components/board/TeamBoardSection";
import { getRecentPosts } from "@/app/actions/board";
import TeamStatsContainer from "@/components/TeamStatsContainer";

import TeamMemberManager from "@/components/TeamMemberManager";
import TeamGuestManager from "@/components/TeamGuestManager";

interface TeamPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
    params: Promise<{ teamId: string }>;
}

export default async function TeamDetailPage({ searchParams, params }: TeamPageProps) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const { teamId } = await params;

    // Verify user membership in this specific team
    const team = await prisma.team.findFirst({
        where: {
            id: teamId,
            members: { some: { userId: session.user.id } }
        },
        include: {
            members: {
                include: { user: true },
                orderBy: { joinedAt: 'asc' }
            },
            managers: true
        }
    });

    if (!team) {
        redirect("/team"); // Redirect to team selection if not a member or team doesn't exist
    }

    const resolvedSearchParams = await searchParams;
    const currentYear = resolvedSearchParams.year
        ? parseInt(resolvedSearchParams.year as string)
        : new Date().getFullYear();

    // available years logic
    const allTeamScores = await prisma.score.findMany({
        where: { teamId: teamId },
        select: { gameDate: true }
    });
    const distinctYears = Array.from(new Set(allTeamScores.map(s => s.gameDate.getFullYear())));

    // Team Stats Logic
    const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);

    const scores = await prisma.score.findMany({
        where: {
            teamId: teamId,
            gameDate: {
                gte: startOfYear,
                lte: endOfYear
            }
        },
        orderBy: {
            gameDate: 'desc'
        },
        include: {
            user: true
        }
    });

    // Fetch guest names for management (distinct guestNames where userId is null)
    const guestScores = await prisma.score.findMany({
        where: {
            teamId: teamId,
            userId: null,
            NOT: {
                guestName: null
            }
        },
        distinct: ['guestName'],
        select: {
            guestName: true
        }
    });
    const guestNames = guestScores
        .map(s => s.guestName!)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'ko'));

    // Sort members alphabetically for management/stats
    const sortedMembers = [...team.members].sort((a, b) => {
        const nameA = a.alias || a.user.name;
        const nameB = b.alias || b.user.name;
        return nameA.localeCompare(nameB, 'ko');
    });

    // Fetch recent posts for the board
    const recentPosts = await getRecentPosts(teamId);

    const isOwner = team.ownerId === session.user.id;
    const isManager = team.managers.some(m => m.id === session.user.id);
    const isManageMode = resolvedSearchParams.view === 'manage';
    const manageTab = resolvedSearchParams.tab || 'members'; // 'members' or 'guests'

    return (
        <div className="container py-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{team.name} 팀 관리</h1>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-secondary-foreground">초대 코드: <code className="font-bold text-foreground">{team.code}</code></span>
                        <CopyButton text={team.code} />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/team" className="btn btn-secondary h-10 px-4 min-w-[100px] text-sm flex items-center justify-center">
                        &larr; 팀 목록
                    </Link>
                    {(isOwner || isManager) && (
                        <Link
                            href={isManageMode ? `/team/${teamId}` : `/team/${teamId}?view=manage`}
                            className="btn h-10 px-4 min-w-[100px] text-sm flex items-center justify-center shadow-sm"
                            style={{
                                backgroundColor: '#ffffff',
                                color: '#000000',
                                border: '1px solid #d1d5db'
                            }}
                        >
                            {isManageMode ? '대시보드' : '팀원 관리'}
                        </Link>
                    )}
                    <LeaveTeamButton onLeave={leaveTeam.bind(null, teamId)} />
                </div>
            </div>

            {isManageMode ? (
                <div className="flex flex-col gap-6">
                    <div className="flex gap-2 p-1 bg-secondary/20 rounded-lg">
                        <Link
                            href={`/team/${teamId}?view=manage&tab=members`}
                            className={`flex-1 btn btn-sm h-10 ${manageTab === 'members' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            팀원 목록
                        </Link>
                        <Link
                            href={`/team/${teamId}?view=manage&tab=guests`}
                            className={`flex-1 btn btn-sm h-10 ${manageTab === 'guests' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            기록 관리 (비회원/탈퇴)
                        </Link>
                    </div>

                    {manageTab === 'members' ? (
                        <TeamMemberManager
                            teamId={teamId}
                            members={sortedMembers.map(m => ({
                                id: m.userId,
                                name: m.alias || m.user.name,
                                email: m.user.email,
                                alias: m.alias
                            }))}
                            managers={team.managers}
                            ownerId={team.ownerId}
                            currentUserId={session.user.id}
                        />
                    ) : (
                        <TeamGuestManager
                            teamId={teamId}
                            guests={guestNames}
                            ownerId={team.ownerId}
                            currentUserId={session.user.id}
                            members={sortedMembers.map(m => ({
                                id: m.userId,
                                name: m.alias || m.user.name, // Display name
                                realName: m.user.name, // Original name for matching
                                email: m.user.email,
                                alias: m.alias
                            }))}
                            managers={team.managers}
                        />
                    )}
                </div>
            ) : (
                <>
                    {/* Team Board Section */}
                    <TeamBoardSection teamId={teamId} recentPosts={recentPosts} />

                    <YearSelector currentYear={currentYear} activeYears={distinctYears} />

                    <TeamStatsContainer
                        scores={scores}
                        ownerId={team.ownerId}
                        managerIds={team.managers.map(m => m.id)}
                        teamName={team.name}
                        currentYear={currentYear}
                        isOwner={isOwner}
                        isManager={isManager}
                        teamId={teamId}
                        members={sortedMembers.map(m => ({ id: m.userId, name: m.alias || m.user.name }))}
                    />
                </>
            )}
        </div>
    );
}
