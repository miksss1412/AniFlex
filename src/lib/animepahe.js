import * as cheerio from 'cheerio';

const ANILIST_URL = 'https://graphql.anilist.co';
const MIRRORS = [
  'https://animepahe.si',
  'https://animepahe.com',
  'https://animepahe.org',
];
const WORDPRESS_MIRRORS = ['https://animepahe.ch'];
const UPSTREAM_TIMEOUT_MS = 5000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  'X-Requested-With': 'XMLHttpRequest',
  'Cookie': '__ddg1_=;__ddg2_=;',
};

export async function scrapeAnimePahe(title, episode = 1, options = {}) {
  const episodeNumber = Number(episode) || 1;
  const lookup = await buildLookup(title, options);

  for (const mirror of MIRRORS) {
    try {
      const result = await scrapeFromMirror(mirror, lookup, episodeNumber);
      if (result?.length) return result;
    } catch (e) {
      console.warn(`[AnimePahe] Mirror ${mirror} failed:`, e.message);
    }
  }

  for (const mirror of WORDPRESS_MIRRORS) {
    try {
      const result = await scrapeFromWordPressMirror(mirror, lookup, episodeNumber);
      if (result?.length) return result;
    } catch (e) {
      console.warn(`[AnimePahe] WordPress mirror ${mirror} failed:`, e.message);
    }
  }

  return [];
}

