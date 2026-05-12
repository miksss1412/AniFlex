import * as cheerio from 'cheerio';
import { unstable_cache } from 'next/cache';

const COMICK_SOURCE_API_BASE = (process.env.COMICK_SOURCE_API_BASE || 'https://comick-source-api.notaspider.dev').replace(/\/$/, '');
const XBATO_API_BASE = (process.env.XBATO_API_BASE || 'https://xbato-api.hanifu.id').replace(/\/$/, '');
const GOMANGA_API_BASE = (process.env.GOMANGA_API_BASE || 'https://gomanga-api.vercel.app').replace(/\/$/, '');
const MANGAHOOK_API_BASE = process.env.MANGAHOOK_API_BASE?.replace(/\/$/, '');

const SCRAPEABLE_COMICK_SOURCE_IDS = ['MangaKatana', 'mangaread', 'asurascan', 'flamecomics', 'Vortex Scans'];
const SCRAPEABLE_COMICK_SOURCE_BY_KEY = new Map(
  SCRAPEABLE_COMICK_SOURCE_IDS.map(source => [source.toLowerCase(), source])
);
const COMICK_SOURCE_IDS = (process.env.COMICK_SOURCE_IDS || 'MangaKatana,mangaread,asurascan,flamecomics,Vortex Scans')
  .split(',')
  .map(source => SCRAPEABLE_COMICK_SOURCE_BY_KEY.get(source.trim().toLowerCase()))
  .filter(Boolean);
const ENABLE_COMICK_SOURCE_PROVIDER = process.env.ENABLE_COMICK_SOURCE_PROVIDER !== 'false';
const ENABLE_GOMANGA_PROVIDER = process.env.ENABLE_GOMANGA_PROVIDER !== 'false';
const MANGA_PROVIDER_TIMEOUT_MS = Number(process.env.MANGA_PROVIDER_TIMEOUT_MS || 5000);
const CHAPTER_LIST_REVALIDATE_SECONDS = 21600;
const PAGE_LIST_REVALIDATE_SECONDS = 3600;

const PROVIDER_LABELS = {
  comick_source: 'Comick Source',
  gomanga: 'GoManga',
  xbato: 'xBato',
  mangahook: 'MangaHook',
};

export async function getReadableMangaChapters(manga) {
  const mangaKey = buildMangaCacheKey(manga);

  try {
    return await getCachedReadableMangaChapters(mangaKey);
  } catch {
    return getReadableMangaChaptersUncached(mangaKey);
  }
}

async function getReadableMangaChaptersUncached(mangaKey, onlyProviderId = null) {
  const attempts = [];

  for (const provider of getChapterProviders()) {
    if (onlyProviderId && provider.id !== onlyProviderId) continue;

    try {
      const source = await getProviderChapterSource(provider, mangaKey);
      attempts.push(source.attempt);

      if (source.chapters.length > 0) {
        return {
          provider: provider.id,
          providerLabel: provider.label,
          providerSeriesId: source.series.id,
          chapters: source.chapters,
          attempts,
        };
      }
    } catch (error) {
      console.error(`[Manga] ${provider.id} chapters error:`, error);
      attempts.push({ provider: provider.id, status: 'error' });
    }
  }

  return emptyChapterSource(attempts);
}

async function getProviderChapterSource(provider, mangaKey) {
  const series = await provider.findSeries(mangaKey);
  if (!series) {
    return {
      series: null,
      chapters: [],
      attempt: { provider: provider.id, status: 'not_found' },
    };
  }

  const chapters = await provider.getChapters(series.id);
  if (chapters.length > 0) {
    return {
      series,
      chapters,
      attempt: {
        provider: provider.id,
        status: 'found',
        providerSeriesId: series.id,
        chapterCount: chapters.length,
      },
    };
  }

  return {
    series,
    chapters,
    attempt: {
      provider: provider.id,
      status: 'empty',
      providerSeriesId: series.id,
    },
  };
}

