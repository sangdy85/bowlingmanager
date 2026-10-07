
'use client';

import { useState } from 'react';
import { requestPasswordReset } from '@/app/actions/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../../AuthPage.module.css';

export default function RequestResetPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await requestPasswordReset(email);
            if (res.success) {
                // Redirect to verify page with email query to pre-fill
                router.push(`/reset-password?email=${encodeURIComponent(email)}`);
            } else {
                setError(res.message || "오류가 발생했습니다.");
            }
        } catch (err) {
            setError("오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <section className={styles.card}>
                <header className={styles.header}>
                    <h1 className={styles.title}>비밀번호 찾기</h1>
                    <p className={styles.subtitle}>가입 이메일로 인증 코드를 받아 비밀번호를 재설정합니다.</p>
                </header>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <label htmlFor="email" className="label">이메일</label>
                        <input
                            type="email"
                            id="email"
                            className="input"
                            placeholder="example@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className={[styles.notice, styles.info].join(' ')}>가입된 이메일로 인증 코드가 발송됩니다.</div>

                    {error && <p className={[styles.notice, styles.error].join(' ')}>{error}</p>}

                    <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                        {loading ? "인증 코드 전송" : "다음"}
                    </button>
                </form>

                <div className={styles.footer}>
                    <Link href="/find-account">← 이전으로</Link>
                </div>
            </section>
        </div>
    );
}
