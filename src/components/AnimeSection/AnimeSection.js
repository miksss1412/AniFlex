'use client';
import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import AnimeCard from '@/components/AnimeCard/AnimeCard';
import styles from './AnimeSection.module.css';

export default function AnimeSection({ title, anime = [], viewMoreHref }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      // Check after initial render and small delay for content loading
      const timer = setTimeout(checkScroll, 500);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        clearTimeout(timer);
      };
    }
  }, [anime]);

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
      </div>
      
      <div className={styles.sliderContainer}>
        {canScrollLeft && (
          <button 
            className={`${styles.scrollBtn} ${styles.left}`} 
            onClick={() => scroll('left')}
            aria-label="Scroll Left"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}
        
        <div className={styles.slider} ref={scrollRef}>
          {anime.slice(0, 10).map((a, i) => (
            <div key={`${a.mal_id || a.id || i}`} className={styles.slide}>
              <AnimeCard anime={a} priority={i < 4} />
            </div>
          ))}
        </div>

        {canScrollRight && (
          <button 
            className={`${styles.scrollBtn} ${styles.right}`} 
            onClick={() => scroll('right')}
            aria-label="Scroll Right"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
