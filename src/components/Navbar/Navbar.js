'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { searchAnime, searchManga } from '@/lib/api';
import styles from './Navbar.module.css';

function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get('filter');

  const navLinks = [
    { href: '/',      label: 'Anime' },
    { href: '/manga',  label: 'Manga' },
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

function SearchSync({ setQuery }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname === '/search') {
      const q = searchParams.get('q');
      if (q) setQuery(q);
    }
  }, [pathname, searchParams, setQuery]);

  return null;
}

export default function Navbar() {
  const [scrolled, setScrolled]   = useState(false);
  const [query, setQuery]         = useState('');
  const [menuOpen, setMenuOpen]   = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const router   = useRouter();
  const pathname = usePathname();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);
  const scrolledRef = useRef(false);
  const scrollFrameRef = useRef(null);

  useEffect(() => {
    const updateScrolled = () => {
      scrollFrameRef.current = null;
      const nextScrolled = window.scrollY > 30;
      if (scrolledRef.current !== nextScrolled) {
        scrolledRef.current = nextScrolled;
        setScrolled(nextScrolled);
      }
    };

    const onScroll = () => {
      if (scrollFrameRef.current === null) {
        scrollFrameRef.current = window.requestAnimationFrame(updateScrolled);
      }
    };

    updateScrolled();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => { 
    setMenuOpen(false); 
    setShowSuggestions(false);
    setActiveIndex(-1);
  }, [pathname]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInput = inputRef.current?.contains(event.target);
      const clickedDropdown = dropdownRef.current?.contains(event.target);

      if (!clickedInput && !clickedDropdown) {
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
      const isMangaPage = pathname.startsWith('/manga');
      const typeParam = isMangaPage ? '&type=manga' : '';
      router.push(`/search?q=${encodeURIComponent(query.trim())}${typeParam}`);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);
    
    if (val.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const isMangaPage = pathname.startsWith('/manga');
        const searchFn = isMangaPage ? searchManga : searchAnime;
        const res = await searchFn(val, { page: 1, sort: 'SEARCH_MATCH' });
        setSuggestions(res.results.slice(0, 6));
        setShowSuggestions(true);
      } catch (err) {
        console.error("Suggestion fetch error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        const anime = suggestions[activeIndex];
        setShowSuggestions(false);
        const isMangaPage = pathname.startsWith('/manga');
        const targetUrl = isMangaPage ? `/manga/${anime.id}` : `/anime/${anime.idMal || anime.id}`;
        router.push(targetUrl);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const mobileLinks = [
    { href: '/',      label: 'Anime' },
    { href: '/manga',  label: 'Manga' },
  ];

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <Suspense fallback={null}>
        <SearchSync setQuery={setQuery} />
      </Suspense>
      <div className={`container ${styles.inner}`}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" className={styles.logoIcon}>
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span>Ani<span className={styles.logoAccent}>Flex</span></span>
        </Link>

        {/* Desktop Nav Links */}
        <Suspense fallback={<div className={styles.linksPlaceholder} />}>
          <NavLinks />
        </Suspense>

        {/* Search */}
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.searchWrap}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.searchIcon}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              ref={inputRef}
              id="navbar-search"
              type="text"
              placeholder={`Search ${pathname.startsWith('/manga') ? 'manga' : 'anime'}...`}
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (query.trim()) setShowSuggestions(true); }}
              className={styles.searchInput}
              autoComplete="off"
            />
            {/* Suggestions Dropdown */}
            {showSuggestions && (query.trim().length > 0) && (
              <div ref={dropdownRef} className={styles.suggestionsDropdown}>
                {isSearching ? (
                  <div className={styles.suggestionItem}>Searching...</div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((anime, index) => (
                    <Link 
                      key={anime.id} 
                      href={pathname.startsWith('/manga') ? `/manga/${anime.id}` : `/anime/${anime.idMal || anime.id}`}
                      className={`${styles.suggestionItem} ${activeIndex === index ? styles.activeSuggestion : ''}`}
                      onClick={() => setShowSuggestions(false)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <img src={anime.coverImage?.extraLarge || anime.coverImage?.large} alt="" className={styles.suggestionImg} />
                      <div className={styles.suggestionInfo}>
                        <div className={styles.suggestionTitle}>
                          {anime.title.english || anime.title.romaji}
                        </div>
                        <div className={styles.suggestionMeta}>
                          {anime.status && <span className={styles.status}>{anime.status.replace(/_/g, ' ')}</span>}
                          {anime.format && <span>{anime.format}</span>}
                          {anime.seasonYear && <span>• {anime.seasonYear}</span>}
                          {anime.averageScore && <span className={styles.score}>★ {anime.averageScore / 10}</span>}
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className={styles.suggestionItem}>No results found</div>
                )}
                
                {suggestions.length > 0 && !isSearching && (
                  <Link 
                    href={`/search?q=${encodeURIComponent(query.trim())}${pathname.startsWith('/manga') ? '&type=manga' : ''}`}
                    className={styles.viewAllResults}
                    onClick={() => setShowSuggestions(false)}
                  >
                    View all results for "{query}"
                  </Link>
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
