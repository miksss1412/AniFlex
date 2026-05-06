// Main landing page
import Navbar from '@/components/Navbar/Navbar';
import { getTrendingAnime, getPopularAnime, getSeasonalAnime, getAnilistTrending } from '@/lib/api';
import HeroSection from '@/components/HeroSection/HeroSection';
import AnimeSection from '@/components/AnimeSection/AnimeSection';
import styles from './page.module.css';

export const metadata = {
  title: 'AniFlex — Stream Anime Free',
  description: 'Discover and watch thousands of anime series for free. Browse trending, seasonal, and top-rated anime on AniFlex.',
};

export default async function HomePage() {
  // Stagger Jikan calls to respect the 3 req/sec limit
  const heroAnime = await getAnilistTrending(1, 5);
  const trendingList = await getTrendingAnime();
  const popularList = await getPopularAnime();
  const seasonalList = await getSeasonalAnime();

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <HeroSection anime={heroAnime} />
        <div className={`container ${styles.sections}`}>
          <AnimeSection
            title="🔥 Trending Now"
            anime={trendingList}
            viewMoreHref="/search?filter=trending"
          />
          <AnimeSection
            title="📅 This Season"
            anime={seasonalList}
            viewMoreHref="/search?filter=seasonal"
          />
          <AnimeSection
            title="🏆 Most Popular"
            anime={popularList}
            viewMoreHref="/search?filter=popular"
          />
        </div>
      </main>
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerInner}>
            <span className={styles.footerLogo}>▶ Ani<span className={styles.footerAccent}>Flex</span></span>
            <p className={styles.footerNote}>
              AniFlex uses the free <a href="https://jikan.moe" target="_blank" rel="noopener noreferrer">Jikan API</a> & <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a>.
              Streaming content is provided by third-party embed services.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
