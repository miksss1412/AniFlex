// Main landing page
import Navbar from '@/components/Navbar/Navbar';
import { 
  getTrendingAnime, 
  getPopularAnime, 
  getSeasonalAnime, 
  getUpcomingAnime,
  getSchedules,
  getRecentAnime,
  getAnilistTrending 
} from '@/lib/api';
import HeroSection from '@/components/HeroSection/HeroSection';
import AnimeSection from '@/components/AnimeSection/AnimeSection';
import styles from './page.module.css';

// Small helper to stagger calls and avoid 429
const delay = (ms) => new Promise(r => setTimeout(r, ms));

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'AniFlex — Stream Anime Free',
  description: 'Discover and watch thousands of anime series for free. Browse trending, seasonal, and top-rated anime on AniFlex.',
};

export default async function HomePage() {
  // Stagger Jikan calls to respect the 3 req/sec limit
  const heroAnime = await getAnilistTrending(1, 5);
  await delay(400);
  const trendingList = await getTrendingAnime();
  await delay(400);
  const recentList = await getRecentAnime();
  await delay(400);
  const seasonalList = await getSeasonalAnime();
  await delay(400);
  const popularList = await getPopularAnime();
  await delay(400);
  const upcomingList = await getUpcomingAnime();
  await delay(400);
  const scheduleList = await getSchedules();

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <HeroSection anime={heroAnime} />
        <div className={`container ${styles.sections}`}>
          <AnimeSection
            title="Trending Now"
            anime={trendingList}
            viewMoreHref="/search?filter=trending"
          />
          <AnimeSection
            title="Recently Updated"
            anime={recentList}
            viewMoreHref="/search?filter=recent"
          />
          <AnimeSection
            title="Seasonal Anime"
            anime={seasonalList}
            viewMoreHref="/search?filter=seasonal"
          />
          <AnimeSection
            title="Most Popular"
            anime={popularList}
            viewMoreHref="/search?filter=popular"
          />
          <AnimeSection
            title="Upcoming Anime"
            anime={upcomingList}
            viewMoreHref="/search?filter=upcoming"
          />
          <AnimeSection
            title="Broadcast Schedules"
            anime={scheduleList}
            // No direct filter for schedules in current search yet, 
            // but we can link to Browse for now
            viewMoreHref="/search"
          />
        </div>
      </main>
    </>
  );
}
