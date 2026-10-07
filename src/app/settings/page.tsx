'use client';

import { useActionState, useState } from 'react';
import { changePassword, deleteAccount } from '@/app/actions/profile';
import { signOut, useSession } from 'next-auth/react';
import CenterRegistrationForm from '@/components/CenterRegistrationForm';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
    const { data: session } = useSession();
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
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>계정 설정</h1>
                <p className={styles.subtitle}>가입 정보, 비밀번호와 관리자 등록 정보를 관리합니다.</p>
            </header>
            <div className={styles.stack}>

            {/* User Profile Info Section */}
            <section className={`card ${styles.section}`}>
                <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>가입 정보</h2></div>
                <div className={styles.profileRows}>
                    <div className={styles.profileRow}>
                        <span className={styles.profileLabel}>이름</span>
                        <span className={styles.profileValue}>{session?.user?.name || '-'}</span>
                    </div>
                    <div className={styles.profileRow}>
                        <span className={styles.profileLabel}>이메일 주소</span>
                        <span className={styles.profileValue}>{session?.user?.email || '-'}</span>
                    </div>
                    <div className={styles.profileRow}>
                        <span className={styles.profileLabel}>로그인 방식</span>
                        <span className={styles.profileValue}>
                            {session?.user?.provider === 'google' && (
                                <>
                                    <svg className="social-icon" width="14" height="14" viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.14 2.87-1.12 3.53v2.92h6.63c3.87-3.57 6.18-8.83 6.18-14.3Z"/>
                                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-6.63-2.92c-.93.63-2.12 1.01-3.3 1.01-3.24 0-5.99-2.19-6.97-5.13H1.02v3.01C3 21.07 7.23 24 12 24Z"/>
                                        <path fill="#FBBC05" d="M5.03 14.05c-.25-.75-.39-1.55-.39-2.37s.14-1.62.39-2.37V6.3H1.02A11.94 11.94 0 0 0 0 11.68c0 1.95.47 3.8 1.02 5.38l4.01-3.01Z"/>
                                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.93 1.19 15.24 0 12 0 7.23 0 3 2.93 1.02 6.3l4.01 3.01c.98-2.94 3.73-5.13 6.97-5.13Z"/>
                                    </svg>
                                    Google 로그인 계정
                                </>
                            )}
                            {session?.user?.provider === 'naver' && (
                                <>
                                    <span className={styles.naverBadge}>N</span>
                                    네이버 로그인 계정
                                </>
                            )}
                            {session?.user?.provider === 'credentials' && (
                                <span className="text-primary font-medium">일반 이메일 가입 계정</span>
                            )}
                            {!session?.user?.provider && (
                                <span className={styles.profileLabel}>-</span>
                            )}
                        </span>
                    </div>
                </div>
            </section>

            {/* Password Change Section */}
            {session?.user?.provider === 'credentials' && (
                <section className={`card ${styles.section}`}>
                    <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>비밀번호 변경</h2></div>
                    <form action={passwordAction} className={styles.form}>
                        <div className={styles.field}>
                            <label className="label" htmlFor="currentPassword">현재 비밀번호</label>
                            <input
                                className="input"
                                type="password"
                                id="currentPassword"
                                name="currentPassword"
                                required
                            />
                        </div>
                        <div className={styles.field}>
                            <label className="label" htmlFor="newPassword">새 비밀번호</label>
                            <input
                                className="input"
                                type="password"
                                id="newPassword"
                                name="newPassword"
                                required
                            />
                        </div>
                        <div className={styles.field}>
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
                            <div className={`${styles.message} ${passwordState.success ? styles.success : styles.error}`}>
                                {passwordState.message}
                            </div>
                        )}

                        <div className={styles.actionRow}>
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
            )}

            {/* Bowling Center Registration Section */}
            <section className={`card ${styles.section}`}>
                <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>볼링장 관리자 등록</h2></div>
                <CenterRegistrationForm currentUserRole={session?.user?.role} />
            </section>

            {/* Account Deletion Section */}
            <section className={`card ${styles.section} ${styles.dangerSection}`}>
                <div className={styles.sectionHeader}><h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>계정 탈퇴</h2></div>
                <p className={styles.dangerText}>
                    계정을 탈퇴하면 모든 점수 기록, 팀 가입 정보 및 게시글이 영구적으로 삭제됩니다.
                    소유하고 계신 팀이 있는 경우, 먼저 팀 소유권을 이전하거나 팀을 삭제해야 합니다.
                </p>

                {deleteError && (
                    <div className={`${styles.message} ${styles.error}`}>{deleteError}</div>
                )}

                <div className={styles.actionRow}>
                    <button
                        onClick={handleDeleteAccount}
                        className={`btn ${styles.dangerButton}`}
                        disabled={isDeleting}
                    >
                        {isDeleting ? '처리 중...' : '계정 탈퇴'}
                    </button>
                </div>
            </section>
            </div>
        </div>
    );
}
