import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function AdminDashboardPage() {
    const [userCount, teamCount, centerCount] = await Promise.all([
        prisma.user.count(),
        prisma.team.count(),
        prisma.bowlingCenter.count(),
    ]);

    return (
        <div>
            <h1 className="page-title mb-8">시스템 현황</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card p-6 bg-blue-500/10 border-blue-500/20">
                    <div className="text-sm text-blue-500 font-semibold mb-1">총 사용자</div>
                    <div className="text-3xl font-bold">{userCount}명</div>
                </div>

                <div className="card p-6 bg-purple-500/10 border-purple-500/20">
                    <div className="text-sm text-purple-500 font-semibold mb-1">총 팀</div>
                    <div className="text-3xl font-bold">{teamCount}개</div>
                </div>

                <div className="card p-6 bg-orange-500/10 border-orange-500/20">
                    <div className="text-sm text-orange-500 font-semibold mb-1">등록된 볼링장</div>
                    <div className="text-3xl font-bold">{centerCount}곳</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                <Link href="/admin/centers" className="card p-6 hover:bg-secondary/20 transition-all border-t-4 border-primary group flex flex-col gap-2">
                    <div className="text-3xl group-hover:scale-110 transition-transform w-fit">🏢</div>
                    <h2 className="text-xl font-bold">볼링장 관리</h2>
                    <p className="text-sm text-secondary-foreground leading-snug">새로운 볼링장을 등록하고 전용 인증 코드를 관리합니다.</p>
                </Link>

                <Link href="/admin/teams" className="card p-6 hover:bg-secondary/20 transition-all border-t-4 border-purple-500 group flex flex-col gap-2">
                    <div className="text-3xl group-hover:scale-110 transition-transform w-fit">👥</div>
                    <h2 className="text-xl font-bold">팀 관리</h2>
                    <p className="text-sm text-secondary-foreground leading-snug">생성된 모든 팀의 현황을 파악하고 정보를 수정합니다.</p>
                </Link>

                <Link href="/admin/users" className="card p-6 hover:bg-secondary/20 transition-all border-t-4 border-orange-500 group flex flex-col gap-2">
                    <div className="text-3xl group-hover:scale-110 transition-transform w-fit">👤</div>
                    <h2 className="text-xl font-bold">계정 관리</h2>
                    <p className="text-sm text-secondary-foreground leading-snug">사용자 권한(관리자 등)을 조정하고 계정을 관리합니다.</p>
                </Link>
            </div>

            <div className="card p-8 bg-secondary/5 border-dashed">
                <h2 className="text-xl font-bold mb-4">관리자 안내</h2>
                <p className="text-secondary-foreground leading-relaxed">
                    좌측 메뉴를 통해 볼링장, 팀, 그리고 계정을 관리할 수 있습니다.<br />
                    볼링장 관리에서는 새로운 센터를 등록하고, 해당 센터를 관리할 사용자가 사용할 수 있는 고유 코드를 생성할 수 있습니다.
                </p>
            </div>
        </div>
    );
}
