// ─── Jikan API v4 (free, no auth, MAL data) ───────────────
const JIKAN_BASE = 'https://api.jikan.moe/v4';

// Jikan rate limit: 3 req/sec — add a small delay helper
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function jikanFetch(path, retries = 3, options = {}) {
  try {
    const fetchOptions = {
      next: { revalidate: 3600 },
      ...options
    };
    
    if (options.cache === 'no-store') {
      delete fetchOptions.next;
    }

    const res = await fetch(`${JIKAN_BASE}${path}`, fetchOptions);
    
    // Handle rate limits (429) and transient server errors (500+)
    if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
      if (retries > 0) {
        // Exponential backoff
        const waitTime = (Math.pow(2, 5 - retries) * 1000) + (Math.random() * 500);
        console.warn(`Jikan error ${res.status} on ${path}. Retrying (${retries} left) in ${Math.round(waitTime)}ms...`);
        await delay(waitTime);
        return jikanFetch(path, retries - 1, options);
      }
      return null;
    }
    
    if (!res.ok) {
      console.error(`Jikan fetch failed: ${res.status} ${res.statusText} for ${path}`);
      return null;
    }

    return res.json();
  } catch (e) {
    console.error('Jikan fetch exception:', e);
    return null;
  }
}

// ─── AniList GraphQL ───────────────────────────────────────
const ANILIST = 'https://graphql.anilist.co';

async function anilistFetch(query, variables = {}) {
  try {
    const res = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`AniList ${res.status}`);
    const { data } = await res.json();
    return data;
  } catch (e) {
    console.error('AniList fetch error:', e);
    return null;
  }
}

// ─── Public API Calls (Now powered by AniList) ───────────────

const ANIME_QUERY_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  averageScore
  episodes
  status
  format
  season
  seasonYear
  genres
  description(asHtml: false)
