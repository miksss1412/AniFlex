import Navbar from '@/components/Navbar/Navbar';
import { getAnimeById, getAnilistData, getAnimeRecommendations } from '@/lib/api';
import AnimeDetailClient from './AnimeDetailClient';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const { anime } = await getAnimeById(id);
  if (!anime) return { title: 'Anime Not Found — AniFlex' };
  return {
    title: `${anime.title_english || anime.title} — AniFlex`,
    description: anime.synopsis?.slice(0, 160) || 'Watch this anime on AniFlex.',
  };
}

import './page.css';

export default async function AnimePage({ params }) {
  const { id } = await params;
  const [detail, anilistData, recommendations] = await Promise.allSettled([
    getAnimeById(id),
    getAnilistData(id),
    getAnimeRecommendations(id),
  ]);

  const { anime, episodes, pagination, characters, streaming } =
    detail.status === 'fulfilled' ? detail.value : {};

  // True 404: anime ID doesn't exist at all (not a rate limit)
  // We only notFound() if we never had data AND it wasn't a rate limit scenario
  if (!anime) {
    return (
      <>
        <Navbar />
        <main style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '0 24px',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: '3rem' }}>⏳</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Service Busy</h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
            The anime database is temporarily rate-limited. Please wait a moment and try again.
          </p>
          <Link href={`/anime/${id}`} style={{
            marginTop: '8px',
            padding: '10px 28px',
            background: 'var(--grad-teal)',
            color: 'var(--bg-void)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
          }}>
            ↺ Retry
          </Link>
          <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>← Back to Anime</Link>
        </main>
      </>
    );
  }

  const extra  = anilistData.status === 'fulfilled' ? anilistData.value : null;
  const recs   = recommendations.status === 'fulfilled' ? recommendations.value : [];

  return (
    <>
      <Navbar />
      <AnimeDetailClient
        anime={anime}
        episodes={episodes || []}
        pagination={pagination}
        characters={characters || []}
        streaming={streaming || []}
        extra={extra}
        recommendations={recs}
      />
    </>
  );
}
