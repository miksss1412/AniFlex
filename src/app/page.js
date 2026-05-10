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
import BroadcastSchedule from '@/components/BroadcastSchedule/BroadcastSchedule';
import styles from './page.module.css';

// Small helper to stagger calls and avoid 429
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const HOMEPAGE_POOL_SIZE = 50;

const excludeChineseAnime = (items = []) => (
  items.filter(item => (item?.media || item)?.countryOfOrigin !== 'CN')
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'AniFlex — Stream Anime Free',
  description: 'Discover and watch thousands of anime series for free. Browse trending, seasonal, and top-rated anime on AniFlex.',
};

export default async function HomePage() {
  // Stagger Jikan calls to respect the 3 req/sec limit
  const heroAnime = excludeChineseAnime(await getAnilistTrending(1, 15)).slice(0, 5);
  await delay(400);
  const trendingList = excludeChineseAnime(await getTrendingAnime(1, HOMEPAGE_POOL_SIZE));
  await delay(400);
  const recentList = excludeChineseAnime(await getRecentAnime(1, HOMEPAGE_POOL_SIZE));
  await delay(400);
  const seasonalList = excludeChineseAnime(await getSeasonalAnime(1, HOMEPAGE_POOL_SIZE));
  await delay(400);
  const popularList = excludeChineseAnime(await getPopularAnime(1, HOMEPAGE_POOL_SIZE));
  await delay(400);
  const upcomingList = excludeChineseAnime(await getUpcomingAnime(1, HOMEPAGE_POOL_SIZE));
  await delay(400);
  const scheduleList = excludeChineseAnime(await getSchedules());

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
          <BroadcastSchedule schedules={scheduleList} />
        </div>
      </main>
    </>
  );
}
