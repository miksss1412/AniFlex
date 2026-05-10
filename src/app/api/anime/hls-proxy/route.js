import { NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 12000;
const MAX_PLAYLIST_BYTES = 1024 * 1024;
const MAX_SEGMENT_BYTES = 80 * 1024 * 1024;
const HLS_SEGMENT_EXTENSIONS = new Set(['.aac', '.key', '.m4s', '.mp4', '.ts', '.vtt', '.webvtt']);

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get('url');
  const referer = normalizeReferer(requestUrl.searchParams.get('referer'));

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

  if (targetUrl.username || targetUrl.password) {
    return NextResponse.json({ error: 'URL credentials are not allowed' }, { status: 400 });
  }

  if (await resolvesToPrivateAddress(targetUrl.hostname)) {
    return NextResponse.json({ error: 'URL host is not allowed' }, { status: 400 });
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
      const playlist = await readTextWithLimit(upstream, MAX_PLAYLIST_BYTES);
      const rewritten = rewritePlaylist(playlist, targetUrl, requestUrl.origin, referer);

      return new Response(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (!isAllowedSegmentResponse(upstream, targetUrl)) {
      return NextResponse.json({ error: 'Unsupported upstream content type' }, { status: 415 });
    }

    return new Response(upstream.body, {
      status: upstream.status,
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

function normalizeReferer(value) {
  if (!value) return '';

  try {
    const refererUrl = new URL(value);
    if (!['http:', 'https:'].includes(refererUrl.protocol)) return '';
    return refererUrl.toString();
  } catch {
    return '';
  }
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

function isAllowedSegmentResponse(upstream, targetUrl) {
  const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
  const contentLength = Number(upstream.headers.get('content-length') || 0);
  const extension = getPathExtension(targetUrl.pathname);

  if (contentLength && contentLength > MAX_SEGMENT_BYTES) return false;
  if (HLS_SEGMENT_EXTENSIONS.has(extension)) return true;
  if (contentType.startsWith('video/') || contentType.startsWith('audio/')) return true;
  if (contentType.includes('mp2t') || contentType.includes('octet-stream')) return true;
  if (contentType.includes('vtt')) return true;

  return false;
}

function getPathExtension(pathname) {
  const lastSegment = pathname.split('/').pop() || '';
  const dotIndex = lastSegment.lastIndexOf('.');
  return dotIndex === -1 ? '' : lastSegment.slice(dotIndex).toLowerCase();
}

async function readTextWithLimit(response, byteLimit) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength && contentLength > byteLimit) {
    throw new Error('Playlist is too large');
  }

  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > byteLimit) {
      await reader.cancel();
      throw new Error('Playlist is too large');
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

async function resolvesToPrivateAddress(hostname) {
  if (!hostname) return true;

  const normalizedHost = hostname.toLowerCase();
  if (normalizedHost === 'localhost' || normalizedHost.endsWith('.localhost')) return true;

  const ipType = net.isIP(normalizedHost);
  if (ipType) return isPrivateIp(normalizedHost, ipType);

  try {
    const records = await dns.lookup(normalizedHost, { all: true, verbatim: true });
    return records.some(record => isPrivateIp(record.address, record.family));
  } catch {
    return true;
  }
}

function isPrivateIp(address, family) {
  if (family === 4 || net.isIP(address) === 4) {
    const parts = address.split('.').map(part => Number(part));
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part))) return true;
    const [a, b] = parts;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  const value = address.toLowerCase();
  return (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe80:') ||
    value.startsWith('ff')
  );
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
