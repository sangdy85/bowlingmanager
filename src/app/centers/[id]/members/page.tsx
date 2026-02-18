import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { removeCenterMember } from "@/app/actions/center-members";
import MemberSearchModal from "@/components/tournaments/MemberSearchModal";

export default async function CenterMembersPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    const session = await auth();

    const center = await prisma.bowlingCenter.findUnique({
        where: { id },
        include: {
            managers: true,
            CenterMember: {
                include: { User: true },
                orderBy: { joinedAt: 'desc' }
            }
        }
    }) as any;

    if (!center) notFound();

    const isManager = center.managers.some((m: any) => m.id === session?.user?.id);
    if (!isManager) {
        redirect(`/centers/${id}`);
    }

    const members = center.CenterMember || [];

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="flex items-center gap-4 mb-8">
                <Link href={`/centers/${id}`} className="btn btn-secondary h-10 px-4">← 뒤로가기</Link>
                <h1 className="text-3xl font-bold">{center.name} - 상주 회원 관리</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <section className="card p-6">
                        <h2 className="text-xl font-bold mb-6">상주 회원 목록 ({members.length})</h2>
                        {members.length === 0 ? (
                            <p className="text-center text-secondary-foreground py-10">등록된 상주 회원이 없습니다.</p>
                        ) : (
                            <div className="space-y-3">
                                {members.map((member: any) => (
                                    <div key={member.id} className="flex items-center justify-between p-4 bg-secondary/10 rounded-lg hover:bg-secondary/20 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center font-bold text-primary">
                                                {member.User.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold">{member.User.name} {member.alias && <span className="text-sm font-normal text-secondary-foreground">({member.alias})</span>}</div>
                                                <div className="text-xs text-secondary-foreground">{member.User.email}</div>
                                            </div>
                                        </div>
                                        <form action={removeCenterMember.bind(null, id, member.id)}>
                                            <button className="text-destructive text-sm font-medium hover:underline">회원 탈퇴</button>
                                        </form>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <div>
                    <section className="card p-6 sticky top-8">
                        <h3 className="font-bold mb-4">회원 추가</h3>
                        <p className="text-sm text-secondary-foreground mb-6">
                            이름 또는 이메일로 회원을 검색하여 상주 회원으로 등록할 수 있습니다.
                        </p>

                        <MemberSearchModal centerId={id} />

                        <p className="text-[10px] text-center text-secondary-foreground mt-4">
                            ※ 회원이 이미 가입되어 있어야 검색이 가능합니다.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
