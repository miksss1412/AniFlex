import { NextResponse } from 'next/server';
import { scrapeAnimePahe } from '@/lib/animepahe';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title   = searchParams.get('title');
  const episode = searchParams.get('episode') || '1';
  const anilistId = searchParams.get('anilistId');

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  try {
    const streams = await scrapeAnimePahe(title, episode, { anilistId });

    if (!streams || streams.length === 0) {
      return NextResponse.json(
        { error: 'No streams found from AnimePahe. The provider may be blocked or unavailable from this network.' },
        { status: 502 }
      );
    }

    // Return all streams sorted by quality (best first)
    return NextResponse.json({ streams, provider: 'AnimePahe' });

  } catch (error) {
    console.error('[AnimePahe API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
