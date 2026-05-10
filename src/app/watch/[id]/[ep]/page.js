import { getAnimeById } from '@/lib/api';
import WatchPageClient from './WatchPageClient';

export async function generateMetadata({ params }) {
  const { id, ep } = await params;
  const { anime } = await getAnimeById(id);
  const title = anime?.title_english || anime?.title || 'Anime';
  return {
    title: `${title} — Episode ${ep} | AniFlex`,
    description: `Watch ${title} Episode ${ep} online free on AniFlex.`,
  };
}

export default async function WatchPage({ params }) {
  const { id, ep } = await params;
  const detail = await getAnimeById(id);

  const { anime, episodes } = detail;
  
  return (
    <WatchPageClient
      animeId={id}
      anilistId={anime?.anilist_id}
      episode={ep}
      anime={anime}
      episodes={episodes || []}
    />
  );
}