function emptyChapterSource(attempts = []) {
  return {
    provider: null,
    providerLabel: null,
    providerSeriesId: null,
    chapters: [],
    attempts,
  };
}

const getCachedReadableMangaChapters = unstable_cache(
  async (mangaKey) => {
    const source = await getReadableMangaChaptersUncached(mangaKey);
    if (!source.chapters.length) {
      throw new Error('No readable manga chapters found');
    }
    return source;
  },
  ['manga-chapter-list-v1'],
  { revalidate: CHAPTER_LIST_REVALIDATE_SECONDS }
);

const getCachedProviderReadableMangaChapters = unstable_cache(
  async (mangaKey, providerId) => {
    const source = await getReadableMangaChaptersUncached(mangaKey, providerId);
    if (!source.chapters.length) {
      throw new Error(`No readable manga chapters found for ${providerId}`);
    }
    return source;
  },
  ['manga-provider-chapter-list-v1'],
  { revalidate: CHAPTER_LIST_REVALIDATE_SECONDS }
);

export async function getReadableMangaPages(manga, chapterId, providerId = 'comick_source') {
  const requestedProvider = providerId || 'comick_source';
  const provider = getProviderById(requestedProvider);
  if (!provider) {
    return {
      pages: [],
      chapters: [],
      provider: requestedProvider,
      providerLabel: getMangaProviderLabel(requestedProvider),
    };
  }

  try {
    const mangaKey = buildMangaCacheKey(manga);
    const [pages, chapterSource] = await Promise.all([
      getCachedReadableMangaPages(provider.id, chapterId),
      getCachedProviderReadableMangaChapters(mangaKey, provider.id)
        .catch(() => getReadableMangaChaptersUncached(mangaKey, provider.id)),
    ]);
    const chapters = chapterSource.chapters || [];
    const currentChapter = chapters.find(chapter => chapter.id === chapterId);

    return {
      pages,
      chapters,
      externalUrl: currentChapter?.externalUrl || provider.getExternalUrl?.(chapterId) || null,
      provider: provider.id,
      providerLabel: provider.label,
    };
  } catch (error) {
    console.error(`[Manga] ${provider.id} pages error:`, error);
    return {
      pages: [],
      chapters: [],
      externalUrl: provider.getExternalUrl?.(chapterId) || null,
      provider: provider.id,
      providerLabel: provider.label,
    };
  }
}

const getCachedReadableMangaPages = unstable_cache(
  async (providerId, chapterId) => {
    const provider = getProviderById(providerId);
    if (!provider) return [];
    return provider.getPages(chapterId);
  },
  ['manga-reader-pages-v1'],
  { revalidate: PAGE_LIST_REVALIDATE_SECONDS }
);

export function getMangaProviderLabel(providerId) {
  return PROVIDER_LABELS[providerId] || providerId || 'Unknown source';
}

function getChapterProviders() {
  return [
    ...(MANGAHOOK_API_BASE ? [createMangaHookProvider()] : []),
    ...(ENABLE_COMICK_SOURCE_PROVIDER ? [createComickSourceProvider()] : []),
    ...(ENABLE_GOMANGA_PROVIDER ? [createGoMangaProvider()] : []),
    createXBatoProvider(),
  ];
}

function getProviderById(providerId) {
  return getChapterProviders().find(provider => provider.id === providerId);
}

function buildMangaCacheKey(manga = {}) {
  const title = manga?.title && typeof manga.title === 'object' ? manga.title : {};
  return {
    id: manga?.id || manga?.anilist_id || manga?.mal_id || null,
    title: {
      english: title.english || manga?.title_english || '',
      romaji: title.romaji || manga?.title || '',
      userPreferred: title.userPreferred || '',
      native: title.native || manga?.title_japanese || '',
    },
    synonyms: Array.isArray(manga?.synonyms)
      ? manga.synonyms.slice(0, 10)
      : Array.isArray(manga?.title_synonyms)
        ? manga.title_synonyms.slice(0, 10)
        : [],
    providerConfig: {
      mangahook: Boolean(MANGAHOOK_API_BASE),
      comickSource: ENABLE_COMICK_SOURCE_PROVIDER ? COMICK_SOURCE_IDS : [],
      gomanga: ENABLE_GOMANGA_PROVIDER,
      xbato: true,
    },
  };
}

