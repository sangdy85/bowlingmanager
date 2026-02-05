
'use client';

import { useState } from 'react';
import { findEmail } from '@/app/actions/auth';
import Link from 'next/link';

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
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h1 className="text-center mb-6" style={{ fontSize: '1.5rem' }}>이메일 찾기</h1>

                {!result?.success ? (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
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
                        {result?.message && <p className="text-destructive text-sm text-center">{result.message}</p>}
                        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                            {loading ? "찾는 중..." : "이메일 찾기"}
                        </button>
                    </form>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="bg-secondary/50 p-4 rounded-lg">
                            <p className="text-sm text-muted-foreground mb-2">입력하신 이름으로 가입된 계정입니다:</p>
                            <ul className="space-y-2">
                                {result.data?.map((item, idx) => (
                                    <li key={idx} className="font-mono font-bold text-center border-b border-border pb-1 last:border-0 last:pb-0">
                                        {item.email}
                                        <div className="text-[10px] text-muted-foreground font-normal">
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

                <div className="text-center mt-6" style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)' }}>
                    <Link href="/find-account">이전으로</Link>
                </div>
            </div>
        </div>
    );
}
