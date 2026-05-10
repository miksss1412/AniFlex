'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  searchAnime,
  getTrendingAnime,
  getPopularAnime,
  getSeasonalAnime,
  getUpcomingAnime,
  getRecentAnime,
  getTrendingManga,
  getPopularManga,
  getRecentManga,
  getTopManga,
  searchManga
} from '@/lib/api';
import AnimeCard from '@/components/AnimeCard/AnimeCard';
import styles from './Search.module.css';

const DEFAULT_SORT = 'POPULARITY_DESC';
const ANIME_FORMATS = ['', 'TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'MUSIC'];
const MANGA_FORMATS = ['', 'MANGA', 'NOVEL', 'ONE_SHOT'];
const STATUSES = ['', 'RELEASING', 'FINISHED', 'NOT_YET_RELEASED'];
const ANIME_SORTS = [
  { value: 'POPULARITY_DESC', label: 'Popularity' },
  { value: 'SCORE_DESC', label: 'Score' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'START_DATE_DESC', label: 'Newest' },
  { value: 'EPISODES_DESC', label: 'Episodes' },
];
const MANGA_SORTS = [
  { value: 'POPULARITY_DESC', label: 'Popularity' },
  { value: 'SCORE_DESC', label: 'Score' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'START_DATE_DESC', label: 'Newest' },
  { value: 'CHAPTERS_DESC', label: 'Chapters' },
];

function getMediaType(params) {
  return params.get('type')?.toLowerCase() === 'manga' ? 'manga' : 'anime';
}

function getFormat(params, mediaType) {
  const explicitFormat = params.get('format');
  const legacyType = params.get('type') || '';
  const value = explicitFormat || (mediaType === 'anime' && legacyType.toLowerCase() !== 'manga' ? legacyType : '');
  const normalized = value.toUpperCase();
  const allowed = mediaType === 'manga' ? MANGA_FORMATS : ANIME_FORMATS;

  return allowed.includes(normalized) ? normalized : '';
}

function getSort(params, mediaType) {
  const value = params.get('sort') || DEFAULT_SORT;
  const allowed = mediaType === 'manga' ? MANGA_SORTS : ANIME_SORTS;

  return allowed.some(option => option.value === value) ? value : DEFAULT_SORT;
}

function formatLabel(value, fallback) {
  return value ? value.replace(/_/g, ' ') : fallback;
}

function mergeUnique(prev, next, append) {
  const combined = append ? [...prev, ...next] : next;
  const seen = new Set();

  return combined.filter(item => {
    const id = item.mal_id || item.id;
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export default function SearchClient({ genres = [] }) {
  const searchParams = useSearchParams();
  const initialMediaType = getMediaType(searchParams);
  const initialQuery = searchParams.get('q') || '';

  const [mediaType, setMediaType] = useState(initialMediaType);
  const [query, setQuery] = useState(initialQuery);
  const [format, setFormat] = useState(getFormat(searchParams, initialMediaType));
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [genre, setGenre] = useState(searchParams.get('genre') || '');
  const [sort, setSort] = useState(getSort(searchParams, initialMediaType));
  const [filter, setFilter] = useState(searchParams.get('filter') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [inputVal, setInputVal] = useState(initialQuery);

  const debounceRef = useRef(null);

  const doSearch = useCallback(async ({
    q,
    mediaType: nextMediaType,
    format: nextFormat,
    status: nextStatus,
    genre: nextGenre,
    sort: nextSort,
    filter: nextFilter,
    page: nextPage,
    append = false,
  }) => {
    setLoading(true);

    const isMangaSearch = nextMediaType === 'manga';
    const hasManualFilter = Boolean(
      q || nextFormat || nextStatus || nextGenre || nextSort !== DEFAULT_SORT
    );

    try {
      if (nextFilter && !hasManualFilter) {
        let data;

        if (nextFilter === 'trending') {
          data = isMangaSearch ? await getTrendingManga(nextPage, 24) : await getTrendingAnime(nextPage, 24);
        } else if (nextFilter === 'popular') {
          data = isMangaSearch ? await getPopularManga(nextPage, 24) : await getPopularAnime(nextPage, 24);
        } else if (nextFilter === 'top') {
          data = isMangaSearch ? await getTopManga(nextPage, 24) : await getPopularAnime(nextPage, 24);
        } else if (nextFilter === 'recent') {
          data = isMangaSearch ? await getRecentManga(nextPage, 24) : await getRecentAnime(nextPage, 24);
        } else if (nextFilter === 'seasonal' && !isMangaSearch) {
          data = await getSeasonalAnime(nextPage, 24);
        } else if (nextFilter === 'upcoming' && !isMangaSearch) {
          data = await getUpcomingAnime(nextPage, 24);
        } else {
          data = isMangaSearch ? await getPopularManga(nextPage, 24) : await getPopularAnime(nextPage, 24);
        }

        const safeData = data || [];
        setResults(prev => mergeUnique(prev, safeData, append));
        setHasMore(safeData.length === 24);
        return;
      }

      const genreList = nextGenre ? [nextGenre] : [];
      const result = isMangaSearch
        ? await searchManga(q, {
            page: nextPage,
            genres: genreList,
            format: nextFormat,
            status: nextStatus,
            sort: nextSort,
          })
        : await searchAnime(q, {
            page: nextPage,
            genres: genreList,
            type: nextFormat,
            status: nextStatus,
            sort: nextSort,
          });

      const safeResults = result?.results || [];
      setResults(prev => mergeUnique(prev, safeResults, append));
      setHasMore(result?.pagination?.has_next_page || false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const nextMediaType = getMediaType(searchParams);
    const nextQuery = searchParams.get('q') || '';
    const nextFormat = getFormat(searchParams, nextMediaType);
    const nextStatus = searchParams.get('status') || '';
    const nextGenre = searchParams.get('genre') || '';
    const nextSort = getSort(searchParams, nextMediaType);
    const nextFilter = searchParams.get('filter') || '';

    setMediaType(nextMediaType);
    setQuery(nextQuery);
    setInputVal(nextQuery);
    setFormat(nextFormat);
    setStatus(nextStatus);
    setGenre(nextGenre);
    setSort(nextSort);
    setFilter(nextFilter);
    setPage(1);

    doSearch({
      q: nextQuery,
      mediaType: nextMediaType,
      format: nextFormat,
      status: nextStatus,
      genre: nextGenre,
      sort: nextSort,
      filter: nextFilter,
      page: 1,
    });
  }, [searchParams, doSearch]);

  const triggerSearch = useCallback((q, nextFormat, nextStatus, nextGenre, nextSort) => {
    setPage(1);
    setFilter('');
    doSearch({
      q,
      mediaType,
      format: nextFormat,
      status: nextStatus,
      genre: nextGenre,
      sort: nextSort,
      filter: '',
      page: 1,
    });
  }, [doSearch, mediaType]);

  const handleInputChange = (val) => {
    setInputVal(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(val);
      triggerSearch(val, format, status, genre, sort);
    }, 600);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    doSearch({
      q: query,
      mediaType,
      format,
      status,
      genre,
      sort,
      filter,
      page: nextPage,
      append: true,
    });
  };

  const isManga = mediaType === 'manga';
  const formatOptions = isManga ? MANGA_FORMATS : ANIME_FORMATS;
  const sortOptions = isManga ? MANGA_SORTS : ANIME_SORTS;
  const filterLabel =
    filter === 'trending' ? 'Trending' :
    filter === 'popular' ? 'Popular' :
    filter === 'top' ? 'Top Rated' :
    filter === 'seasonal' ? 'Seasonal' :
    filter === 'upcoming' ? 'Upcoming' :
    filter === 'recent' ? 'Recently Updated' : 'Browse';

  return (
    <div className={styles.page}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.header}>
          <h1 className={styles.heading}>
            {filterLabel} <span className={styles.accent}>{isManga ? 'Manga' : 'Anime'}</span>
          </h1>
        </div>

        <div className={styles.filtersRow}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Type</label>
            <select
              id="filter-type"
              value={format}
              onChange={e => {
                const nextFormat = e.target.value;
                setFormat(nextFormat);
                triggerSearch(query, nextFormat, status, genre, sort);
              }}
              className={styles.select}
            >
              {formatOptions.map(option => (
                <option key={option || 'all'} value={option}>
                  {formatLabel(option, 'All Types')}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Status</label>
            <select
              id="filter-status"
              value={status}
              onChange={e => {
                const nextStatus = e.target.value;
                setStatus(nextStatus);
                triggerSearch(query, format, nextStatus, genre, sort);
              }}
              className={styles.select}
            >
              {STATUSES.map(option => (
                <option key={option || 'all'} value={option}>
                  {formatLabel(option, 'All Statuses')}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Sort By</label>
            <select
              id="filter-sort"
              value={sort}
              onChange={e => {
                const nextSort = e.target.value;
                setSort(nextSort);
                triggerSearch(query, format, status, genre, nextSort);
              }}
              className={styles.select}
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.genreWrap}>
          <button
            id="genre-all"
            className={`genre-pill ${!genre ? 'active' : ''}`}
            onClick={() => {
              setGenre('');
              triggerSearch(query, format, status, '', sort);
            }}
          >
            All Genres
          </button>
          {genres.slice(0, 30).map(g => (
            <button
              key={g.mal_id}
              id={`genre-${g.mal_id}`}
              className={`genre-pill ${genre === g.name ? 'active' : ''}`}
              onClick={() => {
                setGenre(g.name);
                triggerSearch(query, format, status, g.name, sort);
              }}
            >
              {g.name}
            </button>
          ))}
        </div>

        <p className={styles.resultsCount}>
          {loading && page === 1
            ? 'Searching...'
            : results.length > 0
              ? `Showing ${results.length} results`
              : !loading ? 'No results found.' : ''}
        </p>

        {loading && page === 1 ? (
          <div className="anime-grid">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
        ) : (
          <div className="anime-grid">
            {results.map((a, i) => (
              <AnimeCard key={`${a.mal_id || a.id || 'idx'}-${i}`} anime={a} priority={i < 4} isManga={isManga} />
            ))}
          </div>
        )}

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
