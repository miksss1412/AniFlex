import { Suspense } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import SearchClient from './SearchClient';
import { getGenres } from '@/lib/api';

export const metadata = {
  title: 'Browse Anime — AniFlex',
  description: 'Search and browse thousands of anime by genre, type, and status on AniFlex.',
};

export default async function SearchPage() {
  const genres = await getGenres();
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="container" style={{paddingTop:'100px', color:'var(--text-muted)'}}>Loading search…</div>}>
        <SearchClient genres={genres} />
      </Suspense>
    </>
  );
}
