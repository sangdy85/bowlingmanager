import Link from 'next/link';
import styles from './Navbar.module.css';
import { auth } from "@/auth";

export default async function Navbar() {
  let session: any = null;

  try {
    // Calling the ultralight auth()
    session = await auth();
  } catch (e) {
    console.error("DIAG: Ultralight auth() failed:", e);
  }

  const isLoggedIn = !!(session && session.user);

  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.navContent}`}>
        <Link href="/" className={styles.logo}>
          BowlingManager
        </Link>

        <div className={styles.links}>
          <Link href="/login" className={styles.link}>로그인</Link>
          <Link href="/register" className="btn btn-primary">회원가입</Link>
        </div>
      </div>
    </nav>
  );
}
