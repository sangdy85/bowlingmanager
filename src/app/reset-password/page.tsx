
'use client';

import { useState, Suspense } from 'react';
import { resetPassword } from '@/app/actions/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const initialEmail = searchParams.get('email') || "";

    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean, message: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setResult({ success: false, message: "비밀번호가 일치하지 않습니다." });
            return;
        }

        setLoading(true);
        const res = await resetPassword(email, code, password);
        setResult({ success: res.success, message: res.message || "" });
        setLoading(false);
    };

    if (result?.success) {
        return (
            <div className="card text-center" style={{ width: '100%', maxWidth: '400px' }}>
                <h1 className="text-green-500 mb-4 font-bold text-xl">비밀번호 변경 완료 🎉</h1>
                <p className="mb-6 text-muted-foreground">
                    비밀번호가 성공적으로 변경되었습니다.<br />
                    새 비밀번호로 로그인해주세요.
                </p>
                <Link href="/login" className="btn btn-primary w-full">로그인하러 가기</Link>
            </div>
        );
    }

    return (
        <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <h1 className="text-center mb-6" style={{ fontSize: '1.5rem' }}>비밀번호 재설정</h1>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label htmlFor="email" className="label">이메일</label>
                    <input
                        type="email"
                        id="email"
                        className="input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        readOnly={!!initialEmail} // If came from request page, lock it (optional, but safer UX)
                        required
                    />
                </div>

                <div>
                    <label htmlFor="code" className="label">인증 코드</label>
                    <input
                        type="text"
                        id="code"
                        className="input"
                        placeholder="이메일로 받은 6자리 코드"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="password" className="label">새 비밀번호</label>
                    <input
                        type="password"
                        id="password"
                        className="input"
                        placeholder="새로운 비밀번호 입력"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="label">비밀번호 확인</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        className="input"
                        placeholder="새로운 비밀번호 확인"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>

                {result && !result.success && (
                    <p className="text-destructive text-sm text-center">{result.message}</p>
                )}

                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                    {loading ? "변경 중..." : "비밀번호 변경하기"}
                </button>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <Suspense fallback={<div>Loading...</div>}>
                <ResetPasswordForm />
            </Suspense>
        </div>
    );
}