async function buildLookup(title, { anilistId } = {}) {
  const anilist = await getAnilistMetadata({ anilistId, title });
  const titles = unique([
    anilist?.title?.romaji,
    anilist?.title?.english,
    anilist?.title?.userPreferred,
    title,
    ...(anilist?.synonyms || []).filter(isUsefulLatinTitle).slice(0, 5),
  ].filter(Boolean)).slice(0, 8);

  const queries = unique(titles.flatMap((candidate) => [
    candidate,
    stripTitleNoise(candidate),
    stripSeasonWords(candidate),
    candidate.split(':')[0],
  ].filter(Boolean))).slice(0, 12);
  const slugCandidates = unique(titles.flatMap((candidate) => buildSlugCandidates(candidate))).slice(0, 12);

  return {
    titles,
    queries,
    slugCandidates,
    year: anilist?.startDate?.year || anilist?.seasonYear || null,
    format: anilist?.format || null,
    episodes: Number(anilist?.episodes) || null,
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
    const res = await fetchWithTimeout(ANILIST_URL, {
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
  } catch (e) {
    console.warn('[AnimePahe] AniList lookup failed:', e.message);
    return null;
  }
}

async function scrapeFromMirror(baseUrl, lookup, episode) {
  const anime = await findAnime(baseUrl, lookup);
  if (!anime?.session) return null;

  console.log(`[AnimePahe] Matched: ${anime.title} (${anime.session}) via ${baseUrl}`);

  const ep = await findEpisode(baseUrl, anime.session, episode);
  if (!ep?.session) return null;

  const playUrl = `${baseUrl}/play/${anime.session}/${ep.session}`;
  const playRes = await fetchWithTimeout(playUrl, {
    headers: htmlHeaders(baseUrl),
    redirect: 'follow',
  });

  if (!playRes.ok) return null;

  const $ = cheerio.load(await playRes.text());
  const kwikLinks = [];

  $('#resolutionMenu > button').each((_, el) => {
    const kwikUrl = $(el).attr('data-src');
    const quality = $(el).text().trim();
    const audio = ($(el).attr('data-audio') || '').toLowerCase();
    if (kwikUrl) {
      kwikLinks.push({
        kwikUrl,
        quality,
        isDub: audio === 'eng' || audio === 'english',
      });
    }
  });

  if (!kwikLinks.length) return null;

  const streams = [];
  for (const link of kwikLinks) {
    const extracted = await extractKwikM3U8(link.kwikUrl);
    if (extracted?.url) {
      streams.push({
        url: extracted.url,
        quality: link.quality,
        isDub: link.isDub,
        kwikUrl: link.kwikUrl,
        referer: extracted.referer,
      });
    }
  }

  return streams.sort((a, b) => qualityValue(b.quality) - qualityValue(a.quality));
}

async function findAnime(baseUrl, lookup) {
  const seen = new Map();

  for (const query of lookup.queries) {
    const searchRes = await fetchWithTimeout(
      `${baseUrl}/api?m=search&l=8&q=${encodeURIComponent(query)}`,
      { headers: jsonHeaders(baseUrl), redirect: 'follow' }
    );

    if (!searchRes.ok) return null;
    if (!isJson(searchRes)) return null;

    const searchData = await searchRes.json();
    for (const item of searchData?.data || []) {
      if (!item?.session) continue;
      seen.set(item.session, item);
    }

    const best = pickBestMatch([...seen.values()], lookup);
    if (best) return best;
  }

  return pickBestMatch([...seen.values()], lookup);
}

async function scrapeFromWordPressMirror(baseUrl, lookup, episode) {
  const series = await findWordPressSeries(baseUrl, lookup);
  if (!series?.url) return null;

  const seriesRes = await fetchWithTimeout(series.url, {
    headers: htmlHeaders(baseUrl),
    redirect: 'follow',
  });
  if (!seriesRes.ok) return null;

  const $series = cheerio.load(await seriesRes.text());
  const episodeUrl = findWordPressEpisodeUrl($series, baseUrl, episode, series.url);
  if (!episodeUrl) return null;

  const episodeRes = await fetchWithTimeout(episodeUrl, {
    headers: htmlHeaders(series.url),
    redirect: 'follow',
  });
  if (!episodeRes.ok) return null;

  const $episode = cheerio.load(await episodeRes.text());
  const iframe = $episode('.player-embed iframe, #embed_holder iframe, iframe').first();
  const embedUrl = iframe.attr('src') || iframe.attr('data-src') || iframe.attr('data-litespeed-src');
  if (!embedUrl) return null;

  return [{
    url: new URL(embedUrl, baseUrl).toString(),
    quality: 'Embed',
    isDub: /\bdub\b/i.test(series.title),
    type: 'iframe',
    provider: 'AnimePahe CH',
    referer: episodeUrl,
  }];
}

async function findWordPressSeries(baseUrl, lookup) {
  const seen = new Map();

  for (const slug of lookup.slugCandidates) {
    const url = `${baseUrl}/series/${slug}/`;
    const directRes = await fetchWithTimeout(url, {
      headers: htmlHeaders(baseUrl),
      redirect: 'follow',
    });

    if (!directRes.ok) continue;

    const $ = cheerio.load(await directRes.text());
    const title = $('.postbody .entry-title, .postbody h1.entry-title, .postbody .infox h2').first().text().trim();
    if (!title) continue;

    const best = pickBestMatch([{ url, title }], lookup, { allowLooseFallback: false });
    if (best) return best;
  }

  for (const query of lookup.queries) {
    const searchRes = await fetchWithTimeout(`${baseUrl}/?s=${encodeURIComponent(query)}`, {
      headers: htmlHeaders(baseUrl),
      redirect: 'follow',
    });

    if (!searchRes.ok) continue;
    const $ = cheerio.load(await searchRes.text());

    $('.postbody .listupd article a[href*="/series/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || /\/series\/?$/.test(href)) return;

      const box = $(el).closest('article');
      const title = (
        $(el).attr('title')
        || $(el).find('img').attr('alt')
        || box.find('img').first().attr('alt')
        || $(el).text()
        || slugToTitle(href)
      ).trim();

      const url = new URL(href, baseUrl).toString();
      if (title) seen.set(url, { url, title });
    });

    const best = pickBestMatch([...seen.values()], lookup, { allowLooseFallback: false });
    if (best) return best;
  }

  return pickBestMatch([...seen.values()], lookup, { allowLooseFallback: false });
}

function findWordPressEpisodeUrl($, baseUrl, episode, seriesUrl) {
  let fallback = null;
  const episodePattern = new RegExp(`(?:episode|ep)[-\\s]*0*${episode}(?:\\D|$)`, 'i');
  const seriesSlug = slugFromUrl(seriesUrl);
  const episodeBaseSlug = seriesSlug
    .replace(/(?:-\d+(?:st|nd|rd|th)?-season|-season-\d+|-part-\d+|-cour-\d+)$/i, '');

  $('.postbody a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || href === '#' || href.startsWith('javascript:')) return undefined;

    const hrefSlug = slugFromUrl(href);
    if (!/\bepisode\b/i.test(hrefSlug.replace(/-/g, ' '))) return undefined;
    if (episodeBaseSlug && !hrefSlug.includes(episodeBaseSlug)) return undefined;

    const text = $(el).text().trim();
    const haystack = `${href} ${text}`;

    if (!fallback && href.includes('/episode-')) {
      fallback = href;
    }

    if (episodePattern.test(haystack)) {
      fallback = href;
      return false;
    }

    return undefined;
  });

  if (!fallback) return null;

  const url = new URL(fallback, baseUrl);
  url.protocol = new URL(baseUrl).protocol;
  return url.toString();
}

