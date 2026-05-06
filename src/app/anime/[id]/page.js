import Navbar from '@/components/Navbar/Navbar';
import { getAnimeById, getAnilistData, getAnimeRecommendations } from '@/lib/api';
import AnimeDetailClient from './AnimeDetailClient';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const { anime } = await getAnimeById(id);
  if (!anime) return { title: 'Anime Not Found — AniFlex' };
  return {
    title: `${anime.title_english || anime.title} — AniFlex`,
    description: anime.synopsis?.slice(0, 160) || 'Watch this anime on AniFlex.',
  };
}

export default async function AnimePage({ params }) {
  const { id } = await params;
  const [detail, anilistData, recommendations] = await Promise.allSettled([
    getAnimeById(id),
    getAnilistData(id),
    getAnimeRecommendations(id),
  ]);

  const { anime, episodes, pagination, characters, streaming } =
    detail.status === 'fulfilled' ? detail.value : {};

  if (!anime) notFound();

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
