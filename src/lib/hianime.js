import { HiAnime } from 'aniwatch';

const ANILIST_URL = 'https://graphql.anilist.co';
const DEFAULT_SERVERS = ['hd-1', 'hd-2', 'megacloud'];
const DEFAULT_CATEGORIES = ['sub', 'dub'];

export async function scrapeHiAnime(title, episode = 1, options = {}) {
  const episodeNumber = Number(episode) || 1;
  const scraper = new HiAnime.Scraper();
  const lookup = await buildLookup(title, options);
  const animeId = options.hianimeId || await findHiAnimeId(scraper, lookup);

  if (!animeId) return [];

  const episodeData = await scraper.getEpisodes(animeId);
  const targetEpisode = (episodeData?.episodes || []).find(
    (item) => Number(item.number) === episodeNumber
  );

  if (!targetEpisode?.episodeId) return [];

  const categories = unique([
    options.category,
    ...DEFAULT_CATEGORIES,
  ].filter(Boolean));
  const servers = unique([
    options.server,
    ...DEFAULT_SERVERS,
  ].filter(Boolean));

  const errors = [];

  for (const category of categories) {
    for (const server of servers) {
      try {
        const sourceData = await scraper.getEpisodeSources(targetEpisode.episodeId, server, category);
        const streams = normalizeStreams(sourceData, {
          category,
          server,
          episode: targetEpisode,
          animeId,
        });

        if (streams.length) return streams;
      } catch (error) {
        errors.push(`${server}/${category}: ${error.message}`);
      }
    }
  }

  if (errors.length) {
    console.warn('[HiAnime] Source attempts failed:', errors.join(' | '));
  }

  return [];
}

async function buildLookup(title, { anilistId } = {}) {
  const anilist = await getAnilistMetadata({ anilistId, title });
  const titles = unique([
    anilist?.title?.english,
    anilist?.title?.romaji,
    anilist?.title?.userPreferred,
    title,
    ...(anilist?.synonyms || []).filter(isUsefulLatinTitle).slice(0, 6),
  ].filter(Boolean)).slice(0, 10);

  const queries = unique(titles.flatMap((candidate) => [
    candidate,
    stripTitleNoise(candidate),
    stripSeasonWords(candidate),
    candidate.split(':')[0],
  ].filter(Boolean))).slice(0, 12);

  return {
    titles,
    queries,
    year: anilist?.startDate?.year || anilist?.seasonYear || null,
    episodes: Number(anilist?.episodes) || null,
    format: anilist?.format || null,
    seasonNumber: extractSeasonNumber(titles.join(' ')),
  };
}

async function getAnilistMetadata({ anilistId, title }) {
  if (!anilistId && !title) return null;

  const byId = Boolean(anilistId);
  const query = byId
    ? `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          title { romaji english native userPreferred }
          synonyms
          format
          episodes
          seasonYear
          startDate { year }
        }
      }
    `
    : `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          title { romaji english native userPreferred }
          synonyms
          format
          episodes
          seasonYear
          startDate { year }
        }
      }
    `;

  try {
    const res = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query,
        variables: byId ? { id: Number(anilistId) } : { search: title },
      }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.Media || null;
  } catch (error) {
    console.warn('[HiAnime] AniList lookup failed:', error.message);
    return null;
  }
}

async function findHiAnimeId(scraper, lookup) {
  const seen = new Map();

  for (const query of lookup.queries.slice(0, 4)) {
    try {
      const results = await scraper.search(query, 1);
      for (const anime of results?.animes || []) {
        if (anime?.id) seen.set(anime.id, anime);
      }

      const best = pickBestMatch([...seen.values()], lookup);
      if (best?.score >= 0.9) return best.id;
    } catch (error) {
      console.warn(`[HiAnime] Search failed for "${query}":`, error.message);
      break;
    }
  }

  return pickBestMatch([...seen.values()], lookup)?.id || null;
}

