
import Link from "next/link";
import styles from "../AuthPage.module.css";

export default function FindAccountPage() {
    return (
        <div className={styles.page}>
            <section className={styles.card}>
                <header className={styles.header}>
                    <h1 className={styles.title}>계정 찾기</h1>
                    <p className={styles.subtitle}>이메일을 확인하거나 비밀번호 재설정을 시작합니다.</p>
                </header>

                <div className={styles.choiceList}>
                    <Link href="/find-account/email" className={styles.choiceCard}>
                        <span className={styles.choiceTitle}>이메일 찾기</span>
                        <span className={styles.choiceDescription}>가입한 이름으로 등록된 이메일을 확인합니다.</span>
                    </Link>

                    <Link href="/find-account/password" className={styles.choiceCard}>
                        <span className={styles.choiceTitle}>비밀번호 찾기</span>
                        <span className={styles.choiceDescription}>가입 이메일 인증 후 새 비밀번호를 설정합니다.</span>
                    </Link>
                </div>

                <div className={styles.footer}>
                    <Link href="/login">← 로그인 화면으로 돌아가기</Link>
                </div>
            </section>
        </div>
    );
}
