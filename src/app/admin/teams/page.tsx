import prisma from "@/lib/prisma";
import { deleteTeam } from "@/app/actions/admin";
import Link from 'next/link';

export default async function AdminTeamsPage() {
    const teams = await prisma.team.findMany({
        where: { isActive: true },
        include: {
            _count: {
                select: { members: true }
            }
        },
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div>
            <h1 className="page-title mb-8">팀 관리</h1>

            <div className="grid gap-4">
                {teams.length === 0 ? (
                    <div className="card p-12 text-center text-secondary-foreground">
                        등록된 팀이 없습니다.
                    </div>
                ) : (
                    teams.map((team) => (
                        <div key={team.id} className="card p-6 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-xl font-bold">{team.name}</h3>
                                    <span className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full">
                                        코드: {team.code}
                                    </span>
                                </div>
                                <p className="text-secondary-foreground text-sm">
                                    팀원 {team._count.members}명 · 생성일 {team.createdAt.toLocaleDateString('ko-KR')}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Link
                                    href={`/team/${team.id}`}
                                    className="btn btn-secondary text-xs px-3 h-8 flex items-center"
                                >
                                    기록 보기
                                </Link>
                                <form action={deleteTeam.bind(null, team.id)}>
                                    <button className="btn btn-secondary text-destructive hover:bg-destructive/10 text-xs px-3 h-8">
                                        팀 삭제
                                    </button>
                                </form>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
