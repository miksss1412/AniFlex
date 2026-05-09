import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_ORDER = ['zoro', 'arc', 'kiwi', 'animekai', 'jet', 'gogo'];
const CATEGORY_ORDER = ['sub', 'dub'];
const DEFAULT_REQUEST_TIMEOUT_MS = 12000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const anilistId = searchParams.get('anilistId');
  const episode = Number(searchParams.get('episode') || '1');
  const preferredProvider = searchParams.get('provider');
  const preferredCategory = searchParams.get('category');
  const baseUrl = getMiruroBaseUrl();

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
    const episodesPayload = await fetchJson(`${baseUrl}/episodes/${encodeURIComponent(anilistId)}`);
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

    const sourcesPayload = await fetchJson(`${baseUrl}/${stripLeadingSlash(candidate.id)}`);
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
  return (payload?.streams || payload?.sources || [])
    .map((stream, index) => ({
      url: stream.url || stream.file,
      quality: stream.quality || stream.label || (stream.type === 'hls' ? 'Auto' : `Source ${index + 1}`),
      type: stream.type === 'hls' || stream.isM3U8 || String(stream.url || stream.file).includes('.m3u8') ? 'hls' : 'iframe',
      isDub: candidate.category === 'dub',
      provider: `Miruro ${candidate.provider}`,
      server: candidate.provider,
      episodeTitle: candidate.title || '',
    }))
    .filter((stream) => stream.url)
    .sort((a, b) => qualityValue(b.quality) - qualityValue(a.quality));
}

function normalizeSubtitles(subtitles = []) {
  return subtitles.map((subtitle) => ({
    url: subtitle.file || subtitle.url,
    label: subtitle.label || subtitle.lang || 'Subtitle',
    kind: subtitle.kind || 'captions',
  })).filter((subtitle) => subtitle.url);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const requestTimeoutMs = getRequestTimeoutMs();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
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