async function findEpisode(baseUrl, animeSession, episode) {
  const firstPage = Math.max(1, Math.ceil(episode / 30));
  const firstResult = await fetchEpisodePage(baseUrl, animeSession, firstPage);
  let match = findEpisodeInData(firstResult?.data, episode);
  if (match) return match;

  const lastPage = Number(firstResult?.last_page) || 1;
  for (let page = 1; page <= lastPage; page++) {
    if (page === firstPage) continue;
    const result = await fetchEpisodePage(baseUrl, animeSession, page);
    match = findEpisodeInData(result?.data, episode);
    if (match) return match;
  }

  return null;
}

async function fetchEpisodePage(baseUrl, animeSession, page) {
  const res = await fetchWithTimeout(
    `${baseUrl}/api?m=release&id=${animeSession}&l=30&sort=episode_asc&page=${page}`,
    { headers: jsonHeaders(baseUrl), redirect: 'follow' }
  );

  if (!res.ok || !isJson(res)) return null;
  return res.json();
}

function findEpisodeInData(data, episode) {
  return (data || []).find((item) => Number(item.episode) === Number(episode));
}

function pickBestMatch(results, lookup) {
  if (!results.length) return null;

  let best = null;
  let bestScore = 0;

  for (const result of results) {
    const resultTitle = normalizeTitle(result.title || result.name || '');
    if (!resultTitle) continue;
    if (!hasCoreTitleOverlap(resultTitle, lookup)) continue;
    if (hasHardTitleConflict(resultTitle, lookup)) continue;

    const resultSeason = extractSeasonNumber(resultTitle);
    if (lookup.seasonNumber && resultSeason && lookup.seasonNumber !== resultSeason) continue;

    let score = 0;
    for (const title of lookup.titles) {
      const candidate = normalizeTitle(title);
      const candidateBase = normalizeTitle(stripSeasonWords(title));
      if (!candidate) continue;

      if (resultTitle === candidate) score = Math.max(score, 1.2);
      else if (candidateBase && resultTitle === candidateBase) score = Math.max(score, 1.08);
      else if (resultTitle.includes(candidate) || candidate.includes(resultTitle)) score = Math.max(score, 0.72);
      else score = Math.max(score, titleSimilarity(resultTitle, candidate));
    }

    if (hasConflictingQualifier(resultTitle, lookup)) {
      score -= 0.55;
    }

    const resultYear = Number(result.year) || null;
    if (lookup.year && resultYear) {
      score += lookup.year === resultYear ? 0.2 : -0.2;
    }

    if (lookup.seasonNumber && resultSeason) {
      score += lookup.seasonNumber === resultSeason ? 0.15 : -0.25;
    }

    if (score > bestScore) {
      bestScore = score;
      best = result;
    }
  }

  return bestScore >= 0.62 ? best : null;
}

