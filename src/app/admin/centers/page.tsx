import prisma from "@/lib/prisma";
import { createBowlingCenter, deleteBowlingCenter } from "@/app/actions/admin";
import CopyButton from "@/components/CopyButton";
import styles from "../AdminUI.module.css";

export default async function AdminCentersPage() {
    const centers = await prisma.bowlingCenter.findMany({
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div>
            <header className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>볼링장 관리</h1>
                    <p className={styles.pageSubtitle}>센터 정보와 전용 인증 코드를 관리합니다.</p>
                </div>
                <AdminCenterModal />
            </header>

            <div className={styles.list}>
                {centers.length === 0 ? (
                    <div className={styles.empty}>등록된 볼링장이 없습니다.</div>
                ) : (
                    centers.map((center) => (
                        <article key={center.id} className={`card ${styles.listCard}`}>
                            <div className={styles.listMain}>
                                <h3 className={styles.listTitle}>{center.name}</h3>
                                <p className={styles.listMeta}>{center.address}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.45rem' }}>
                                    <span className={styles.listMeta}>전용 코드: {center.code}</span>
                                    <CopyButton text={center.code} />
                                </div>
                            </div>
                            <div className={styles.listActions}>
                                <form action={deleteBowlingCenter.bind(null, center.id)}>
                                    <button className={`btn btn-secondary ${styles.smallButton}`}>삭제</button>
                                </form>
                            </div>
                        </article>
                    ))
                )}
            </div>
        </div>
    );
}

function AdminCenterModal() {
    return (
        <div className="relative">
            <details className="dropdown dropdown-end">
                <summary className="btn btn-primary">+ 새 볼링장 등록</summary>
                <div className="dropdown-content mt-2 p-5 card bg-background border shadow-xl w-[min(400px,calc(100vw-24px))] z-50">
                    <h3 className="text-lg font-bold mb-4">볼링장 정보 입력</h3>
                    <form action={createBowlingCenter} className="flex flex-col gap-4">
                        <div>
                            <label className="label text-xs">볼링장 이름</label>
                            <input name="name" className="input" required />
                        </div>
                        <div>
                            <label className="label text-xs">주소</label>
                            <input name="address" className="input" required />
                        </div>
                        <div>
                            <label className="label text-xs">전화번호</label>
                            <input name="phone" className="input" />
                        </div>
                        <div>
                            <label className="label text-xs">설명</label>
                            <textarea name="description" className="input min-h-[80px] p-2" />
                        </div>
                        <button type="submit" className="btn btn-primary w-full">등록하기</button>
                    </form>
                </div>
            </details>
        </div>
    );
}
