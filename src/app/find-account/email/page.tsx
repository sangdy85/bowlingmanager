
'use client';

import { useState } from 'react';
import { findEmail } from '@/app/actions/auth';
import Link from 'next/link';
import styles from '../../AuthPage.module.css';

export default function FindEmailPage() {
    const [name, setName] = useState("");
    const [result, setResult] = useState<{ success: boolean, data?: { email: string, createdAt: Date }[], message?: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const res = await findEmail(name);
        setResult(res);
        setLoading(false);
    };

    return (
        <div className={styles.page}>
            <section className={styles.card}>
                <header className={styles.header}>
                    <h1 className={styles.title}>이메일 찾기</h1>
                    <p className={styles.subtitle}>가입할 때 사용한 이름으로 등록 계정을 확인합니다.</p>
                </header>

                {!result?.success ? (
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.field}>
                            <label htmlFor="name" className="label">이름</label>
                            <input
                                type="text"
                                id="name"
                                className="input"
                                placeholder="가입시 입력한 이름"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        {result?.message && <p className={[styles.notice, styles.error].join(' ')}>{result.message}</p>}
                        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                            {loading ? "찾는 중..." : "이메일 찾기"}
                        </button>
                    </form>
                ) : (
                    <div className={styles.centerActions}>
                        <div className={styles.resultBox}>
                            <p className={styles.resultLead}>입력하신 이름으로 가입된 계정입니다.</p>
                            <ul className={styles.resultList}>
                                {result.data?.map((item, idx) => (
                                    <li key={idx} className={styles.resultItem}>
                                        {item.email}
                                        <div className={styles.resultMeta}>
                                            가입일: {new Date(item.createdAt).toLocaleDateString()}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <Link href="/login" className="btn btn-primary w-full">로그인하러 가기</Link>
                        <Link href="/find-account/password" className="btn btn-secondary w-full">비밀번호 찾기</Link>
                    </div>
                )}

                <div className={styles.footer}>
                    <Link href="/find-account">← 이전으로</Link>
                </div>
            </section>
        </div>
    );
}