`;

export async function getTrendingAnime(page = 1, perPage = 20) {
  const QUERY = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          ${ANIME_QUERY_FIELDS}
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getPopularAnime(page = 1, perPage = 20) {
  const QUERY = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${ANIME_QUERY_FIELDS}
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getSeasonalAnime(page = 1, perPage = 20) {
  const QUERY = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(status: RELEASING, sort: START_DATE_DESC, type: ANIME, isAdult: false) {
          ${ANIME_QUERY_FIELDS}
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getUpcomingAnime(page = 1, perPage = 20) {
  const QUERY = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(status: NOT_YET_RELEASED, sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          ${ANIME_QUERY_FIELDS}
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getRecentAnime(page = 1, perPage = 20) {
  // Using Airing Schedule for recently updated episodes
  const QUERY = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        airingSchedules(sort: TIME_DESC, airingAt_lesser: ${Math.floor(Date.now()/1000)}) {
          media {
            ${ANIME_QUERY_FIELDS}
          }
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { page, perPage });
  return data?.Page?.airingSchedules?.map(item => item.media) || [];
}

export async function getSchedules() {
  // Get anime airing in the next 24 hours
  const now = Math.floor(Date.now() / 1000);
  const tomorrow = now + 86400;
  const QUERY = `
    query ($now: Int, $tomorrow: Int) {
      Page(page: 1, perPage: 20) {
        airingSchedules(airingAt_greater: $now, airingAt_lesser: $tomorrow, sort: TIME) {
          media {
            ${ANIME_QUERY_FIELDS}
          }
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { now, tomorrow });
  return data?.Page?.airingSchedules?.map(item => item.media) || [];
}

export async function searchAnime(q, { page = 1, genres = [], type = '', status = '', sort = 'POPULARITY_DESC' } = {}) {
  const QUERY = `
    query ($page: Int, $q: String, $genres: [String], $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort]) {
      Page(page: $page, perPage: 24) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(search: $q, genre_in: $genres, format: $format, status: $status, sort: $sort, type: ANIME, isAdult: false) {
          ${ANIME_QUERY_FIELDS}
        }
      }
    }
  `;
  
  // Clean up variables
  const variables = { 
    page, 
    q: q ? q.trim() : undefined, 
    genres: (genres && genres.length > 0) ? genres : undefined,
    // Note: AniList errors if sort is SEARCH_MATCH but search is null/undefined
    sort: q ? ['SEARCH_MATCH', 'POPULARITY_DESC'] : [sort === 'SEARCH_MATCH' ? 'POPULARITY_DESC' : sort]
  };
  
  if (type) variables.format = type;
  if (status) variables.status = status;

  const data = await anilistFetch(QUERY, variables);
  return { 
    results: data?.Page?.media || [], 
    pagination: {
      last_visible_page: data?.Page?.pageInfo?.lastPage,
      has_next_page: data?.Page?.pageInfo?.hasNextPage
    }
  };
}

// Simple in‑memory cache for streaming data (TTL 5 min)
const streamingCache = new Map();
function getStreamingData(malId) {
  const cacheKey = `streaming-${malId}`;
  const now = Date.now();
  const entry = streamingCache.get(cacheKey);
  if (entry && now - entry.timestamp < 5 * 60 * 1000) {
    return Promise.resolve(entry.data);
  }
  // Use jikanFetch with its own retry/backoff logic
  return jikanFetch(`/anime/${malId}/streaming`).then(data => {
    streamingCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  });
}

export async function getAnimeById(id) {
  // Give the critical anime lookup more retries (5) to survive rate limits
  const anime      = await jikanFetch(`/anime/${id}/full`, 5);
  await delay(350); 
  const episodes   = await jikanFetch(`/anime/${id}/episodes?page=1`);
  await delay(350);
  const characters = await jikanFetch(`/anime/${id}/characters`, 3, { cache: 'no-store' });
  await delay(350);
  const streaming  = await getStreamingData(id);

  return {
    anime:      anime?.data || null,
    episodes:   episodes?.data || [],
    pagination: episodes?.pagination || null,
    characters: characters?.data?.slice(0, 12) || [],
    streaming:  streaming?.data || [],
  };
}

export async function getAnimeEpisodes(id, page = 1) {
  const data = await jikanFetch(`/anime/${id}/episodes?page=${page}`);
  return { episodes: data?.data || [], pagination: data?.pagination };
}

export async function getAnimeRecommendations(id) {
  const data = await jikanFetch(`/anime/${id}/recommendations`);
  return data?.data?.slice(0, 12).map(r => r.entry) || [];
}

// ─── Manga API (AniList + MangaDex) ──────────────────────────

const MANGA_QUERY_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  averageScore
  chapters
  volumes
  status
  format
  countryOfOrigin
  genres
`;

export async function getTrendingManga(page = 1, perPage = 20) {
  const QUERY = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: MANGA, isAdult: false) {
          ${MANGA_QUERY_FIELDS}
          description(asHtml: false)
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getPopularManga(page = 1, perPage = 20) {
  const QUERY = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: MANGA, isAdult: false) {
          ${MANGA_QUERY_FIELDS}
          description(asHtml: false)
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getRecentManga(page = 1, perPage = 20) {
  const QUERY = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: UPDATED_AT_DESC, type: MANGA, isAdult: false) {
          ${MANGA_QUERY_FIELDS}
          description(asHtml: false)
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function getTopManga(page = 1, perPage = 20) {
  const QUERY = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: SCORE_DESC, type: MANGA, isAdult: false) {
          ${MANGA_QUERY_FIELDS}
          description(asHtml: false)
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { page, perPage });
  return data?.Page?.media || [];
}

export async function searchManga(q, { page = 1, genres = [], sort = 'POPULARITY_DESC' } = {}) {
  const QUERY = `
    query ($page: Int, $q: String, $genres: [String], $sort: [MediaSort]) {
      Page(page: $page, perPage: 24) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(search: $q, genre_in: $genres, sort: $sort, type: MANGA, isAdult: false) {
          ${MANGA_QUERY_FIELDS}
          description(asHtml: false)
        }
      }
    }
  `;
  const variables = { 
    page, 
    q: q ? q.trim() : undefined, 
    genres: (genres && genres.length > 0) ? genres : undefined,
    sort: q ? ['SEARCH_MATCH', 'POPULARITY_DESC'] : [sort]
  };
  const data = await anilistFetch(QUERY, variables);
  return { 
    results: data?.Page?.media || [], 
    pagination: {
      last_visible_page: data?.Page?.pageInfo?.lastPage,
      has_next_page: data?.Page?.pageInfo?.hasNextPage
    }
  };
}

export async function getMangaById(id) {
  const QUERY = `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        ${MANGA_QUERY_FIELDS}
        description(asHtml: true)
        tags { name rank }
        characters(sort: [ROLE, RELEVANCE]) {
          nodes {
            id
            name { full }
            image { large }
          }
        }
        recommendations(sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              ${MANGA_QUERY_FIELDS}
              description(asHtml: false)
            }
          }
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { id: Number(id) });
  return data?.Media || null;
}

// ─── MangaDex (Reading Content) ─────────────────────────────
const MANGADEX_BASE = 'https://api.mangadex.org';

export async function getMangaDexId(titleObj) {
  const titles = [
    titleObj.english,
    titleObj.romaji,
    titleObj.native
  ].filter(Boolean);

  for (const title of titles) {
    try {
      const res = await fetch(`${MANGADEX_BASE}/manga?title=${encodeURIComponent(title)}&limit=1&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`);
      const data = await res.json();
      if (data?.data?.length > 0) {
        return data.data[0].id;
      }
    } catch (e) {
      console.error(`MangaDex search error for ${title}:`, e);
    }
  }
  return null;
}

