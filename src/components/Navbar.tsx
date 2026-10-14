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

        <button className={styles.menuToggle} onClick={toggleMenu} aria-label="메뉴 열기 또는 닫기" aria-expanded={isOpen} aria-controls="main-navigation">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M4 12h16M4 6h16M4 18h16" />
            )}
          </svg>
        </button>

        <div id="main-navigation" className={`${styles.links} ${isOpen ? styles.linksOpen : ''}`}>
          <Link href={isLoggedIn ? '/team' : '/login'} className={`${styles.link} ${styles.coreLink}`} onClick={closeMenu}>동호회</Link>
          <Link href="/centers" className={`${styles.link} ${styles.coreLink}`} onClick={closeMenu}>볼링장</Link>
          <Link href="/competitions" className={styles.link} onClick={closeMenu}>대회 정보</Link>
          <Link href="/equipment" className={styles.link} onClick={closeMenu}>볼링 용품</Link>
          <Link href="/community" className={styles.link} onClick={closeMenu}>커뮤니티</Link>
          <Link href="/guide" className={styles.link} onClick={closeMenu}>이용방법 & 가이드</Link>
          {isLoggedIn ? (
            <details className={styles.accountMenu}>
              <summary className={styles.link}>내 계정 ▾</summary>
              <div className={styles.accountLinks}>
              {userRole === 'SUPER_ADMIN' ? (
                <>
                  <Link href="/admin" className={styles.link} onClick={closeMenu}>사이트 관리</Link>
                  <Link href="/competitions/manage" className={styles.link} onClick={closeMenu}>대회정보 관리</Link>
                  <Link href="/centers" className={styles.link} onClick={closeMenu}>센터/대회 관리</Link>
                  <Link href="/inquiry" className={styles.link} onClick={closeMenu}>문의 관리</Link>
                </>
              ) : (
                <>
                  <Link href="/personal" className={styles.link} onClick={closeMenu}>나의 기록실</Link>
                  <Link href="/team" className={styles.link} onClick={closeMenu}>팀 관리</Link>
                  <Link href="/inquiry" className={styles.link} onClick={closeMenu}>문의하기</Link>
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
              </div>
            </details>
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
