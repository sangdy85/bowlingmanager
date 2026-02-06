
'use client';

import { useState } from 'react';
import { requestPasswordReset } from '@/app/actions/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h1 className="text-center mb-6" style={{ fontSize: '1.5rem' }}>비밀번호 찾기</h1>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
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

                    <div className="text-xs text-muted-foreground">
                        가입된 이메일로 인증 코드가 발송됩니다.
                    </div>

                    {error && <p className="text-destructive text-sm text-center">{error}</p>}

                    <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                        {loading ? "인증 코드 전송" : "다음"}
                    </button>
                </form>

                <div className="text-center mt-6" style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)' }}>
                    <Link href="/find-account">이전으로</Link>
                </div>
            </div>
        </div>
    );
}
