import { NextResponse } from 'next/server';
import { getMiruroFullData, getMiruroSources } from '@/lib/miruro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_ORDER = ['kiwi', 'hop', 'bee', 'zoro', 'animekai', 'jet', 'gogo', 'arc'];
const CATEGORY_ORDER = ['sub', 'dub'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const anilistId = searchParams.get('anilistId');
  const episode = Number(searchParams.get('episode') || '1');
  const preferredProvider = searchParams.get('provider');
  const preferredCategory = searchParams.get('category');

  if (!anilistId) {
    return NextResponse.json({ error: 'AniList ID is required' }, { status: 400 });
  }

  try {
    // 1. Get full episode data using internal Miruro logic
    console.log('[Miruro Route] Fetching episodes for AniList ID:', anilistId);
    const episodesPayload = await getMiruroFullData(anilistId);
    
    if (!episodesPayload) {
      console.warn('[Miruro Route] No episodes payload returned');
      return NextResponse.json({ error: 'No data found for this anime on Miruro' }, { status: 404 });
    }

    // 2. Find the specific episode candidate
    console.log('[Miruro Route] Searching for episode:', episode);
    const candidate = findEpisodeCandidate(episodesPayload, episode, {
      provider: preferredProvider,
      category: preferredCategory,
    });

    if (!candidate?.id) {
      console.warn('[Miruro Route] Episode candidate not found for number:', episode);
      return NextResponse.json(
        { error: `Episode ${episode} was not found on Miruro.` },
        { status: 404 }
      );
    }
    console.log('[Miruro Route] Found candidate:', candidate.provider, candidate.category, candidate.id);

    // 3. Get sources using internal Miruro logic
    const sourcesPayload = await getMiruroSources(
      candidate.id, 
      anilistId, 
      candidate.provider, 
      candidate.category
    );
    
    if (!sourcesPayload) {
      return NextResponse.json(
        { error: 'Could not fetch streaming sources from Miruro.' },
        { status: 502 }
      );
    }

    // 4. Normalize and return
    const streams = normalizeStreams(sourcesPayload, candidate);

    return NextResponse.json({
      streams,
      provider: `Miruro ${candidate.provider}`,
      subtitles: normalizeSubtitles(sourcesPayload?.subtitles),
      intro: sourcesPayload?.intro || null,
      outro: sourcesPayload?.outro || null,
    });
  } catch (error) {
    console.error('[Miruro API] Error:', error);
    return NextResponse.json(
      { error: `Miruro internal error: ${error.message}` },
      { status: 500 }
    );
  }
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
  const streams = (payload?.sources || [])
    .filter((stream) => !(stream.type === 'hls' && stream.isActive === false))
    .map((stream, index) => {
      const url = stream.url || stream.file;
      if (!url) return null;

      const referer = stream.referer || payload?.headers?.Referer || 'https://www.miruro.tv';
      const isHls = stream.type === 'hls' || stream.isM3U8 || String(url).includes('.m3u8');

      return {
        url: isHls ? toHlsProxyUrl(url, referer) : url,
        sourceUrl: url,
        quality: stream.quality || stream.label || (isHls ? 'Auto' : `Source ${index + 1}`),
        type: isHls ? 'hls' : 'iframe',
        isDub: candidate.category === 'dub',
        provider: `Miruro ${candidate.provider}`,
        server: candidate.provider,
        referer,
        episodeTitle: candidate.title || '',
      };
    })
    .filter(Boolean);

  return uniqueByQuality(streams).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'hls' ? -1 : 1;
    return qualityValue(b.quality) - qualityValue(a.quality);
  });
}

function uniqueByQuality(streams) {
  const byQuality = new Map();

  for (const stream of streams) {
    const key = `${stream.isDub ? 'dub' : 'sub'}:${String(stream.quality).toLowerCase()}`;
    const existing = byQuality.get(key);

    if (!existing || (stream.type === 'iframe' && existing.type !== 'iframe')) {
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