function createComickSourceProvider() {
  return {
    id: 'comick_source',
    label: PROVIDER_LABELS.comick_source,
    async findSeries(manga) {
      const titles = getTitleCandidates(manga);

      for (const title of titles) {
        for (const source of COMICK_SOURCE_IDS) {
          const data = await fetchJson(`${COMICK_SOURCE_API_BASE}/api/search`, {
            method: 'POST',
            body: { query: title, source },
          });
          const results = data?.results || [];
          const match = pickBestTitleMatch(results, title, item => item.title, titles);

          if (match?.url) {
            return {
              id: encodeComickSeriesId(source, match.url),
              title: match.title,
              source,
              url: match.url,
            };
          }
        }
      }

      return null;
    },
    async getChapters(seriesId) {
      const { source, url } = decodeComickSeriesId(seriesId);
      if (!source || !url) return [];

      const data = await fetchJson(`${COMICK_SOURCE_API_BASE}/api/chapters`, {
        method: 'POST',
        body: { url, source },
      });
      const chapters = data?.chapters || [];

      return chapters
        .filter(chapter => chapter?.url && canScrapeComickChapter(chapter.url))
        .map(chapter => normalizeChapter({
          id: encodeComickChapterId(chapter.url),
          provider: 'comick_source',
          chapter: chapter.number || extractChapterNumber(chapter.title || chapter.url),
          title: chapter.title || `Chapter ${chapter.number || ''}`.trim(),
          language: 'en',
          readableAt: chapter.lastUpdated,
          externalUrl: chapter.url,
          internalReader: canScrapeComickChapter(chapter.url),
        }))
        .sort(sortChaptersDesc);
    },
    async getPages(chapterId) {
      const chapterUrl = decodeComickChapterId(chapterId);
      if (!canScrapeComickChapter(chapterUrl)) return [];
      return scrapeComickChapterPages(chapterUrl);
    },
    getExternalUrl(chapterId) {
      return decodeComickChapterId(chapterId);
    },
  };
}

function createGoMangaProvider() {
  return {
    id: 'gomanga',
    label: PROVIDER_LABELS.gomanga,
    async findSeries(manga) {
      const titles = getTitleCandidates(manga);

      for (const title of titles) {
        const data = await fetchJson(`${GOMANGA_API_BASE}/api/search/${encodeURIComponent(title)}`);
        const results = data?.manga || [];
        const match = pickBestTitleMatch(results, title, item => item.title, titles);
        if (match?.id) {
          return { id: match.id, title: match.title };
        }
      }

      return null;
    },
    async getChapters(seriesId) {
      const data = await fetchJson(`${GOMANGA_API_BASE}/api/manga/${encodeURIComponent(seriesId)}`);
      const chapters = data?.chapters || [];

      return chapters
        .map(chapter => {
          const chapterId = chapter.chapterId || chapter.chapter || extractChapterNumber(chapter.name);
          if (!chapterId) return null;

          return normalizeChapter({
            id: `${seriesId}__${chapterId}`,
            provider: 'gomanga',
            chapter: extractChapterNumber(chapterId),
            title: chapter.name || `Chapter ${chapterId}`,
            language: 'en',
            readableAt: chapter.timestamp || chapter.uploaded,
          });
        })
        .filter(Boolean)
        .sort(sortChaptersDesc);
    },
    async getPages(chapterId) {
      const [seriesId, chapter] = splitProviderChapterId(chapterId);
      if (!seriesId || !chapter) return [];

      const data = await fetchJson(`${GOMANGA_API_BASE}/api/manga/${encodeURIComponent(seriesId)}/${encodeURIComponent(chapter)}`);
      const images = data?.imageUrls || data?.images || [];

      return images
        .map(image => normalizeGoMangaImageUrl(typeof image === 'string' ? image : image?.url || image?.image || image?.src))
        .filter(Boolean);
    },
  };
}

