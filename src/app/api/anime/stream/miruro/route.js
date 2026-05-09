import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_ORDER = ['kiwi', 'hop', 'bee', 'zoro', 'animekai', 'jet', 'gogo', 'arc'];
const CATEGORY_ORDER = ['sub', 'dub'];
const DEFAULT_REQUEST_TIMEOUT_MS = 12000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const anilistId = searchParams.get('anilistId');
  const episode = Number(searchParams.get('episode') || '1');
  const preferredProvider = searchParams.get('provider');
  const preferredCategory = searchParams.get('category');
  const baseUrl = getMiruroBaseUrl();
  const requestOrigin = getRequestOrigin(request);

  if (!baseUrl) {
    return NextResponse.json(
      { error: 'Miruro API is not configured. Set MIRURO_API_BASE or ANIME_API_URL.' },
      { status: 503 }
    );
  }

  if (!anilistId) {
    return NextResponse.json({ error: 'AniList ID is required' }, { status: 400 });
  }

  try {
    const episodesPayload = await fetchJson(`${baseUrl}/episodes/${encodeURIComponent(anilistId)}`, requestOrigin);
    const candidate = findEpisodeCandidate(episodesPayload, episode, {
      provider: preferredProvider,
      category: preferredCategory,
    });

    if (!candidate?.id) {
      return NextResponse.json(
        { error: `Episode ${episode} was not found in the configured Miruro API providers.` },
        { status: 404 }
      );
    }

    const sourcesPayload = await fetchJson(`${baseUrl}/${stripLeadingSlash(candidate.id)}`, requestOrigin);
    const streams = normalizeStreams(sourcesPayload, candidate);

    if (!streams.length) {
      return NextResponse.json(
        { error: 'Miruro API did not return playable streams for this episode.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      streams,
      provider: `Miruro ${candidate.provider}`,
      subtitles: normalizeSubtitles(sourcesPayload?.subtitles),
      intro: sourcesPayload?.intro || null,
      outro: sourcesPayload?.outro || null,
    });
  } catch (error) {
    console.error('[Miruro API] Error:', error);
    const isTimeout = error.name === 'AbortError' || error.message?.includes('timed out');

    return NextResponse.json(
      { error: isTimeout ? 'Miruro API request timed out. Try reloading or choose another server.' : `Miruro API request failed: ${error.message}` },
      { status: isTimeout ? 504 : 502 }
    );
  }
}

function getRequestOrigin(request) {
  const envOrigin = process.env.MIRURO_REQUEST_ORIGIN;
  if (envOrigin) return envOrigin.replace(/\/+$/, '');

  const origin = request.headers.get('origin');
  if (origin) return origin.replace(/\/+$/, '');

  const requestUrl = new URL(request.url);
  return `${requestUrl.protocol}//${requestUrl.host}`;
}

function getMiruroBaseUrl() {
  const configured = process.env.MIRURO_API_BASE || process.env.ANIME_API_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return null;
}

function findEpisodeCandidate(payload, episodeNumber, preferred = {}) {
  const providers = payload?.providers || {};
  const providerOrder = unique([
    preferred.provider,
    ...PROVIDER_ORDER,
    ...Object.keys(providers),
  ].filter(Boolean));
  const categoryOrder = unique([
    preferred.category,
    ...CATEGORY_ORDER,
  ].filter(Boolean));

  for (const provider of providerOrder) {
    const providerData = providers[provider];
    const episodeGroups = providerData?.episodes || providerData;
    if (!episodeGroups) continue;

    for (const category of categoryOrder) {
      const episodes = Array.isArray(episodeGroups[category]) ? episodeGroups[category] : [];
      const match = episodes.find((item) => Number(item.number) === episodeNumber);
      if (match?.id) {
        return {
          ...match,
          provider,
          category,
        };
      }
    }
  }

  return null;
}

function normalizeStreams(payload, candidate) {
  const streams = (payload?.streams || payload?.sources || [])
    .map((stream, index) => {
      const url = stream.url || stream.file;
      const isHls = stream.type === 'hls' || stream.isM3U8 || String(url).includes('.m3u8');

      return {
        url: isHls ? toHlsProxyUrl(url, stream.referer) : url,
        sourceUrl: url,
        quality: stream.quality || stream.label || (isHls ? 'Auto' : `Source ${index + 1}`),
        type: isHls ? 'hls' : 'iframe',
        isDub: candidate.category === 'dub',
        provider: `Miruro ${candidate.provider}`,
        server: candidate.provider,
        referer: stream.referer || null,
        episodeTitle: candidate.title || '',
      };
    })
    .filter((stream) => stream.url);

  return preferEmbedsForDuplicateQualities(streams)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'hls' ? -1 : 1;
      return qualityValue(b.quality) - qualityValue(a.quality);
    });
}

function preferEmbedsForDuplicateQualities(streams) {
  const byQuality = new Map();

  for (const stream of streams) {
    const key = `${stream.isDub ? 'dub' : 'sub'}:${String(stream.quality).toLowerCase()}`;
    const existing = byQuality.get(key);

    if (!existing || (existing.type === 'hls' && stream.type === 'iframe')) {
      byQuality.set(key, stream);
    }
  }

  return Array.from(byQuality.values());
}

function toHlsProxyUrl(url, referer) {
  const params = new URLSearchParams({ url });
  if (referer) params.set('referer', referer);
  return `/api/anime/hls-proxy?${params.toString()}`;
}

function normalizeSubtitles(subtitles = []) {
  return subtitles.map((subtitle) => ({
    url: subtitle.file || subtitle.url,
    label: subtitle.label || subtitle.lang || 'Subtitle',
    kind: subtitle.kind || 'captions',
  })).filter((subtitle) => subtitle.url);
}

async function fetchJson(url, requestOrigin) {
  const controller = new AbortController();
  const requestTimeoutMs = getRequestTimeoutMs();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Origin: requestOrigin,
        Referer: `${requestOrigin}/`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    return res.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Miruro API timed out after ${requestTimeoutMs / 1000}s`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getRequestTimeoutMs() {
  const value = Number(process.env.MIRURO_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REQUEST_TIMEOUT_MS;
}

function stripLeadingSlash(value) {
  return String(value || '').replace(/^\/+/, '');
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

function qualityValue(quality) {
  return Number(String(quality).match(/\d+/)?.[0]) || 0;
}