export async function getMangaChapters(mangaDexId) {
  try {
    // We want to get as many chapters as possible, ordered by chapter number descending
    const res = await fetch(`${MANGADEX_BASE}/manga/${mangaDexId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=500&includeEmptyPages=0&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`);
    const data = await res.json();
    
    if (!data?.data) return [];

    // Filter out duplicates (multiple scanlations for the same chapter)
    // We'll keep the first one we find for each chapter number
    const seen = new Set();
    const filtered = data.data.filter(ch => {
      const num = ch.attributes.chapter;
      if (!num || seen.has(num)) return false;
      seen.add(num);
      return true;
    });

    return filtered;
  } catch (e) {
    console.error('MangaDex chapters error:', e);
    return [];
  }
}

export async function getChapterPages(chapterId) {
  try {
    const res = await fetch(`${MANGADEX_BASE}/at-home/server/${chapterId}`);
    if (!res.ok) return [];
    const data = await res.json();
    const hash = data.chapter.hash;
    const files = data.chapter.data;
    const baseUrl = data.baseUrl;
    return files.map(f => `${baseUrl}/data/${hash}/${f}`);
  } catch (e) {
    console.error('MangaDex pages error:', e);
  }
}

// ─── Fallback API (MangaHook) ───────────────────────────────
const FALLBACK_API_BASE = 'https://mangahook-api.vercel.app/api';

export async function getFallbackId(titleObj) {
  const title = titleObj.english || titleObj.romaji;
  if (!title) return null;

  try {
    const res = await fetch(`${FALLBACK_API_BASE}/search/${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return null;
    
    const data = await res.json();
    return data?.searchData?.[0]?.id || null;
  } catch (e) {
    console.error('Fallback search error:', e);
    return null;
  }
}

export async function getFallbackChapters(fallbackId) {
  try {
    const res = await fetch(`${FALLBACK_API_BASE}/manga/${fallbackId}`);
    if (!res.ok) return [];
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return [];

    const data = await res.json();
    if (!data?.chapterList) return [];
    return data.chapterList.map(ch => ({
      id: ch.path,
      attributes: {
        chapter: ch.chapterTitle.replace(/[^0-9.]/g, ''),
        title: ch.chapterTitle,
        translatedLanguage: 'en'
      },
      isFallback: true
    })).sort((a, b) => b.attributes.chapter - a.attributes.chapter);
  } catch (e) {
    console.error('Fallback chapters error:', e);
    return [];
  }
}

export async function getFallbackPages(mangaId, chapterId) {
  try {
    const res = await fetch(`${FALLBACK_API_BASE}/manga/${mangaId}/${chapterId}`);
    if (!res.ok) return [];
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return [];

    const data = await res.json();
    return data?.images || [];
  } catch (e) {
    console.error('Fallback pages error:', e);
    return [];
  }
}

// ─── AniList Banner / Extra data ──────────────────────────
export async function getAnilistData(malId) {
  const QUERY = `
    query ($malId: Int) {
      Media(idMal: $malId, type: ANIME) {
        id
        bannerImage
        coverImage { large extraLarge color }
        description(asHtml: false)
        averageScore
        popularity
        genres
        trailer { id site }
        studios(isMain: true) { nodes { name } }
        nextAiringEpisode { episode airingAt }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { malId: Number(malId) });
  return data?.Media || null;
}

export async function getAnilistTrending(page = 1, perPage = 10) {
  const QUERY = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          idMal
          title { romaji english }
          coverImage { large extraLarge }
          bannerImage
          averageScore
          genres
          episodes
          status
          season
          seasonYear
          format
          description(asHtml: false)
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { page, perPage });
  return data?.Page?.media || [];
}

// ─── Genre list ────────────────────────────────────────────
export async function getGenres() {
  const data = await jikanFetch('/genres/anime');
  return data?.data || [];
}

// ─── Streaming embed URL builder ──────────────────────────
// We use vidsrc.to (public embed service) for video streaming
// URL format: https://vidsrc.to/embed/anime/{mal_id}/{episode}
export function getStreamUrl(malId, episode = 1) {
  return `https://vidsrc.to/embed/anime/${malId}/${episode}`;
}

// Fallback embed URLs (try in order if first fails)
export function getStreamUrlFallbacks(malId, episode = 1, anilistId = null, title = "") {
  // Generate a URL-friendly slug from the anime title (e.g., "One Piece" -> "one-piece")
  const slug = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : '';

  const fallbacks = [
    // 1. VidSrc.vip (Extremely fast, unrestricted mirror)
    `https://vidsrc.vip/embed/anime/${malId}/${episode}`,

    // 2. Playtaku / Embtaku (Active GoLoad/Vidstreaming mirrors, highly reliable but strict rate limits)
    slug ? `https://playtaku.net/streaming.php?id=${slug}-episode-${episode}` : null,
    slug ? `https://embtaku.pro/streaming.php?id=${slug}-episode-${episode}` : null,

    // 4. VidLink (Very accurate, but One Piece mapping might be broken)
    `https://vidlink.pro/anime/${malId}/${episode}/sub?fallback=true`,

    // 5. VidSrc.cc (Currently having Cloudflare iframe blocks, but good fallback)
    `https://vidsrc.cc/v2/embed/anime/${malId}/${episode}`,
  ];
  return fallbacks.filter(Boolean);
}