function createXBatoProvider() {
  return {
    id: 'xbato',
    label: PROVIDER_LABELS.xbato,
    async findSeries(manga) {
      const titles = getTitleCandidates(manga);

      for (const title of titles) {
        const data = await fetchJson(`${XBATO_API_BASE}/search?query=${encodeURIComponent(title)}`);
        const englishResults = (data?.data || []).filter(isEnglishXBatoResult);
        const match = pickBestTitleMatch(englishResults, title, item => item.title, titles);
        if (match?.url_detail) {
          return { id: base64ToBase64Url(match.url_detail), title: match.title };
        }
      }

      return null;
    },
    async getChapters(seriesId) {
      const comicId = base64UrlToBase64(seriesId);
      const data = await fetchJson(`${XBATO_API_BASE}/comic/${encodeURIComponent(comicId)}`);
      const chapters = data?.data?.chapters || [];

      return chapters
        .filter(chapter => chapter?.url_detail)
        .map(chapter => normalizeChapter({
          id: base64ToBase64Url(chapter.url_detail),
          provider: 'xbato',
          chapter: extractChapterNumber(chapter.chapter || chapter.name),
          title: chapter.name || chapter.chapter || 'Untitled',
          language: 'en',
          readableAt: chapter.published_at,
        }))
        .sort(sortChaptersDesc);
    },
    async getPages(chapterId) {
      const xbatoChapterId = base64UrlToBase64(chapterId);
      const data = await fetchJson(`${XBATO_API_BASE}/images/${encodeURIComponent(xbatoChapterId)}`);
      const images = data?.data || [];

      return images
        .map(image => typeof image === 'string' ? image : image?.url || image?.image || image?.src)
        .filter(Boolean);
    },
  };
}

function createMangaHookProvider() {
  return {
    id: 'mangahook',
    label: PROVIDER_LABELS.mangahook,
    async findSeries(manga) {
      const titles = getTitleCandidates(manga);

      for (const title of titles) {
        const data = await fetchJson(`${MANGAHOOK_API_BASE}/search/${encodeURIComponent(title)}?page=1`);
        const results = data?.mangaList || data?.searchData || [];
        const match = pickBestTitleMatch(results, title, item => item.title || item.name, titles);
        if (match?.id) {
          return { id: match.id, title: match.title || match.name };
        }
      }

      return null;
    },
    async getChapters(seriesId) {
      const data = await fetchJson(`${MANGAHOOK_API_BASE}/manga/${encodeURIComponent(seriesId)}`);
      const chapters = data?.chapterList || [];

      return chapters
        .map(chapter => {
          const rawId = chapter.id || chapter.chapter || getLastPathSegment(chapter.path);
          if (!rawId) return null;

          return normalizeChapter({
            id: `${seriesId}__${rawId}`,
            provider: 'mangahook',
            chapter: extractChapterNumber(chapter.name || chapter.chapterTitle || rawId),
            title: chapter.name || chapter.chapterTitle || rawId,
            language: 'en',
            readableAt: chapter.createdAt,
          });
        })
        .filter(Boolean)
        .sort(sortChaptersDesc);
    },
    async getPages(chapterId) {
      const [seriesId, chapter] = splitProviderChapterId(chapterId);
      const data = await fetchJson(`${MANGAHOOK_API_BASE}/manga/${encodeURIComponent(seriesId)}/${encodeURIComponent(chapter)}`);
      const images = data?.images || [];

      return images
        .map(image => typeof image === 'string' ? image : image?.image || image?.url)
        .filter(Boolean);
    },
  };
}

