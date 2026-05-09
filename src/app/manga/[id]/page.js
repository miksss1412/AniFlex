import Navbar from '@/components/Navbar/Navbar';
import { getMangaById } from '@/lib/api';
import { getReadableMangaChapters } from '@/lib/mangaProviders';
import MangaDetailClient from './MangaDetailClient';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const manga = await getMangaById(id);
  if (!manga) return { title: 'Manga Not Found — AniFlex' };
  return {
    title: `${manga.title.english || manga.title.romaji} — AniFlex`,
    description: manga.description?.slice(0, 160) || 'Read this manga on AniFlex.',
  };
}

export default async function MangaPage({ params }) {
  const { id } = await params;
  const manga = await getMangaById(id);

  if (!manga) {
    notFound();
  }

  const chapterSource = await getReadableMangaChapters(manga);

  return (
    <>
      <Navbar />
      <MangaDetailClient
        manga={manga}
        chapters={chapterSource.chapters}
        chapterSource={chapterSource}
      />
    </>
  );
}