async function extractKwikM3U8(kwikUrl) {
  try {
    const urlObj = new URL(kwikUrl);
    const referer = `${urlObj.protocol}//${urlObj.host}/`;
    const res = await fetchWithTimeout(kwikUrl, {
      headers: {
        'User-Agent': HEADERS['User-Agent'],
        Referer: referer,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const html = await res.text();
    const direct = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/)?.[0];
    if (direct) return { url: cleanKwikUrl(direct), referer };

    const jsMatch = html.match(/;(eval\(function\(p,a,c,k,e,d\).*?m3u8.*?\)\))/s);
    if (!jsMatch?.[1]) return null;

    const jsCode = jsMatch[1];
    const start = jsCode.lastIndexOf('}(');
    const end = jsCode.lastIndexOf('))');
    if (start === -1 || end === -1 || end <= start) return null;

    const parts = parsePackedArgs(jsCode.substring(start + 2, end));
    if (parts.length < 4) return null;

    const p = parts[0];
    const a = Number(parts[1]);
    const c = Number(parts[2]);
    const k = parts[3].replace(/\.split\(['"]\|['"]\)$/, '').split('|');
    let decoded = unpackKwik(p, a, c, k).replace(/\\/g, '');
    decoded = decoded.replace('https.split(://', 'https://').replace('http.split(://', 'http://');

    const source = decoded.match(/source=(https?:\/\/[^;]+)/)?.[1]
      || decoded.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/)?.[0];

    return source ? { url: cleanKwikUrl(source), referer } : null;
  } catch (e) {
    console.warn('[AnimePahe] KwiK extract failed:', e.message);
    return null;
  }
}

function jsonHeaders(baseUrl) {
  return { ...HEADERS, Referer: baseUrl };
}

function htmlHeaders(baseUrl) {
  return {
    ...HEADERS,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    Referer: baseUrl,
  };
}

async function fetchWithTimeout(url, options = {}, timeout = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isJson(res) {
  return (res.headers.get('content-type') || '').includes('application/json');
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = value.toLowerCase().trim();
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

function buildSlugCandidates(title) {
  const cleaned = stripTitleNoise(title);
  const base = stripSeasonWords(cleaned);
  const season = extractSeasonNumber(cleaned);
  const values = [
    cleaned,
    base,
  ];

  if (base && season) {
    values.push(
      `${base} ${season}`,
      `${base} season ${season}`,
      `${base} ${ordinal(season)} season`,
      `${base} part ${season}`,
      `${base} cour ${season}`,
    );
  }

  return values.map(slugify).filter(Boolean);
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

  const trailing = value.match(/\b(\d+)\s*(?:specials?|ova|ona|movie)?\s*$/);
  if (trailing) return Number(trailing[1]);

  const roman = value.match(/\bseason\s+([ivx]+)\b|\b([ivx]+)(?:\s+season)?\b/);
  if (!roman) return null;

  return romanToNumber(roman[1] || roman[2]);
}

function hasConflictingQualifier(resultTitle, lookup) {
  const resultSeason = extractSeasonNumber(resultTitle);
  if (lookup.seasonNumber && resultSeason === lookup.seasonNumber) return false;

  const qualifierPattern = /\b(?:final|vigilante|illegals|memories|more|movie|ova|ona|special|recap|dub|season|part)\b/;
  if (!qualifierPattern.test(resultTitle)) return false;

  return lookup.titles.some((title) => {
    const candidate = normalizeTitle(title);
    return candidate && resultTitle !== candidate && resultTitle.includes(candidate);
  });
}

function hasHardTitleConflict(resultTitle, lookup) {
  if (isExactLookupTitle(resultTitle, lookup)) return false;

  const resultSeason = extractSeasonNumber(resultTitle);
  if (lookup.seasonNumber && resultSeason && lookup.seasonNumber !== resultSeason) return true;

  const isTvSeason = lookup.format === 'TV' || Number(lookup.episodes) > 1;
  if (!isTvSeason) return false;

  const lookupHasReleaseQualifier = lookup.titles.some((title) => releaseQualifierPattern().test(normalizeTitle(title)));
  if (!lookupHasReleaseQualifier && releaseQualifierPattern().test(resultTitle)) return true;

  if (!lookup.seasonNumber && resultSeason && resultSeason > 1) return true;

  if (!lookup.seasonNumber && hasExtraSubtitleWords(resultTitle, lookup)) return true;

  return false;
}

function isExactLookupTitle(resultTitle, lookup) {
  return lookup.titles.some((title) => {
    const candidate = normalizeTitle(title);
    const baseCandidate = normalizeTitle(stripSeasonWords(title));
    return resultTitle === candidate || (baseCandidate && resultTitle === baseCandidate);
  });
}

function hasExtraSubtitleWords(resultTitle, lookup) {
  const resultWords = coreTitleWords(resultTitle);
  if (resultWords.length < 3) return false;

  return lookup.titles.some((title) => {
    const candidate = normalizeTitle(title);
    if (!candidate || !resultTitle.includes(candidate)) return false;

    const candidateWords = coreTitleWords(candidate);
    const extraWords = resultWords.filter((word) => !candidateWords.includes(word));
    return extraWords.length >= 2;
  });
}

function releaseQualifierPattern() {
  return /\b(?:movie|film|ova|ona|special|recap|summary|theatrical|gekijouban|gekijoban)\b/;
}

function hasCoreTitleOverlap(resultTitle, lookup) {
  const resultWords = coreTitleWords(resultTitle);
  if (!resultWords.length) return false;

  return lookup.titles.some((title) => {
    const candidateWords = coreTitleWords(normalizeTitle(title));
    if (!candidateWords.length) return false;

    const common = candidateWords.filter((word) => resultWords.includes(word));
    const required = Math.min(2, candidateWords.length);
    return common.length >= required;
  });
}

function coreTitleWords(title) {
  const stopWords = new Set([
    'season',
    'part',
    'cour',
    'episode',
    'ep',
    'sub',
    'dub',
    'english',
    'final',
    'movie',
    'ova',
    'ona',
    'special',
    'the',
    'a',
    'an',
  ]);

  return normalizeTitle(title)
    .split(' ')
    .filter((word) => word.length > 1 && !/^\d+$/.test(word) && !stopWords.has(word));
}

function romanToNumber(value) {
  const map = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  return map[value] || null;
}

function qualityValue(quality) {
  return Number(String(quality).match(/\d+/)?.[0]) || 0;
}

function slugToTitle(url) {
  try {
    const pathname = new URL(url).pathname;
    const slug = pathname.split('/').filter(Boolean).pop() || '';
    return slug.replace(/-/g, ' ');
  } catch {
    return '';
  }
}

function slugFromUrl(url) {
  try {
    const parsed = new URL(url, 'https://animepahe.ch');
    return parsed.pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return '';
  }
}

function slugify(value) {
  return normalizeTitle(value)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ordinal(value) {
  const n = Number(value);
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function unpackKwik(p, a, c, k) {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  const dict = {};

  function baseEncode(n) {
    const rem = n % a;
    const digit = rem > 35 ? String.fromCharCode(rem + 29) : digits[rem];
    return n < a ? digit : baseEncode(Math.floor(n / a)) + digit;
  }

  for (let i = c - 1; i >= 0; i--) {
    const key = baseEncode(i);
    dict[key] = i < k.length && k[i] !== '' ? k[i] : key;
  }

  return p.replace(/\b\w+\b/g, (word) => dict[word] ?? word);
}

function parsePackedArgs(input) {
  const result = [];
  let inQuote = false;
  let quoteChar = null;
  let depth = 0;
  let current = '';

  for (const char of input) {
    if (!inQuote) {
      if (char === '\'' || char === '"') {
        inQuote = true;
        quoteChar = char;
        continue;
      }

      if (char === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
        continue;
      }

      if (char === '(' || char === '[' || char === '{') depth++;
      else if ((char === ')' || char === ']' || char === '}') && depth > 0) depth--;
    } else if (char === quoteChar) {
      inQuote = false;
      continue;
    }

    current += char;
  }

  if (current) result.push(current.trim());
  return result;
}

function cleanKwikUrl(url) {
  const semicolonIndex = url.indexOf(';');
  return url
    .slice(0, semicolonIndex === -1 ? undefined : semicolonIndex)
    .replace(/\\\//g, '/')
    .replace(/^["']|["']$/g, '')
    .replace(/[\n\r\t ]/g, '');
}
