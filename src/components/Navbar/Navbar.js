'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [scrolled, setScrolled]   = useState(false);
  const [query, setQuery]         = useState('');
  const [menuOpen, setMenuOpen]   = useState(false);
  const router   = useRouter();
  const pathname = usePathname();
  const inputRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const navLinks = [
    { href: '/',         label: 'Home'     },
    { href: '/search',   label: 'Browse'   },
    { href: '/search?filter=trending',  label: 'Trending' },
    { href: '/search?filter=seasonal',  label: 'Seasonal' },
  ];

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <div className={`container ${styles.inner}`}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>▶</span>
          <span>Ani<span className={styles.logoAccent}>Flex</span></span>
        </Link>

        {/* Desktop Nav Links */}
        <ul className={`${styles.links} hide-mobile`}>
          {navLinks.map(l => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`${styles.link} ${pathname === l.href ? styles.active : ''}`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Search */}
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              ref={inputRef}
              id="navbar-search"
              type="text"
              placeholder="Search anime..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className={styles.searchInput}
              autoComplete="off"
            />
          </div>
        </form>

        {/* Mobile menu toggle */}
        <button
          className={`${styles.hamburger} hide-desktop`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen1 : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen2 : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen3 : ''}`} />
        </button>
      </div>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className={`${styles.drawer} hide-desktop`}>
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} className={styles.drawerLink}>{l.label}</Link>
          ))}
          <form onSubmit={handleSearch} className={styles.drawerSearch}>
            <input
              type="text"
              placeholder="Search anime..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="input"
            />
          </form>
        </div>
      )}
    </nav>
  );
}
