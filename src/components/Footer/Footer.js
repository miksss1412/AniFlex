'use client';
import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.footerGrid}>
          {/* Logo & Description */}
          <div className={styles.logoCol}>
            <Link href="/" className={styles.logo}>
              ▶ Ani<span className={styles.logoAccent}>Flex</span>
            </Link>
            <p className={styles.description}>
              Watch your favorite anime for free. Stay updated with the latest episodes and join our growing community.
            </p>
          </div>

          {/* Discovery */}
          <div className={styles.linksCol}>
            <h3 className={styles.columnTitle}>Discovery</h3>
            <ul className={styles.linkList}>
              <li><Link href="/search">Browse Anime</Link></li>
              <li><Link href="/search?filter=recent">Latest Updates</Link></li>
              <li><Link href="/search?filter=trending">Trending</Link></li>
              <li><Link href="/search?filter=popular">Top Anime</Link></li>
              <li><Link href="/search?filter=seasonal">Seasonal</Link></li>
            </ul>
          </div>
        </div>

        <div className={styles.bottomBar}>
          <p className={styles.copyright}>© 2026 ANIFLEX, ALL RIGHTS RESERVED.</p>
          <div className={styles.legalLinks}>
            <Link href="#">Privacy Policy</Link>
            <Link href="#">Terms of Use</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
