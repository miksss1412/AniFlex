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

const HOMEPAGE_POOL_SIZE = 50;

const excludeChineseAnime = (items = []) => (
  items.filter(item => (item?.media || item)?.countryOfOrigin !== 'CN')
);

const settledValue = (result, fallback = []) => (
  result.status === 'fulfilled' ? result.value : fallback
);

export const revalidate = 3600;

export const metadata = {
  title: 'AniFlex — Stream Anime Free',
  description: 'Discover and watch thousands of anime series for free. Browse trending, seasonal, and top-rated anime on AniFlex.',
};

export default async function HomePage() {
  const [
    heroResult,
    trendingResult,
    recentResult,
    seasonalResult,
    popularResult,
    upcomingResult,
    scheduleResult,
  ] = await Promise.allSettled([
    getAnilistTrending(1, 15),
    getTrendingAnime(1, HOMEPAGE_POOL_SIZE),
    getRecentAnime(1, HOMEPAGE_POOL_SIZE),
    getSeasonalAnime(1, HOMEPAGE_POOL_SIZE),
    getPopularAnime(1, HOMEPAGE_POOL_SIZE),
    getUpcomingAnime(1, HOMEPAGE_POOL_SIZE),
    getSchedules(),
  ]);

  const heroAnime = excludeChineseAnime(settledValue(heroResult)).slice(0, 5);
  const trendingList = excludeChineseAnime(settledValue(trendingResult));
  const recentList = excludeChineseAnime(settledValue(recentResult));
  const seasonalList = excludeChineseAnime(settledValue(seasonalResult));
  const popularList = excludeChineseAnime(settledValue(popularResult));
  const upcomingList = excludeChineseAnime(settledValue(upcomingResult));
  const scheduleList = excludeChineseAnime(settledValue(scheduleResult));

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
            cardSize="large"
          />
          <AnimeSection
            title="Recently Updated"
            anime={recentList}
            viewMoreHref="/search?filter=recent"
            cardSize="large"
          />
          <AnimeSection
            title="Seasonal Anime"
            anime={seasonalList}
            viewMoreHref="/search?filter=seasonal"
            cardSize="large"
          />
          <AnimeSection
            title="Most Popular"
            anime={popularList}
            viewMoreHref="/search?filter=popular"
            cardSize="large"
          />
          <AnimeSection
            title="Upcoming Anime"
            anime={upcomingList}
            viewMoreHref="/search?filter=upcoming"
            cardSize="large"
          />
          <BroadcastSchedule schedules={scheduleList} />
        </div>
      </main>
    </>
  );
}
