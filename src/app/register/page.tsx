'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { register, sendCode, signInWithProvider } from '@/app/actions/auth';

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
        } catch (err: any) {
            console.error("PING Error:", err);
            setSendMsg("연결 오류: " + (err.message || "서버 응답 없음"));
        } finally {
            setSendLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h1 className="text-center mb-4" style={{ fontSize: '1.5rem' }}>회원가입</h1>
                
                <div className="social-btn-container mb-4">
                    <form action={() => signInWithProvider("google")}>
                        <button type="submit" className="btn btn-google w-full flex items-center justify-center">
                            <svg className="social-icon" width="18" height="18" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.14 2.87-1.12 3.53v2.92h6.63c3.87-3.57 6.18-8.83 6.18-14.3Z"/>
                                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-6.63-2.92c-.93.63-2.12 1.01-3.3 1.01-3.24 0-5.99-2.19-6.97-5.13H1.02v3.01C3 21.07 7.23 24 12 24Z"/>
                                <path fill="#FBBC05" d="M5.03 14.05c-.25-.75-.39-1.55-.39-2.37s.14-1.62.39-2.37V6.3H1.02A11.94 11.94 0 0 0 0 11.68c0 1.95.47 3.8 1.02 5.38l4.01-3.01Z"/>
                                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.93 1.19 15.24 0 12 0 7.23 0 3 2.93 1.02 6.3l4.01 3.01c.98-2.94 3.73-5.13 6.97-5.13Z"/>
                            </svg>
                            Google 계정으로 가입
                        </button>
                    </form>
                    <form action={() => signInWithProvider("naver")}>
                        <button type="submit" className="btn btn-naver w-full flex items-center justify-center">
                            <span className="social-icon" style={{ fontWeight: '900', fontFamily: 'sans-serif', fontSize: '16px', marginRight: '8px' }}>N</span>
                            네이버 계정으로 가입
                        </button>
                    </form>
                </div>

                <div className="social-login-divider">또는 일반 이메일 가입</div>

                <form action={dispatch} className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="name" className="label">이름</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            className="input"
                            placeholder="홍길동 (공백 없이 입력)"
                            pattern="[^\s]+"
                            title="이름에 공백(띄어쓰기)을 포함할 수 없습니다."
                            required
                        />
                        <p className="text-[10px] text-gray-500 mt-1">※ 이름에 공백(띄어쓰기)을 넣을 수 없습니다.</p>
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
