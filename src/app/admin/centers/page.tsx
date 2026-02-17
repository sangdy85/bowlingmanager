import prisma from "@/lib/prisma";
import { createBowlingCenter, deleteBowlingCenter } from "@/app/actions/admin";
import CopyButton from "@/components/CopyButton";

export default async function AdminCentersPage() {
    const centers = await prisma.bowlingCenter.findMany({
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="page-title">볼링장 관리</h1>
                <AdminCenterModal />
            </div>

            <div className="grid gap-4">
                {centers.length === 0 ? (
                    <div className="card p-12 text-center text-secondary-foreground">
                        등록된 볼링장이 없습니다.
                    </div>
                ) : (
                    centers.map((center) => (
                        <div key={center.id} className="card p-6 flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold mb-1">{center.name}</h3>
                                <p className="text-secondary-foreground text-sm mb-2">{center.address}</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded font-mono">
                                        전용 코드: {center.code}
                                    </span>
                                    <CopyButton text={center.code} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <form action={deleteBowlingCenter.bind(null, center.id)}>
                                    <button className="btn btn-secondary text-destructive hover:bg-destructive/10 text-xs px-3 h-8">
                                        삭제
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

// Small client component for the modal
function AdminCenterModal() {
    return (
        <div className="relative">
            <details className="dropdown dropdown-end">
                <summary className="btn btn-primary h-10 px-4">+ 새 볼링장 등록</summary>
                <div className="dropdown-content mt-2 p-6 card bg-background border shadow-xl w-[400px] z-50">
                    <h3 className="text-lg font-bold mb-4">볼링장 정보 입력</h3>
                    <form action={createBowlingCenter} className="flex flex-col gap-4">
                        <div>
                            <label className="label text-xs">볼링장 이름</label>
                            <input name="name" className="input h-10" required />
                        </div>
                        <div>
                            <label className="label text-xs">주소</label>
                            <input name="address" className="input h-10" required />
                        </div>
                        <div>
                            <label className="label text-xs">전화번호</label>
                            <input name="phone" className="input h-10" />
                        </div>
                        <div>
                            <label className="label text-xs">설명</label>
                            <textarea name="description" className="input min-h-[80px] p-2" />
                        </div>
                        <button type="submit" className="btn btn-primary w-full mt-2">등록하기</button>
                    </form>
                </div>
            </details>
        </div>
    );
}
