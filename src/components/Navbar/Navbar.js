'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import styles from './Navbar.module.css';

function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get('filter');

  const navLinks = [
    { href: '/',         label: 'Home'     },
    { href: '/search',   label: 'Browse'   },
    { href: '/search?filter=trending',  label: 'Trending' },
    { href: '/search?filter=seasonal',  label: 'Seasonal' },
  ];

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    if (href.includes('?')) {
      const [path, query] = href.split('?');
      const params = new URLSearchParams(query);
      const filter = params.get('filter');
      return pathname === path && currentFilter === filter;
    }
    // For Browse, only active if exactly /search and no filter
    if (href === '/search') return pathname === '/search' && !currentFilter;
    return pathname === href;
  };

  return (
    <ul className={`${styles.links} hide-mobile`}>
      {navLinks.map(l => (
        <li key={l.href}>
          <Link
            href={l.href}
            className={`${styles.link} ${isActive(l.href) ? styles.active : ''}`}
          >
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

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

  const mobileLinks = [
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
        <Suspense fallback={<div className={styles.linksPlaceholder} />}>
          <NavLinks />
        </Suspense>

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
          {mobileLinks.map(l => (
            <Link key={l.href} href={l.href} className={styles.drawerLink}>{l.label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}
