import { NextResponse } from 'next/server';
import { scrapeHiAnime } from '@/lib/hianime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const episode = searchParams.get('episode') || '1';
  const anilistId = searchParams.get('anilistId');
  const hianimeId = searchParams.get('hianimeId');
  const server = searchParams.get('server');
  const category = searchParams.get('category');

  if (!title && !hianimeId) {
    return NextResponse.json({ error: 'Title or HiAnime ID is required' }, { status: 400 });
  }

  if (process.env.ENABLE_HIANIME_SCRAPER !== 'true') {
    return NextResponse.json(
      { error: 'Native HiAnime scraper is disabled. Set ENABLE_HIANIME_SCRAPER=true to enable it.' },
      { status: 503 }
    );
  }

  try {
    const streams = await scrapeHiAnime(title, episode, {
      anilistId,
      hianimeId,
      server,
      category,
    });

    if (!streams || streams.length === 0) {
      return NextResponse.json(
        { error: 'No streams found from HiAnime. The provider may be blocked or unavailable from this network.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ streams, provider: 'HiAnime' });
  } catch (error) {
    console.error('[HiAnime API] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
