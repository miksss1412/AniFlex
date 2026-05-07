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
    
    // Conflict: revalidate and cache: no-store cannot both be present
    if (options.cache === 'no-store') {
      delete fetchOptions.next;
    }

    const res = await fetch(`${JIKAN_BASE}${path}`, fetchOptions);
    
    if (res.status === 429) {
      if (retries > 0) {
        const waitTime = (Math.pow(2, 3 - retries) * 1000) + (Math.random() * 500);
        console.warn(`Rate limited on ${path}. Retrying in ${Math.round(waitTime)}ms...`);
        await delay(waitTime);
        return jikanFetch(path, retries - 1, options);
      }
      throw new Error('Rate limited');
    }
    
    if (!res.ok) throw new Error(`Jikan ${res.status}`);
    return res.json();
  } catch (e) {
    if (e.message === 'Rate limited') throw e;
    console.error('Jikan fetch error:', e);
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

export async function searchAnime(q, { page = 1, genres = [], type = '', status = '', sort = 'SEARCH_MATCH' } = {}) {
  const QUERY = `
    query ($page: Int, $q: String, $genres: [String], $format: [MediaFormat], $status: MediaStatus, $sort: [MediaSort]) {
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
    genres: (genres && genres.length) ? genres : undefined,
    // If there's a search query and no explicit sort, use SEARCH_MATCH
    sort: q ? ['SEARCH_MATCH', 'POPULARITY_DESC'] : [sort]
  };
  
  if (type) variables.format = [type];
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

export async function getAnimeById(id) {
  // Burst is 3 req/sec. Sequence them with small delays to be safe.
  const anime      = await jikanFetch(`/anime/${id}/full`);
  await delay(350); 
  const episodes   = await jikanFetch(`/anime/${id}/episodes?page=1`);
  await delay(350);
  // Characters for long series (One Piece, etc) can exceed 2MB cache limit.
  // We opt out of Next.js caching for this specific request.
  const characters = await jikanFetch(`/anime/${id}/characters`, 3, { cache: 'no-store' });
  await delay(350);
  const streaming  = await jikanFetch(`/anime/${id}/streaming`);

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
