import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import NewTournamentForm from "@/components/tournaments/NewTournamentForm";
import styles from "./NewTournamentPage.module.css";

export default async function NewTournamentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: centerId } = await params;
    const session = await auth();

    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        include: { managers: true }
    });

    if (!center) notFound();
    if (!center.managers.some(m => m.id === session?.user?.id)) {
        redirect(`/centers/${centerId}`);
    }

    return (
        <div className={styles.page}>
            <Link href={`/centers/${centerId}`} className={styles.back}>
                <span className={styles.backIcon} aria-hidden="true">←</span>
                <span>볼링장 정보로 돌아가기</span>
            </Link>

            <header className={styles.hero}>
                <h1 className={styles.title}>새 대회 개최</h1>
                <p className={styles.subtitle}>{center.name}에서 운영할 상주리그, 챔프전 또는 이벤트전을 생성합니다.</p>
            </header>

            <div className={styles.formShell}>
                <NewTournamentForm centerId={centerId} />
            </div>
        </div>
    );
}
