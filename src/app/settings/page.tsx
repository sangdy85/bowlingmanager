'use client';

import { useActionState, useState } from 'react';
import { changePassword, deleteAccount } from '@/app/actions/profile';
import { signOut } from 'next-auth/react';

export default function SettingsPage() {
    const [passwordState, passwordAction, isPasswordPending] = useActionState(changePassword, null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleDeleteAccount = async () => {
        if (!confirm('정말로 계정을 탈퇴하시겠습니까? 관련 데이터가 모두 삭제되며 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        setIsDeleting(true);
        setDeleteError(null);

        try {
            const result = await deleteAccount();
            if (result.success) {
                alert('계정이 성공적으로 삭제되었습니다.');
                await signOut({ callbackUrl: '/' });
            } else {
                setDeleteError(result.message);
            }
        } catch (error) {
            setDeleteError('계정 삭제 중 오류가 발생했습니다.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold mb-8">계정 설정</h1>

            {/* Password Change Section */}
            <section className="card mb-8">
                <h2 className="text-xl font-semibold mb-4 border-b border-border pb-2">비밀번호 변경</h2>
                <form action={passwordAction} className="flex flex-col gap-4">
                    <div>
                        <label className="label" htmlFor="currentPassword">현재 비밀번호</label>
                        <input
                            className="input"
                            type="password"
                            id="currentPassword"
                            name="currentPassword"
                            required
                        />
                    </div>
                    <div>
                        <label className="label" htmlFor="newPassword">새 비밀번호</label>
                        <input
                            className="input"
                            type="password"
                            id="newPassword"
                            name="newPassword"
                            required
                        />
                    </div>
                    <div>
                        <label className="label" htmlFor="confirmPassword">새 비밀번호 확인</label>
                        <input
                            className="input"
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            required
                        />
                    </div>

                    {passwordState && (
                        <div className={`text-sm text-center ${passwordState.success ? 'text-green-500' : 'text-destructive'}`}>
                            {passwordState.message}
                        </div>
                    )}

                    <div className="flex justify-end mt-2">
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isPasswordPending}
                        >
                            {isPasswordPending ? '변경 중...' : '비밀번호 변경'}
                        </button>
                    </div>
                </form>
            </section>

            {/* Account Deletion Section */}
            <section className="card border-destructive/30 bg-destructive/5">
                <h2 className="text-xl font-semibold mb-4 text-destructive border-b border-destructive/20 pb-2">계정 탈퇴</h2>
                <p className="text-sm text-muted-foreground mb-6">
                    계정을 탈퇴하면 모든 점수 기록, 팀 가입 정보 및 게시글이 영구적으로 삭제됩니다.
                    소유하고 계신 팀이 있는 경우, 먼저 팀 소유권을 이전하거나 팀을 삭제해야 합니다.
                </p>

                {deleteError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
                        {deleteError}
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={handleDeleteAccount}
                        className="btn bg-destructive hover:bg-destructive/90 text-white"
                        disabled={isDeleting}
                    >
                        {isDeleting ? '처리 중...' : '계정 탈퇴'}
                    </button>
                </div>
            </section>
        </div>
    );
}
