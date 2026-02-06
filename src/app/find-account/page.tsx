
import Link from "next/link";

export default function FindAccountPage() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h1 className="text-center mb-6" style={{ fontSize: '1.5rem' }}>계정 찾기</h1>

                <div className="flex flex-col gap-4">
                    <Link href="/find-account/email" className="btn btn-secondary w-full p-4 h-auto flex flex-col items-center gap-2">
                        <span className="font-bold text-lg">이메일 찾기</span>
                        <span className="text-xs text-muted-foreground font-normal">가입한 이름으로 이메일 찾기</span>
                    </Link>

                    <Link href="/find-account/password" className="btn btn-secondary w-full p-4 h-auto flex flex-col items-center gap-2">
                        <span className="font-bold text-lg">비밀번호 찾기</span>
                        <span className="text-xs text-muted-foreground font-normal">이메일 인증으로 비밀번호 재설정</span>
                    </Link>
                </div>

                <div className="text-center mt-6" style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)' }}>
                    <Link href="/login">로그인 화면으로 돌아가기</Link>
                </div>
            </div>
        </div>
    );
}
