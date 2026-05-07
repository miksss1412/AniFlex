'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { searchAnime } from '@/lib/api';
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
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { 
    setMenuOpen(false); 
    setShowSuggestions(false);
  }, [pathname]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    
    if (val.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchAnime(val, { page: 1, sort: 'SEARCH_MATCH' });
        setSuggestions(res.results.slice(0, 5));
        setShowSuggestions(true);
      } catch (err) {
        console.error("Suggestion fetch error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
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
              onChange={handleInputChange}
              onFocus={() => { if (query.trim()) setShowSuggestions(true); }}
              className={styles.searchInput}
              autoComplete="off"
            />
            {/* Suggestions Dropdown */}
            {showSuggestions && (query.trim().length > 0) && (
              <div className={styles.suggestionsDropdown}>
                {isSearching ? (
                  <div className={styles.suggestionItem}>Searching...</div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((anime) => (
                    <Link 
                      key={anime.id} 
                      href={`/watch/${anime.idMal || anime.id}`}
                      className={styles.suggestionItem}
                      onClick={() => setShowSuggestions(false)}
                    >
                      <img src={anime.coverImage?.extraLarge || anime.coverImage?.large} alt="" className={styles.suggestionImg} />
                      <div className={styles.suggestionInfo}>
                        <div className={styles.suggestionTitle}>
                          {anime.title.english || anime.title.romaji}
                        </div>
                        <div className={styles.suggestionMeta}>
                          {anime.format && <span>{anime.format}</span>}
                          {anime.seasonYear && <span>• {anime.seasonYear}</span>}
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className={styles.suggestionItem}>No results found</div>
                )}
              </div>
            )}
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
