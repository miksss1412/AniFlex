import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 12000;

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get('url');
  const referer = requestUrl.searchParams.get('referer');

  if (!target) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return NextResponse.json({ error: 'Unsupported URL protocol' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: buildProxyHeaders(request, referer, targetUrl),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream stream request failed: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') || '';
    const isPlaylist = contentType.includes('mpegurl') || targetUrl.pathname.endsWith('.m3u8');

    if (isPlaylist) {
      const playlist = await upstream.text();
      const rewritten = rewritePlaylist(playlist, targetUrl, requestUrl.origin, referer);

      return new Response(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: buildResponseHeaders(upstream),
    });
  } catch (error) {
    const message = error.name === 'AbortError' ? 'Stream request timed out' : 'Stream proxy failed';
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function buildProxyHeaders(request, referer, targetUrl) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: request.headers.get('accept') || '*/*',
  };

  const range = request.headers.get('range');
  if (range) headers.Range = range;

  if (referer) {
    headers.Referer = referer;
  } else {
    headers.Referer = `${targetUrl.protocol}//${targetUrl.host}/`;
  }

  return headers;
}

function buildResponseHeaders(upstream) {
  const headers = new Headers();
  const passthrough = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
  ];

  for (const header of passthrough) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }

  headers.set('Cache-Control', 'no-store');
  return headers;
}

function rewritePlaylist(playlist, playlistUrl, origin, referer) {
  return playlist
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, value) => {
          const resolved = new URL(value, playlistUrl).toString();
          return `URI="${toProxyUrl(resolved, origin, referer)}"`;
        });
      }

      return toProxyUrl(new URL(trimmed, playlistUrl).toString(), origin, referer);
    })
    .join('\n');
}

function toProxyUrl(url, origin, referer) {
  const params = new URLSearchParams({ url });
  if (referer) params.set('referer', referer);
  return `${origin}/api/anime/hls-proxy?${params.toString()}`;
}