function pickBestMatch(results, lookup) {
  let best = null;

  for (const result of results) {
    const names = [result.name, result.jname].filter(Boolean);
    if (!names.length) continue;

    let score = 0;
    for (const name of names) {
      const resultTitle = normalizeTitle(name);
      if (!resultTitle || hasHardTitleConflict(resultTitle, lookup)) continue;

      for (const title of lookup.titles) {
        const candidate = normalizeTitle(title);
        const candidateBase = normalizeTitle(stripSeasonWords(title));
        if (!candidate) continue;

        if (resultTitle === candidate) score = Math.max(score, 1.15);
        else if (candidateBase && resultTitle === candidateBase) score = Math.max(score, 1.05);
        else if (resultTitle.includes(candidate) || candidate.includes(resultTitle)) score = Math.max(score, 0.78);
        else score = Math.max(score, titleSimilarity(resultTitle, candidate));
      }
    }

    const subCount = Number(result.episodes?.sub) || 0;
    const dubCount = Number(result.episodes?.dub) || 0;
    const episodeCount = Math.max(subCount, dubCount);
    if (lookup.episodes && episodeCount === lookup.episodes) score += 0.15;
    if (lookup.episodes && result.type?.toLowerCase() === 'movie' && lookup.episodes > 1) score -= 0.35;

    const resultSeason = extractSeasonNumber(names.join(' '));
    if (lookup.seasonNumber && resultSeason) {
      score += lookup.seasonNumber === resultSeason ? 0.12 : -0.3;
    }

    if (!best || score > best.score) {
      best = { id: result.id, score, title: result.name };
    }
  }

  return best?.score >= 0.58 ? best : null;
}

function normalizeStreams(sourceData, meta) {
  const sources = sourceData?.sources || [];

  return sources
    .filter((source) => source?.url)
    .map((source, index) => ({
      url: source.url,
      quality: source.quality || (source.isM3U8 ? 'Auto' : `Source ${index + 1}`),
      isDub: meta.category === 'dub',
      type: source.isM3U8 || source.url.includes('.m3u8') ? 'hls' : 'iframe',
      provider: 'HiAnime',
      server: meta.server,
      referer: sourceData?.headers?.Referer || sourceData?.headers?.referer || null,
      subtitles: normalizeSubtitles(sourceData?.subtitles),
      intro: sourceData?.intro || null,
      outro: sourceData?.outro || null,
      episodeTitle: meta.episode?.title || '',
      hianimeId: meta.animeId,
    }))
    .sort((a, b) => qualityValue(b.quality) - qualityValue(a.quality));
}

function normalizeSubtitles(subtitles = []) {
  return subtitles.map((subtitle) => ({
    url: subtitle.url || subtitle.file,
    label: subtitle.lang || subtitle.label || 'Subtitle',
    default: Boolean(subtitle.default),
  })).filter((subtitle) => subtitle.url);
}

function hasHardTitleConflict(resultTitle, lookup) {
  const resultSeason = extractSeasonNumber(resultTitle);
  if (lookup.seasonNumber && resultSeason && lookup.seasonNumber !== resultSeason) return true;

  const isTvSeason = lookup.format === 'TV' || Number(lookup.episodes) > 1;
  if (!isTvSeason) return false;

  const exact = lookup.titles.some((title) => {
    const candidate = normalizeTitle(title);
    const baseCandidate = normalizeTitle(stripSeasonWords(title));
    return resultTitle === candidate || (baseCandidate && resultTitle === baseCandidate);
  });
  if (exact) return false;

  if (!lookup.seasonNumber && resultSeason && resultSeason > 1) return true;

  return /\b(?:movie|film|ova|ona|special|recap|summary|theatrical)\b/.test(resultTitle);
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = String(value).toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isUsefulLatinTitle(value) {
  const title = String(value || '').trim();
  return /[a-z]/i.test(title) && title.length <= 80;
}

function normalizeTitle(title) {
  return stripTitleNoise(title)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTitleNoise(title) {
  return String(title)
    .replace(/\([^)]*\d{4}[^)]*\)/g, '')
    .replace(/\[[^\]]*\d{4}[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSeasonWords(title) {
  return stripTitleNoise(title)
    .replace(/\b(?:season|part|cour)\s+\d+\b/gi, '')
    .replace(/\b\d+(?:st|nd|rd|th)\s+season\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a, b) {
  const wordsA = a.split(' ').filter(Boolean);
  const wordsB = b.split(' ').filter(Boolean);
  if (!wordsA.length || !wordsB.length) return 0;

  const common = wordsA.filter((word) => wordsB.includes(word)).length;
  return (common * 2) / (wordsA.length + wordsB.length);
}

function extractSeasonNumber(title) {
  const value = String(title).toLowerCase();
  const numeric = value.match(/\b(?:season|part|cour)\s+(\d+)\b|\b(\d+)(?:st|nd|rd|th)\s+season\b/);
  if (numeric) return Number(numeric[1] || numeric[2]);

  const roman = value.match(/\bseason\s+([ivx]+)\b|\b([ivx]+)(?:\s+season)?\b/);
  if (!roman) return null;

  return romanToNumber(roman[1] || roman[2]);
}

function romanToNumber(value) {
  const map = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  return map[value] || null;
}

function qualityValue(quality) {
  return Number(String(quality).match(/\d+/)?.[0]) || 0;
}
