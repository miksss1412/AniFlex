import { NextResponse } from 'next/server';

const REQUEST_TIMEOUT_MS = 8000;
const JIKAN_PATH_PATTERN = /^\/[a-z0-9/_?=&%.,:-]+$/i;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'No path provided' }, { status: 400 });
  }

  if (path.length > 300 || !JIKAN_PATH_PATTERN.test(path) || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const jikanUrl = `https://api.jikan.moe/v4${path}`;
    const res = await fetch(jikanUrl, { signal: controller.signal });
    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream request failed' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const status = error.name === 'AbortError' ? 504 : 500;
    return NextResponse.json({ error: 'Proxy error' }, { status });
  } finally {
    clearTimeout(timeout);
  }
}
