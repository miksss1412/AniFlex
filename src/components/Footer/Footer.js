'use client';
import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  const discoveryLinks = [
    { href: '/search', label: 'Browse Anime' },
    { href: '/search?filter=recent', label: 'Latest Updates' },
    { href: '/search?filter=trending', label: 'Trending' },
    { href: '/search?filter=popular', label: 'Top Anime' },
    { href: '/search?filter=seasonal', label: 'Seasonal' },
  ];

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.footerInner}>
          <div className={styles.footerGrid}>
            <div className={styles.logoCol}>
              <Link href="/" className={styles.logo} aria-label="AniFlex home">
                <span className={styles.logoMark} aria-hidden="true" />
                <span className={styles.logoText}>
                  Ani<span className={styles.logoAccent}>Flex</span>
                </span>
              </Link>
              <p className={styles.description}>
                Watch your favorite anime for free. Stay updated with the latest episodes and join our growing community.
              </p>
              <div className={styles.brandMeta} aria-label="AniFlex highlights">
                <span>HD Anime</span>
                <span>Fast Updates</span>
                <span>Manga Reader</span>
              </div>
            </div>

            <div className={styles.linksCol}>
              <h3 className={styles.columnTitle}>Discovery</h3>
              <ul className={styles.linkList}>
                {discoveryLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.bottomBar}>
            <p className={styles.copyright}>&copy; 2026 ANIFLEX, ALL RIGHTS RESERVED.</p>
            <div className={styles.legalLinks}>
              <Link href="#">Privacy Policy</Link>
              <Link href="#">Terms of Use</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
