import prisma from "@/lib/prisma";
import Link from "next/link";
import styles from "./CentersDiscovery.module.css";

export default async function CentersDiscoveryPage() {
    const centers = await prisma.bowlingCenter.findMany({
        orderBy: { name: 'asc' },
    });

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <div>
                    <p className={styles.eyebrow}>BOWLING CENTERS</p>
                    <h1 className={styles.title}>볼링장 · 대회</h1>
                    <p className={styles.subtitle}>
                        등록된 볼링장을 둘러보고 진행 중인 리그, 챔프전과 이벤트 대회를 확인하세요.
                    </p>
                </div>
                <div className={styles.count}>
                    <span className={styles.countLabel}>등록 볼링장</span>
                    <strong className={styles.countValue}>{centers.length}곳</strong>
                </div>
            </header>

            <div className={styles.list}>
                {centers.length === 0 ? (
                    <div className={styles.empty}>아직 등록된 볼링장이 없습니다.</div>
                ) : (
                    centers.map((center) => (
                        <Link
                            key={center.id}
                            href={`/centers/${center.id}`}
                            className={styles.card}
                        >
                            <div className={styles.cardMain}>
                                <span className={styles.icon} aria-hidden="true">🎳</span>
                                <div style={{ minWidth: 0 }}>
                                    <h2 className={styles.name}>{center.name}</h2>
                                    <p className={styles.address}>{center.address}</p>
                                </div>
                            </div>
                            <div className={styles.action}>
                                <span>정보 · 대회 보기</span>
                                <span className={styles.arrow} aria-hidden="true">→</span>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
