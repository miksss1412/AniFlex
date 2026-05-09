import { getMangaById } from '@/lib/api';
import { getReadableMangaPages } from '@/lib/mangaProviders';
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
  const readSource = await getReadableMangaPages(manga, chapter, source || 'comick_source');

  return (
    <>
      <MangaReaderClient
        manga={manga}
        pages={readSource.pages || []}
        chapterId={chapter}
        allChapters={readSource.chapters || []}
        source={readSource.provider || source}
        sourceLabel={readSource.providerLabel}
      />
    </>
  );
}
