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

export async function getAnimeById(id) {
  const QUERY = `
    query ($malId: Int) {
      Media(idMal: $malId, type: ANIME) {
        id
        idMal
        title { romaji english native }
        synonyms
        source
        coverImage { extraLarge large color }
        bannerImage
        description(asHtml: false)
        averageScore
        popularity
        genres
        studios(isMain: true) { nodes { name } }
        episodes
        status
        season
        seasonYear
        format
        trailer { id site }
        nextAiringEpisode { episode }
        startDate { year month day }
        duration
        externalLinks { site url }
        characters(sort: [ROLE, RELEVANCE]) {
          nodes {
            id
            name { full }
            image { large }
          }
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { malId: Number(id) });
  
  if (!data?.Media) {
    return { anime: null, episodes: [], pagination: null, characters: [], streaming: [] };
  }

  const AL = data.Media;
  
  const mappedAnime = {
    mal_id: AL.idMal || id,
    images: { jpg: { large_image_url: AL.coverImage?.extraLarge || AL.coverImage?.large } },
    title_english: AL.title?.english,
    title: AL.title?.romaji || AL.title?.english,
    title_japanese: AL.title?.native,
    title_synonyms: AL.synonyms,
    synopsis: AL.description,
    score: AL.averageScore ? (AL.averageScore / 10).toFixed(2) : null,
    rank: null,
    popularity: AL.popularity,
    genres: AL.genres?.map(name => ({ name })) || [],
    studios: AL.studios?.nodes?.map(s => ({ name: s.name })) || [],
    status: AL.status,
    type: AL.format,
    episodes: AL.episodes,
    aired: { string: AL.startDate?.year ? `${AL.startDate.year}` : '' },
    duration: AL.duration ? `${AL.duration} min per ep` : '',
    source: AL.source,
  };

  const epsCount = AL.episodes || (AL.nextAiringEpisode ? AL.nextAiringEpisode.episode - 1 : 24);
  const mappedEpisodes = Array.from({ length: Math.max(0, epsCount) }).map((_, i) => ({
    mal_id: i + 1,
    title: `Episode ${i + 1}`,
  }));

  const mappedCharacters = (AL.characters?.nodes || []).slice(0, 12).map(c => ({
    character: {
      mal_id: c.id,
      name: c.name?.full,
      images: { jpg: { image_url: c.image?.large } }
    },
    role: 'Main'
  }));

  const mappedStreaming = AL.externalLinks?.filter(l => ['Crunchyroll', 'Netflix', 'Hulu', 'Funimation', 'Amazon', 'HIDIVE'].includes(l.site)).map(link => ({
    name: link.site,
    url: link.url
  })) || [];

  return {
    anime: mappedAnime,
    episodes: mappedEpisodes,
    pagination: { has_next_page: false, last_visible_page: 1 },
    characters: mappedCharacters,
    streaming: mappedStreaming
  };
}

export async function getAnimeEpisodes(id, page = 1) {
  return { episodes: [], pagination: { has_next_page: false } };
}

export async function getAnimeRecommendations(id) {
  const QUERY = `
    query ($malId: Int) {
      Media(idMal: $malId, type: ANIME) {
        recommendations(sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              ${ANIME_QUERY_FIELDS}
            }
          }
        }
      }
    }
  `;
  const data = await anilistFetch(QUERY, { malId: Number(id) });
  return data?.Media?.recommendations?.nodes?.map(n => n.mediaRecommendation).filter(Boolean).slice(0, 12) || [];
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
    return [];
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
export function getStreamUrlFallbacks(malId, episode = 1, anilistId = null, title = "") {
  const fallbacks = [
    { name: 'Server 1', url: `/api/anime/stream/animepahe?title=${encodeURIComponent(title)}&episode=${episode}` },
    { name: 'Server 2', url: `https://vidlink.pro/anime/${malId}/${episode}/sub?fallback=true` },
    { name: 'Server 3', url: `https://vidsrc.to/embed/anime/${malId}/${episode}` },
    { name: 'Server 4', url: `https://vidsrc.me/embed/anime?malId=${malId}&ep=${episode}` }
  ];
  return fallbacks.filter(f => f.url);
}






