'use client';

import Link from 'next/link';
import styles from './Navbar.module.css';
import { useState } from 'react';
import { signOut } from 'next-auth/react';

export default function NavbarClient({ isLoggedIn, userRole }: { isLoggedIn: boolean, userRole?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const handleLogout = async () => {
    console.log('Logout button clicked');
    closeMenu();
    try {
      console.log('Attempting signOut...');
      await signOut({ callbackUrl: '/login', redirect: true });
      console.log('signOut call completed');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.navContent}`}>
        <Link href="/" className={styles.logo} onClick={closeMenu}>
          BowlingManager
        </Link>

        <button className={styles.menuToggle} onClick={toggleMenu} aria-label="Toggle menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M4 12h16M4 6h16M4 18h16" />
            )}
          </svg>
        </button>

        <div className={`${styles.links} ${isOpen ? styles.linksOpen : ''}`}>
          {isLoggedIn ? (
            <>
              <Link href="/" className={styles.link} onClick={closeMenu}>홈</Link>
              {userRole === 'SUPER_ADMIN' ? (
                <Link href="/admin" className={styles.link} onClick={closeMenu}>관리</Link>
              ) : (
                <>
                  <Link href="/personal" className={styles.link} onClick={closeMenu}>점수 기록</Link>
                  <Link href="/team" className={styles.link} onClick={closeMenu}>팀 관리</Link>
                  <Link href="/stats" className={styles.link} onClick={closeMenu}>통계/순위</Link>
                </>
              )}
              <Link href="/settings" className={styles.link} onClick={closeMenu}>계정 설정</Link>
              <button
                type="button"
                onClick={handleLogout}
                className={styles.logoutBtn}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.link} onClick={closeMenu}>로그인</Link>
              <Link href="/register" className="btn btn-primary" onClick={closeMenu}>회원가입</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
