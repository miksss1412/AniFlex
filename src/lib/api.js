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
  countryOfOrigin
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
  // Fetch each visible day separately so later days are not pushed out by
  // AniList's per-page cap when many shows air early in the week.
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const dayVariables = Array.from({ length: 8 }, (_, index) => {
    const dayStart = new Date(start);
    dayStart.setDate(start.getDate() + index);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    return {
      start: Math.floor(dayStart.getTime() / 1000),
      end: Math.floor(dayEnd.getTime() / 1000),
    };
  });

  const QUERY = `
    query (
      $day0Start: Int, $day0End: Int,
      $day1Start: Int, $day1End: Int,
      $day2Start: Int, $day2End: Int,
      $day3Start: Int, $day3End: Int,
      $day4Start: Int, $day4End: Int,
      $day5Start: Int, $day5End: Int,
      $day6Start: Int, $day6End: Int,
      $day7Start: Int, $day7End: Int
    ) {
      day0: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $day0Start, airingAt_lesser: $day0End, sort: TIME) {
          id
          airingAt
          episode
          media {
            ${ANIME_QUERY_FIELDS}
          }
        }
      }
      day1: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $day1Start, airingAt_lesser: $day1End, sort: TIME) {
          id
          airingAt
          episode
          media {
            ${ANIME_QUERY_FIELDS}
          }
        }
      }
      day2: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $day2Start, airingAt_lesser: $day2End, sort: TIME) {
          id
          airingAt
          episode
          media {
            ${ANIME_QUERY_FIELDS}
          }
        }
      }
      day3: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $day3Start, airingAt_lesser: $day3End, sort: TIME) {
          id
          airingAt
          episode
          media {
            ${ANIME_QUERY_FIELDS}
          }
        }
      }
      day4: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $day4Start, airingAt_lesser: $day4End, sort: TIME) {
          id
          airingAt
          episode
          media {
            ${ANIME_QUERY_FIELDS}
          }
        }
      }
      day5: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $day5Start, airingAt_lesser: $day5End, sort: TIME) {
          id
          airingAt
          episode
          media {
            ${ANIME_QUERY_FIELDS}
          }
        }
      }
      day6: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $day6Start, airingAt_lesser: $day6End, sort: TIME) {
          id
          airingAt
          episode
          media {
            ${ANIME_QUERY_FIELDS}
          }
        }
      }
      day7: Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $day7Start, airingAt_lesser: $day7End, sort: TIME) {
          id
          airingAt
          episode
          media {
            ${ANIME_QUERY_FIELDS}
          }
        }
      }
    }
  `;
  const variables = dayVariables.reduce((vars, day, index) => {
    vars[`day${index}Start`] = day.start;
    vars[`day${index}End`] = day.end;
    return vars;
  }, {});

  const data = await anilistFetch(QUERY, variables);
  return Object.keys(data || {})
    .sort()
    .flatMap(key => data?.[key]?.airingSchedules || []);
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
  const normalizedSort = sort === 'SEARCH_MATCH' ? 'POPULARITY_DESC' : sort;
  const variables = { 
    page, 
    q: q ? q.trim() : undefined, 
    genres: (genres && genres.length > 0) ? genres : undefined,
    // Note: AniList errors if sort is SEARCH_MATCH but search is null/undefined
    sort: q ? ['SEARCH_MATCH', normalizedSort] : [normalizedSort]
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
    anilist_id: AL.id,
    mal_id: AL.idMal || id,
    bannerImage: AL.bannerImage,
    coverImage: AL.coverImage,
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

// ─── Manga API (AniList) ──────────────────────────

const MANGA_QUERY_FIELDS = `
  id
  idMal
  title { romaji english native }
  synonyms
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

export async function searchManga(q, { page = 1, genres = [], format = '', status = '', sort = 'POPULARITY_DESC' } = {}) {
  const QUERY = `
    query ($page: Int, $q: String, $genres: [String], $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort]) {
      Page(page: $page, perPage: 24) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(search: $q, genre_in: $genres, format: $format, status: $status, sort: $sort, type: MANGA, isAdult: false) {
          ${MANGA_QUERY_FIELDS}
          description(asHtml: false)
        }
      }
    }
  `;
  const normalizedSort = sort === 'SEARCH_MATCH' ? 'POPULARITY_DESC' : sort;
  const variables = { 
    page, 
    q: q ? q.trim() : undefined, 
    genres: (genres && genres.length > 0) ? genres : undefined,
    sort: q ? ['SEARCH_MATCH', normalizedSort] : [normalizedSort]
  };
  if (format) variables.format = format;
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
          countryOfOrigin
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
  const params = new URLSearchParams({
    title,
    episode: episode.toString(),
  });
  if (anilistId) params.set('anilistId', anilistId.toString());

  const fallbacks = [
    { name: 'Server 1', url: `/api/anime/stream/animepahe?${params}` },
    { name: 'Server 2', url: `/api/anime/stream/miruro?${params}` },
    { name: 'Server 3', url: `https://vidlink.pro/anime/${malId}/${episode}/sub?fallback=true` },
    { name: 'Server 4', url: `https://vidsrc.to/embed/anime/${malId}/${episode}` },
    { name: 'Server 5', url: `https://vidsrc.me/embed/anime?malId=${malId}&ep=${episode}` }
  ];
  return fallbacks.filter(f => f.url);
}
