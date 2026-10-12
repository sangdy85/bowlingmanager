import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "@/components/public/Public.module.css";
import { ANDROID_APP_URL } from "@/lib/public-web";
import { getPublicTeamInvite } from "@/lib/team-membership";
import { PUBLIC_ORIGIN } from "@/lib/public-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const invite = await getPublicTeamInvite((await params).code);
    const title = invite ? `${invite.name} 동호회 초대` : "동호회 초대 | BowlingManager";
    const description = invite
        ? `회원 ${invite.memberCount}명과 함께 볼링 기록을 관리해보세요.`
        : "BowlingManager 동호회 초대";
    return {
        title,
        description,
        robots: { index: false, follow: false },
        ...(invite ? {
            openGraph: {
                title, description, type: "website",
                url: `${PUBLIC_ORIGIN}/invite/team/${invite.code}`,
                images: [{ url: `${PUBLIC_ORIGIN}/images/bowlingmanager-invite.png`, width: 512, height: 512, alt: "BowlingManager" }],
            },
        } : {}),
    };
}

export default async function TeamInvitePage({ params }: PageProps) {
    const { code } = await params;
    const invite = await getPublicTeamInvite(code);
    if (!invite) notFound();

    return (
        <div className={styles.surface}>
            <main>
                <header className={styles.hero}>
                    <p className={styles.eyebrow}>BOWLINGMANAGER INVITE</p>
                    <h1>{invite.name} 동호회에 초대받았습니다.</h1>
                    <p className={styles.intro}>BowlingManager 앱에서 일정, 정모 기록과 시즌 순위를 함께 확인하세요.</p>
                    <p>현재 회원 {invite.memberCount}명</p>
                </header>
                <section className={styles.appCta} aria-labelledby="invite-start-heading">
                    <h2 id="invite-start-heading">BowlingManager 앱에서 동호회에 가입하세요.</h2>
                    {ANDROID_APP_URL
                        ? <a className={styles.button} href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer">Android 앱 설치</a>
                        : <p>Android 앱은 현재 테스트/출시 준비 중입니다.</p>}
                    <div className={styles.appCtaActions}>
                        <Link className={styles.button} href={`/team/join?code=${encodeURIComponent(invite.code)}`}>웹에서 가입하기</Link>
                        <Link href="/login">로그인</Link>
                    </div>
                </section>
            </main>
        </div>
    );
}
