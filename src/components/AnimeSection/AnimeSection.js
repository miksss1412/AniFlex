import Link from 'next/link';
import AnimeCard from '@/components/AnimeCard/AnimeCard';
import styles from './AnimeSection.module.css';

export default function AnimeSection({ title, anime = [], viewMoreHref }) {
  if (!anime.length) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className="section-title">{title}</h2>
        {viewMoreHref && (
          <Link href={viewMoreHref} className={`btn btn-ghost ${styles.viewMore}`} id={`view-more-${title.replace(/\s+/g,'-').toLowerCase()}`}>
            View All →
          </Link>
        )}
      </div>
      <div className="anime-grid">
        {anime.slice(0, 20).map((a, i) => (
          <AnimeCard
            key={`${a.mal_id || a.id || a.idMal || 'anime'}-${i}`}
            anime={a}
            priority={i < 4}
          />
        ))}
      </div>
    </section>
  );
}
