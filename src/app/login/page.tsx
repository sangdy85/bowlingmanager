'use client';

import Link from 'next/link';
import { useActionState, Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { login, signInWithProvider } from '@/app/actions/auth';
import styles from '../AuthPage.module.css';

function LoginForm() {
    const [errorMessage, dispatch, isPending] = useActionState(login, undefined);
    const searchParams = useSearchParams();
    const message = searchParams.get('message');

    const [email, setEmail] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    useEffect(() => {
        const savedEmail = localStorage.getItem('rememberEmail');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (formData: FormData) => {
        const emailValue = formData.get('email') as string;
        if (rememberMe) {
            localStorage.setItem('rememberEmail', emailValue);
        } else {
            localStorage.removeItem('rememberEmail');
        }
        dispatch(formData);
    };

    return (
        <section className={styles.card}>
            <header className={styles.header}>
                <h1 className={styles.title}>로그인</h1>
                <p className={styles.subtitle}>BowlingManager 계정으로 계속합니다.</p>
            </header>

            {message === 'verification-sent' && (
                <div className={[styles.notice, styles.success].join(' ')}>
                    인증 메일이 발송되었습니다.<br />
                    이메일을 확인해주세요.
                </div>
            )}

            {message === 'check-email' && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-500 text-sm font-medium text-center">
                    인증 메일이 발송되었습니다.<br />
                    재발송을 원하시면 다시 가입을 시도해주세요.
                </div>
            )}

            {message === 'registered' && (
                <div className={[styles.notice, styles.info].join(' ')}>
                    가입이 완료되었습니다.<br />
                    로그인해주세요.
                </div>
            )}

            <form action={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                    <label htmlFor="email" className="label">이메일</label>
                    <input
                        type="text"
                        id="email"
                        name="email"
                        className="input"
                        placeholder="example@email.com 또는 아이디"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className={styles.field}>
                    <label htmlFor="password" className="label">비밀번호</label>
                    <input type="password" id="password" name="password" className="input" required />
                </div>

                <label className={styles.remember}>
                    <input
                        type="checkbox"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <span>이메일 저장</span>
                </label>

                {errorMessage && (
                    <div className={[styles.notice, styles.error].join(' ')}>{errorMessage}</div>
                )}
                <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                    {isPending ? '로그인 중...' : '로그인'}
                </button>
            </form>

            <div className="social-login-divider">또는</div>
            <div className={styles.social}>
                <form action={() => signInWithProvider("google")}>
                    <button type="submit" className="btn btn-google w-full flex items-center justify-center">
                        <svg className="social-icon" width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.14 2.87-1.12 3.53v2.92h6.63c3.87-3.57 6.18-8.83 6.18-14.3Z"/>
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-6.63-2.92c-.93.63-2.12 1.01-3.3 1.01-3.24 0-5.99-2.19-6.97-5.13H1.02v3.01C3 21.07 7.23 24 12 24Z"/>
                            <path fill="#FBBC05" d="M5.03 14.05c-.25-.75-.39-1.55-.39-2.37s.14-1.62.39-2.37V6.3H1.02A11.94 11.94 0 0 0 0 11.68c0 1.95.47 3.8 1.02 5.38l4.01-3.01Z"/>
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.93 1.19 15.24 0 12 0 7.23 0 3 2.93 1.02 6.3l4.01 3.01c.98-2.94 3.73-5.13 6.97-5.13Z"/>
                        </svg>
                        Google 로그인
                    </button>
                </form>
                <form action={() => signInWithProvider("naver")}>
                    <button type="submit" className="btn btn-naver w-full flex items-center justify-center">
                        <span className="social-icon" style={{ fontWeight: '900', fontFamily: 'sans-serif', fontSize: '16px', marginRight: '8px' }}>N</span>
                        네이버 로그인
                    </button>
                </form>
            </div>

            <div className={styles.footer}>
                <div className={styles.field}>
                    계정이 없신가요? <Link href="/register" className="underline hover:text-primary">회원가입</Link>
                </div>
                <div className={styles.field}>
                    <Link href="/find-account" className="text-xs text-muted-foreground hover:text-primary">아이디/비밀번호 찾기</Link>
                </div>
            </div>
        </section>
    );
}

export default function LoginPage() {
    return (
        <div className={styles.page}>
            <Suspense fallback={<div className="text-center p-4">Loading...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