function normalizeChapter({ id, provider, chapter, title, language, readableAt, externalUrl, internalReader }) {
  return {
    id,
    provider,
    isFallback: false,
    externalUrl: externalUrl || null,
    internalReader: Boolean(internalReader),
    attributes: {
      chapter: chapter || '',
      title: title || 'Untitled',
      translatedLanguage: language || '',
      readableAt: readableAt || null,
    },
  };
}

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AniFlex/1.0',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(MANGA_PROVIDER_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    return res.json();
  } catch {
    return null;
  }
}

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: getOrigin(url),
      },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(MANGA_PROVIDER_TIMEOUT_MS),
    });

    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function getTitleCandidates(mangaOrTitle = {}) {
  const titleObj = mangaOrTitle.title && typeof mangaOrTitle.title === 'object'
    ? mangaOrTitle.title
    : mangaOrTitle;
  const synonyms = Array.isArray(mangaOrTitle.synonyms)
    ? mangaOrTitle.synonyms
    : Array.isArray(mangaOrTitle.title_synonyms)
      ? mangaOrTitle.title_synonyms
      : [];

  const candidates = [
    titleObj.english,
    titleObj.romaji,
    titleObj.userPreferred,
    ...synonyms,
    titleObj.native,
  ];

  const seen = new Set();
  return candidates
    .map(title => String(title || '').trim())
    .filter(Boolean)
    .filter(title => {
      const key = normalizeTitle(title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isEnglishXBatoResult(item) {
  const translationLanguage = item?.languages?.translation;
  return isEnglishLanguage(translationLanguage);
}

function isEnglishLanguage(language) {
  return ['en', 'eng', 'english'].includes(String(language || '').trim().toLowerCase());
}

function pickBestTitleMatch(items, query, getTitle, candidateTitles = [query]) {
  if (!items.length) return null;

  const normalizedCandidates = candidateTitles
    .map(normalizeTitle)
    .filter(Boolean);
  const scored = items
    .map(item => {
      const title = getTitle(item);
      const searchableTitles = [title, ...getAlternativeTitles(item)]
        .map(normalizeTitle)
        .filter(Boolean);

      let score = 20;
      for (const normalizedTitle of searchableTitles) {
        for (const candidate of normalizedCandidates) {
          if (normalizedTitle === candidate) score = Math.min(score, 0);
          else if (normalizedTitle.includes(candidate) || candidate.includes(normalizedTitle)) score = Math.min(score, 5);
          else if (titleSimilarity(normalizedTitle, candidate) >= 0.88) score = Math.min(score, 8);
        }
      }

      return { item, score };
    })
    .sort((a, b) => a.score - b.score);

  return scored[0]?.score <= 10 ? scored[0].item : null;
}

function getAlternativeTitles(item = {}) {
  return [
    item.attributes?.altTitles,
    item.alternative_names,
    item.altNames,
    item.alt_names,
    item.otherNames,
    item.synonyms,
  ]
    .flatMap(value => Array.isArray(value) ? value : value ? [value] : [])
    .flatMap(value => {
      if (typeof value === 'string') return value.split(/[,;|]/);
      if (value && typeof value === 'object') return Object.values(value);
      return [];
    });
}

function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (!longer.length) return 1;

  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

function levenshteinDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 0; i < a.length; i += 1) {
    let last = i;
    previous[0] = i + 1;

    for (let j = 0; j < b.length; j += 1) {
      const old = previous[j + 1];
      const cost = a[i] === b[j] ? 0 : 1;
      previous[j + 1] = Math.min(
        previous[j + 1] + 1,
        previous[j] + 1,
        last + cost
      );
      last = old;
    }
  }

  return previous[b.length];
}

function normalizeTitle(title = '') {
  return String(title)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9가-힣ぁ-んァ-ン一-龥]+/g, '');
}

function extractChapterNumber(value = '') {
  const match = String(value).match(/(?:chapter|chap|ch\.?)?\s*(\d+(?:\.\d+)?)/i);
  return match?.[1] || String(value).replace(/[^0-9.]/g, '') || '';
}

