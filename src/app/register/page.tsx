'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { register, sendCode } from '@/app/actions/auth';

export default function RegisterPage() {
    const [errorMessage, dispatch, isPending] = useActionState(register, undefined);
    const [email, setEmail] = useState("");
    const [codeSent, setCodeSent] = useState(false);
    const [sendLoading, setSendLoading] = useState(false);
    const [sendMsg, setSendMsg] = useState("");

    const handleSendCode = async () => {
        if (!email) return;
        setSendLoading(true);
        setSendMsg("");
        try {
            const res = await sendCode(email);
            setSendMsg(res.message);
            if (res.success) setCodeSent(true);
        } catch {
            setSendMsg("오류가 발생했습니다.");
        } finally {
            setSendLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h1 className="text-center mb-4" style={{ fontSize: '1.5rem' }}>회원가입</h1>
                <form action={dispatch} className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="name" className="label">이름</label>
                        <input type="text" id="name" name="name" className="input" placeholder="홍길동" required />
                    </div>

                    <div>
                        <label htmlFor="email" className="label">이메일</label>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                id="email"
                                name="email"
                                className="input flex-1"
                                placeholder="example@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={handleSendCode}
                                disabled={sendLoading || !email}
                                className="btn btn-secondary whitespace-nowrap min-w-[80px] px-3 transition-all"
                            >
                                {sendLoading ? "전송 중" : codeSent ? "재전송" : "인증요청"}
                            </button>
                        </div>
                        {sendMsg && <p className={`text-xs mt-1 ${codeSent ? 'text-green-500' : 'text-destructive'}`}>{sendMsg}</p>}
                    </div>

                    <div>
                        <label htmlFor="code" className="label">인증 코드</label>
                        <input
                            type="text"
                            id="code"
                            name="code"
                            className="input"
                            placeholder="123456"
                            maxLength={6}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="label">비밀번호</label>
                        <input type="password" id="password" name="password" className="input" required />
                    </div>

                    {errorMessage && (
                        <div className="text-destructive text-center" style={{ fontSize: '0.875rem' }}>{errorMessage}</div>
                    )}
                    <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                        {isPending ? '가입 중...' : '가입하기'}
                    </button>
                </form>
                <div className="text-center mt-4" style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)' }}>
                    이미 계정이 있으신가요? <Link href="/login">로그인</Link>
                </div>
            </div>
        </div>
    );
}
