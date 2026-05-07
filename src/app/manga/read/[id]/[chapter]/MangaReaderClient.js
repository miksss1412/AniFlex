'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './MangaReader.module.css';

export default function MangaReaderClient({ manga, pages, chapterId }) {
  const [showNav, setShowNav] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      if (window.scrollY > lastScrollY && window.scrollY > 100) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      lastScrollY = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={styles.reader}>
      {/* Reader Nav */}
      <div className={`${styles.readerNav} ${showNav ? styles.navShow : styles.navHide}`}>
        <div className={`container ${styles.navInner}`}>
          <Link href={`/manga/${manga.id}`} className={styles.backBtn}>
            <span className={styles.backIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </span>
            <span className={styles.backText}>Back to Manga</span>
          </Link>
          <div className={styles.titleInfo}>
            <h1 className={styles.mangaTitle}>{manga.title.english || manga.title.romaji}</h1>
          </div>
        </div>
      </div>

      {/* Pages Container */}
      <div className={styles.pagesContainer}>
        {pages.length === 0 ? (
          <div className={styles.error}>
            <h2>Unable to load pages</h2>
            <p>This chapter might be unavailable or MangaDex is experiencing issues.</p>
            <Link href={`/manga/${manga.id}`} className="btn btn-primary">Go Back</Link>
          </div>
        ) : (
          pages.map((src, i) => (
            <div key={i} className={styles.pageItem}>
              <img 
                src={src} 
                alt={`Page ${i + 1}`} 
                className={styles.pageImg}
                loading={i < 3 ? "eager" : "lazy"}
              />
            </div>
          ))
        )}
      </div>

      {/* Bottom Controls */}
      <div className={styles.bottomControls}>
        <div className="container">
           <p className={styles.endNote}>End of Chapter</p>
           <Link href={`/manga/${manga.id}`} className="btn btn-secondary">
             Return to Chapter List
           </Link>
        </div>
      </div>
    </div>
  );
}