function sortChaptersDesc(a, b) {
  const aNum = Number.parseFloat(a.attributes.chapter);
  const bNum = Number.parseFloat(b.attributes.chapter);

  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return bNum - aNum;
  return String(b.attributes.chapter).localeCompare(String(a.attributes.chapter), undefined, { numeric: true });
}

function base64ToBase64Url(value) {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBase64(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
}

function decodeBase64Url(value) {
  return Buffer.from(base64UrlToBase64(value), 'base64').toString('utf8');
}

function stringToBase64Url(value) {
  return Buffer.from(String(value), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeComickSeriesId(source, url) {
  return `${source}__${stringToBase64Url(url)}`;
}

function decodeComickSeriesId(seriesId = '') {
  const [source, encodedUrl] = String(seriesId).split('__');
  if (!source || !encodedUrl) return { source: '', url: '' };

  try {
    return { source, url: decodeBase64Url(encodedUrl) };
  } catch {
    return { source: '', url: '' };
  }
}

function encodeComickChapterId(url) {
  return stringToBase64Url(url);
}

function decodeComickChapterId(chapterId = '') {
  try {
    const url = decodeBase64Url(chapterId);
    return /^https?:\/\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

function canScrapeComickChapter(url = '') {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return ['mangakatana.com', 'mangaread.org', 'vortexscans.org', 'asurascans.com', 'flamecomics.xyz'].includes(hostname);
  } catch {
    return false;
  }
}

async function scrapeComickChapterPages(chapterUrl) {
  const html = await fetchText(chapterUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const urls = [];

  $('img[src], img[data-src], link[rel="preload"][as="image"][href]').each((_, element) => {
    const $element = $(element);
    const rawUrl = $element.attr('src') || $element.attr('data-src') || $element.attr('href');
    const imageUrl = normalizeUrl(rawUrl, chapterUrl);
    if (isComickPageImage(imageUrl, chapterUrl)) {
      urls.push(imageUrl);
    }
  });

  for (const match of html.matchAll(/https?:\/\/[^"'\\\s<>]+/g)) {
    const imageUrl = normalizeUrl(match[0], chapterUrl);
    if (isComickPageImage(imageUrl, chapterUrl)) {
      urls.push(imageUrl);
    }
  }

  return [...new Set(urls)];
}

function isComickPageImage(imageUrl, chapterUrl) {
  if (!imageUrl) return false;

  try {
    const image = new URL(imageUrl);
    const chapter = new URL(chapterUrl);
    const imageHost = image.hostname.replace(/^www\./, '');
    const chapterHost = chapter.hostname.replace(/^www\./, '');
    const path = image.pathname.toLowerCase();

    if (chapterHost === 'mangakatana.com') {
      return /^i\d*\.mangakatana\.com$/.test(imageHost) && path.includes('/token/');
    }

    if (chapterHost === 'mangaread.org') {
      return imageHost === 'mangaread.org'
        && path.includes('/wp-content/uploads/wp-manga/data/')
        && !path.includes('/thumbnail');
    }

    if (chapterHost === 'asurascans.com') {
      return imageHost === 'cdn.asurascans.com' && path.includes('/asura-images/chapters/');
    }

    if (chapterHost === 'vortexscans.org') {
      return imageHost === 'storage.vortexscans.org' && path.includes('/upload/series/');
    }

    if (chapterHost === 'flamecomics.xyz') {
      return imageHost === 'cdn.flamecomics.xyz'
        && path.includes('/uploads/images/series/')
        && !path.includes('/thumbnail');
    }

    return false;
  } catch {
    return false;
  }
}

function normalizeUrl(value, baseUrl) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function splitProviderChapterId(chapterId = '') {
  const [seriesId, chapter] = String(chapterId).split('__');
  return [seriesId, chapter || ''];
}

function normalizeGoMangaImageUrl(url) {
  if (!url) return null;
  return String(url).replace(/^http:\/\/gomanga-api\.vercel\.app/i, GOMANGA_API_BASE);
}

function getLastPathSegment(path = '') {
  return String(path).split('/').filter(Boolean).pop();
}
