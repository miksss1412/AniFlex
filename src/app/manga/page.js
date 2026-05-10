import Navbar from '@/components/Navbar/Navbar';
import { 
  getTrendingManga, 
  getPopularManga,
  getRecentManga,
  getTopManga
} from '@/lib/api';
import HeroSection from '@/components/HeroSection/HeroSection';
import AnimeSection from '@/components/AnimeSection/AnimeSection';
import styles from '../page.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Manga — AniFlex',
  description: 'Read your favorite manga, manhwa, and manhua on AniFlex.',
};

export default async function MangaPage() {
  const trendingManga = await getTrendingManga(1, 10);
  const popularManga = await getPopularManga(1, 10);
  const recentManga = await getRecentManga(1, 10);
  const topManga = await getTopManga(1, 10);

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <HeroSection anime={trendingManga.slice(0, 5)} isManga={true} />
        <div className={`container ${styles.sections}`}>
          <AnimeSection
            title="Trending Now"
            anime={trendingManga}
            viewMoreHref="/search?type=manga&filter=trending"
            isManga={true}
            cardSize="large"
          />
          <AnimeSection
            title="Recently Updated"
            anime={recentManga}
            viewMoreHref="/search?type=manga&filter=recent"
            isManga={true}
            cardSize="large"
          />
          <AnimeSection
            title="Most Popular"
            anime={popularManga}
            viewMoreHref="/search?type=manga&filter=popular"
            isManga={true}
            cardSize="large"
          />
          <AnimeSection
            title="Top Rated"
            anime={topManga}
            viewMoreHref="/search?type=manga&filter=top"
            isManga={true}
            cardSize="large"
          />
        </div>
      </main>
    </>
  );
}
