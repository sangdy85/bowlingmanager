import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            teamMemberships: { include: { team: true } },
        },
    });

    if (!user) {
        redirect("/login");
    }

    if (user.teamMemberships.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="card text-center" style={{ maxWidth: '500px' }}>
                    <h1 className="mb-4" style={{ fontSize: '2rem' }}>팀에 소속되어 있지 않습니다</h1>
                    <p className="mb-8" style={{ color: 'var(--secondary-foreground)' }}>
                        볼링 점수를 관리하려면 팀을 만들거나 기존 팀에 가입하세요.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Link href="/team/create" className="btn btn-primary">
                            팀 만들기
                        </Link>
                        <Link href="/team/join" className="btn btn-secondary">
                            팀 가입하기
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Determine display name
    const teamNameDisplay = user.teamMemberships.length === 1 ? user.teamMemberships[0].team.name : "볼링 매니저";

    return (
        <div className="py-8 container max-w-4xl mx-auto">
            <div className="mb-12 text-center">
                <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{teamNameDisplay} 대시보드</h1>
                <p style={{ color: 'var(--secondary-foreground)', fontSize: '1.2rem' }}>환영합니다, {user.name}님!</p>
                {user.teamMemberships.length > 1 && (
                    <p className="text-sm text-muted-foreground mt-2">
                        소속된 팀: {user.teamMemberships.map(tm => tm.team.name).join(", ")}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Link href="/personal" className="block group no-underline h-full">
                    <div className="card h-full hover:shadow-lg transition-shadow bg-secondary/10 border-2 border-transparent group-hover:border-primary cursor-pointer text-center flex flex-col items-center justify-center">
                        <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">🎳</div>
                        <h2 className="text-xl font-bold mb-2 text-foreground">점수 기록</h2>
                        <p className="text-secondary-foreground text-sm">
                            나의 개인 기록을 관리하고<br />새로운 점수를 입력합니다.
                        </p>
                    </div>
                </Link>

                <Link href="/team" className="block group no-underline h-full">
                    <div className="card h-full hover:shadow-lg transition-shadow bg-secondary/10 border-2 border-transparent group-hover:border-accent cursor-pointer text-center flex flex-col items-center justify-center">
                        <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">🏆</div>
                        <h2 className="text-xl font-bold mb-2 text-foreground">팀 관리</h2>
                        <p className="text-secondary-foreground text-sm">
                            {user.teamMemberships.length > 1 ? "소속된 팀들을 관리하고\n멤버들과 소통합니다." : "팀 전체 기록을 확인하고\n멤버들과 소통합니다."}
                        </p>
                    </div>
                </Link>

                <Link href="/stats" className="block group no-underline h-full">
                    <div className="card h-full hover:shadow-lg transition-shadow bg-secondary/10 border-2 border-transparent group-hover:border-warning cursor-pointer text-center flex flex-col items-center justify-center">
                        <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">📊</div>
                        <h2 className="text-xl font-bold mb-2 text-foreground">통계/순위</h2>
                        <p className="text-secondary-foreground text-sm">
                            팀 내 순위 경쟁과<br />나의 성장 추이를 확인합니다.
                        </p>
                    </div>
                </Link>
            </div>

            <div className="mt-12 text-center">
                <p className="text-sm text-muted-foreground">
                    오늘도 스트라이크! 활기찬 하루 되세요.
                </p>
            </div>
        </div>
    );
}
