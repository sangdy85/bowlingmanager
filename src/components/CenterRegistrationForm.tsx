import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { joinCenterAsAdmin, leaveCenter } from '@/app/actions/center';

export default function CenterRegistrationForm({ currentUserRole }: { currentUserRole?: string }) {
    const { update } = useSession();
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const isCenterAdmin = currentUserRole === 'CENTER_ADMIN';

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus(null);

        try {
            const formData = new FormData();
            formData.append('code', code);
            await joinCenterAsAdmin(formData);

            // Immediate session update
            await update({ role: 'CENTER_ADMIN' });

            setStatus({ type: 'success', message: '볼링장 관리자 권한이 부여되었습니다.' });
            setCode('');
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || '인증에 실패했습니다.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeave = async () => {
        if (!confirm('정말로 볼링장 관리자 권한을 해지하시겠습니까? 관련 관리 권한이 모두 사라집니다.')) return;

        setIsLoading(true);
        setStatus(null);

        try {
            await leaveCenter();

            // Immediate session update
            await update({ role: 'USER' });

            setStatus({ type: 'success', message: '관리자 권한이 해지되었습니다. 일반 사용자로 전환되었습니다.' });
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || '권한 해지에 실패했습니다.' });
        } finally {
            setIsLoading(false);
        }
    };

    if (isCenterAdmin) {
        return (
            <div className="flex flex-col gap-4">
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg flex items-center gap-3">
                    <div className="text-2xl">✅</div>
                    <div>
                        <p className="font-bold text-primary">인증된 볼링장 관리자</p>
                        <p className="text-xs text-muted-foreground">볼링장 정보 관리 및 대회 개최 권한이 활성화되어 있습니다.</p>
                    </div>
                </div>

                <div className="bg-secondary/30 p-4 rounded-lg">
                    <p className="text-sm mb-3">더 이상 관리자 활동을 원하지 않으시면 아래 버튼을 눌러 권한을 해지할 수 있습니다.</p>
                    <button
                        onClick={handleLeave}
                        className="btn btn-secondary text-destructive w-full hover:bg-destructive/10 border-destructive/20"
                        disabled={isLoading}
                    >
                        {isLoading ? '처리 중...' : '관리자 권한 해지(탈퇴)하기'}
                    </button>
                </div>

                {status && (
                    <div className={`text-sm p-3 rounded-md mt-2 ${status.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}>
                        {status.message}
                    </div>
                )}
            </div>
        );
    }

    return (
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div>
                <label className="label" htmlFor="centerCode">볼링장 인증 코드</label>
                <div className="flex gap-2">
                    <input
                        className="input mb-0 flex-1 h-[46px]"
                        type="text"
                        id="centerCode"
                        placeholder="전용 6자리 코드"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        required
                        maxLength={6}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary flex-shrink-0 px-6 h-[46px] py-0"
                        style={{ whiteSpace: 'nowrap', minWidth: 'max-content' }}
                        disabled={isLoading}
                    >
                        {isLoading ? '인증 중...' : '인증하기'}
                    </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    볼링장 소유자로부터 받은 6자리 영문/숫자 코드를 입력하세요.
                </p>
            </div>

            {status && (
                <div className={`text-sm p-3 rounded-md ${status.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
                    }`}>
                    {status.message}
                </div>
            )}
        </form>
    );
}
