import Navbar from '@/components/Navbar/Navbar';
import { 
  getMangaById, 
  getMangaDexId, 
  getMangaChapters,
  getFallbackId,
  getFallbackChapters
} from '@/lib/api';
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

  // Get MangaDex ID and chapters
  let mangaDexId = await getMangaDexId(manga.title);
  let chapters = [];
  let isFallback = false;
  let fallbackMangaId = null;

  if (mangaDexId) {
    chapters = await getMangaChapters(mangaDexId);
  }

  // Fallback if no chapters found on MangaDex
  if (chapters.length === 0) {
    fallbackMangaId = await getFallbackId(manga.title);
    if (fallbackMangaId) {
      chapters = await getFallbackChapters(fallbackMangaId);
      isFallback = true;
    }
  }

  return (
    <>
      <Navbar />
      <MangaDetailClient
        manga={manga}
        chapters={chapters}
        mangaDexId={isFallback ? fallbackMangaId : mangaDexId}
        isFallback={isFallback}
      />
    </>
  );
}
