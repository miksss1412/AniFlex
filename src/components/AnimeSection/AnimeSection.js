'use client';
import { useRef } from 'react';
import Link from 'next/link';
import AnimeCard from '@/components/AnimeCard/AnimeCard';
import styles from './AnimeSection.module.css';

export default function AnimeSection({ title, anime = [], viewMoreHref }) {
  const scrollRef = useRef(null);

  if (!anime.length) return null;

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.8;
      const scrollTo = direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <h2 className="section-title">{title}</h2>
          {viewMoreHref && (
            <Link href={viewMoreHref} className={styles.viewMore}>
              View All →
            </Link>
          )}
        </div>
        <div className={styles.controls}>
          <button 
            className={styles.scrollBtn} 
            onClick={() => scroll('left')}
            aria-label="Scroll Left"
          >
            ‹
          </button>
          <button 
            className={styles.scrollBtn} 
            onClick={() => scroll('right')}
            aria-label="Scroll Right"
          >
            ›
          </button>
        </div>
      </div>
      
      <div className={styles.sliderContainer}>
        <div className={styles.slider} ref={scrollRef}>
          {anime.slice(0, 10).map((a, i) => (
            <div key={`${a.mal_id || a.id || i}`} className={styles.slide}>
              <AnimeCard anime={a} priority={i < 4} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
