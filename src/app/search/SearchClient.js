'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import AnimeCard from '@/components/AnimeCard/AnimeCard';
import styles from './Search.module.css';

const TYPES    = ['', 'tv', 'movie', 'ova', 'ona', 'special', 'music'];
const STATUSES = ['', 'airing', 'complete', 'upcoming'];
const SORTS    = [
  { value: 'popularity', label: 'Popularity' },
  { value: 'score',      label: 'Score'      },
  { value: 'rank',       label: 'Rank'       },
  { value: 'title',      label: 'Title'      },
  { value: 'episodes',   label: 'Episodes'   },
  { value: 'start_date', label: 'Newest'     },
];

export default function SearchClient({ genres = [] }) {
  const searchParams = useSearchParams();

  const [query,    setQuery]    = useState(searchParams.get('q')      || '');
  const [type,     setType]     = useState(searchParams.get('type')   || '');
  const [status,   setStatus]   = useState(searchParams.get('status') || '');
  const [genre,    setGenre]    = useState(searchParams.get('genre')  || '');
  const [sort,     setSort]     = useState('popularity');
  const [filter,   setFilter]   = useState(searchParams.get('filter') || '');
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(false);
  const [inputVal, setInputVal] = useState(query);

  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q, tp, st, gn, srt, pg, append = false) => {
    setLoading(true);
    try {
      // Map genre name to MAL genre ID
      const genreObj = genres.find(g => g.name === gn);
      const genreId  = genreObj?.mal_id || '';

      let url;
      if (!q && !tp && !st && !gn) {
        // Use filter shortcuts
        if (filter === 'trending')       url = `/api/proxy?path=/top/anime?filter=airing&page=${pg}&limit=24`;
        else if (filter === 'popular')   url = `/api/proxy?path=/top/anime?filter=bypopularity&page=${pg}&limit=24`;
        else if (filter === 'seasonal')  url = `/api/proxy?path=/seasons/now?page=${pg}&limit=24`;
        else                             url = `/api/proxy?path=/top/anime?filter=bypopularity&page=${pg}&limit=24`;
      } else {
        const params = new URLSearchParams({
          q: q || '',
          page: pg,
          limit: 24,
          sfw: true,
          order_by: srt,
          sort: 'desc',
        });
        if (tp)      params.set('type', tp);
        if (st)      params.set('status', st);
        if (genreId) params.set('genres', genreId);
        url = `/api/proxy?path=/anime?${params}`;
      }

      const res  = await fetch(url);
      const data = await res.json();
      const list = data.data || [];
      const pag  = data.pagination;

      setResults(prev => append ? [...prev, ...list] : list);
      setHasMore(pag?.has_next_page || false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [genres, filter]);

  // Initial search on mount & param change
  useEffect(() => {
    const q  = searchParams.get('q')      || '';
    const f  = searchParams.get('filter') || '';
    const g  = searchParams.get('genre')  || '';
    setQuery(q); setInputVal(q); setFilter(f); setGenre(g);
    setPage(1);
    doSearch(q, type, status, g, sort, 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Re-search on filter changes
  const triggerSearch = useCallback((q, tp, st, gn, srt) => {
    setPage(1);
    doSearch(q, tp, st, gn, srt, 1);
  }, [doSearch]);

  const handleInputChange = (val) => {
    setInputVal(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(val);
      triggerSearch(val, type, status, genre, sort);
    }, 600);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    doSearch(query, type, status, genre, sort, next, true);
  };

  const filterLabel =
    filter === 'trending' ? '🔥 Trending' :
    filter === 'popular'  ? '🏆 Popular'  :
    filter === 'seasonal' ? '📅 Seasonal' : '🔍 Browse';

  return (
    <div className={styles.page}>
      <div className={`container ${styles.inner}`}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.heading}>{filterLabel} <span className={styles.accent}>Anime</span></h1>

          {/* Search bar */}
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              id="search-input"
              type="text"
              placeholder="Search by title…"
              value={inputVal}
              onChange={e => handleInputChange(e.target.value)}
              className={styles.searchInput}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Filters row */}
        <div className={styles.filtersRow}>
          {/* Type */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Type</label>
            <select
              id="filter-type"
              value={type}
              onChange={e => { setType(e.target.value); triggerSearch(query, e.target.value, status, genre, sort); }}
              className={styles.select}
            >
              {TYPES.map(t => (
                <option key={t} value={t}>{t ? t.toUpperCase() : 'All Types'}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Status</label>
            <select
              id="filter-status"
              value={status}
              onChange={e => { setStatus(e.target.value); triggerSearch(query, type, e.target.value, genre, sort); }}
              className={styles.select}
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Statuses'}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Sort By</label>
            <select
              id="filter-sort"
              value={sort}
              onChange={e => { setSort(e.target.value); triggerSearch(query, type, status, genre, e.target.value); }}
              className={styles.select}
            >
              {SORTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Genre pills */}
        <div className={styles.genreWrap}>
          <button
            id="genre-all"
            className={`genre-pill ${!genre ? 'active' : ''}`}
            onClick={() => { setGenre(''); triggerSearch(query, type, status, '', sort); }}
          >
            All Genres
          </button>
          {genres.slice(0, 30).map(g => (
            <button
              key={g.mal_id}
              id={`genre-${g.mal_id}`}
              className={`genre-pill ${genre === g.name ? 'active' : ''}`}
              onClick={() => { setGenre(g.name); triggerSearch(query, type, status, g.name, sort); }}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className={styles.resultsCount}>
          {loading && page === 1
            ? 'Searching…'
            : results.length > 0
              ? `Showing ${results.length} results`
              : !loading ? 'No results found.' : ''}
        </p>

        {/* Grid */}
        {loading && page === 1 ? (
          <div className="anime-grid">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
        ) : (
          <div className="anime-grid">
            {results.map((a, i) => (
              <AnimeCard key={a.mal_id || a.id || i} anime={a} priority={i < 4} />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className={styles.loadMoreWrap}>
            <button id="load-more" className="btn btn-secondary" onClick={handleLoadMore}>
              Load More
            </button>
          </div>
        )}
        {loading && page > 1 && (
          <div className={styles.loadMoreWrap}>
            <div className={styles.spinner} />
          </div>
        )}
      </div>
    </div>
  );
}
