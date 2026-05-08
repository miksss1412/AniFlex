import { NextResponse } from 'next/server';
import { scrapeAnimePahe } from '@/lib/animepahe';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const episode = searchParams.get('episode') || '1';

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  try {
    const streams = await scrapeAnimePahe(title, episode);

    if (!streams || streams.length === 0) {
      return new Response(`
        <html>
          <body style="background:#0a0a0a; color:#fff; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center; padding:20px;">
            <div>
              <h2 style="color:#00f5d4;">AnimePahe is currently unavailable</h2>
              <p style="color:#999;">The provider is protected by anti-bot security. Please try <b>VidSrc.to</b> or <b>VidSrc.me</b> from the server list below.</p>
            </div>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    // Sort streams to pick the highest resolution (1080p > 720p > 360p)
    const sortedStreams = [...streams].sort((a, b) => {
      const resA = parseInt(a.resolution) || 0;
      const resB = parseInt(b.resolution) || 0;
      return resB - resA;
    });

    const bestStream = sortedStreams[0];
    return NextResponse.redirect(bestStream.url);
  } catch (error) {
    console.error('[AnimePahe API Route Error]', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

