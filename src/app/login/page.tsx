'use client';

import Link from 'next/link';
import { useActionState, Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { login } from '@/app/actions/auth';

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
        <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <h1 className="text-center mb-4" style={{ fontSize: '1.5rem' }}>로그인</h1>

            {/* ... omit message blocks for brevity in this thought but keep in code ... */}
            {message === 'verification-sent' && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-500 text-sm font-medium text-center">
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
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md text-blue-500 text-sm font-medium text-center">
                    가입이 완료되었습니다.<br />
                    로그인해주세요.
                </div>
            )}

            <form action={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label htmlFor="email" className="label">이메일</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        className="input"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="password" className="label">비밀번호</label>
                    <input type="password" id="password" name="password" className="input" required />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="rememberMe" style={{ fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>이메일 저장</label>
                </div>

                {errorMessage && (
                    <div className="text-destructive text-center" style={{ fontSize: '0.875rem' }}>{errorMessage}</div>
                )}
                <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                    {isPending ? '로그인 중...' : '로그인'}
                </button>
            </form>
            <div className="text-center mt-4 flex flex-col gap-2" style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)' }}>
                <div>
                    계정이 없신가요? <Link href="/register" className="underline hover:text-primary">회원가입</Link>
                </div>
                <div>
                    <Link href="/find-account" className="text-xs text-muted-foreground hover:text-primary">아이디/비밀번호 찾기</Link>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <Suspense fallback={<div className="text-center p-4">Loading...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
