import { 
  getChapterPages, 
  getMangaById, 
  getFallbackPages,
  getFallbackId 
} from '@/lib/api';
import MangaReaderClient from './MangaReaderClient';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const manga = await getMangaById(id);
  return {
    title: `Reading ${manga?.title?.english || manga?.title?.romaji || 'Manga'} — AniFlex`,
    description: `Read manga chapter on AniFlex.`,
  };
}

export default async function ReadPage({ params, searchParams }) {
  const { id, chapter } = await params;
  const { source } = await searchParams;
  const manga = await getMangaById(id);

  let pages = [];
  if (source === 'fallback') {
    const fallbackId = await getFallbackId(manga.title);
    pages = await getFallbackPages(fallbackId, chapter);
  } else {
    pages = await getChapterPages(chapter);
  }

  return (
    <>
      <MangaReaderClient
        manga={manga}
        pages={pages}
        chapterId={chapter}
      />
    </>
  );
}
