'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './MangaReader.module.css';

export default function MangaReaderClient({ manga, pages, chapterId, allChapters = [], source, sourceLabel }) {
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

  // Find current chapter index and navigation targets
  // Note: allChapters is typically sorted DESCENDING (latest first)
  const currentIndex = allChapters.findIndex(ch => ch.id === chapterId);
  const nextChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
  const prevChapter = currentIndex !== -1 && currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

  const getChapterUrl = (chapter) => `/manga/read/${manga.id}/${chapter.id}?source=${chapter.provider || source || 'comick_source'}`;

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
            <span className={styles.backText}>Back</span>
          </Link>

          <div className={styles.titleInfo}>
            <h1 className={styles.mangaTitle}>{manga.title.english || manga.title.romaji}</h1>
            <span className={styles.chapterNum}>
              {allChapters[currentIndex]?.attributes?.chapter ? `Chapter ${allChapters[currentIndex].attributes.chapter}` : 'Reading'}
              {sourceLabel ? ` - ${sourceLabel}` : ''}
            </span>
          </div>

          <div className={styles.navActions}>
            {prevChapter && (
              <Link href={getChapterUrl(prevChapter)} className={styles.navActionBtn} title="Previous Chapter">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </Link>
            )}
            {nextChapter && (
              <Link href={getChapterUrl(nextChapter)} className={styles.navActionBtn} title="Next Chapter">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Pages Container */}
      <div className={styles.pagesContainer}>
        {pages.length === 0 ? (
          <div className={styles.error}>
            <h2>Unable to load pages</h2>
            <p>This chapter might be unavailable from the selected source.</p>
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
           
           <div className={styles.bottomActions}>
             {prevChapter && (
               <Link href={getChapterUrl(prevChapter)} className="btn btn-secondary">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                   <polyline points="15 18 9 12 15 6"></polyline>
                 </svg>
                 Prev
               </Link>
             )}

             <Link href={`/manga/${manga.id}`} className="btn btn-secondary" title="Chapter List">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                 <line x1="8" y1="6" x2="21" y2="6"></line>
                 <line x1="8" y1="12" x2="21" y2="12"></line>
                 <line x1="8" y1="18" x2="21" y2="18"></line>
                 <line x1="3" y1="6" x2="3.01" y2="6"></line>
                 <line x1="3" y1="12" x2="3.01" y2="12"></line>
                 <line x1="3" y1="18" x2="3.01" y2="18"></line>
               </svg>
             </Link>

             {nextChapter && (
               <Link href={getChapterUrl(nextChapter)} className="btn btn-primary">
                 Next
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: '8px'}}>
                   <polyline points="9 18 15 12 9 6"></polyline>
                 </svg>
               </Link>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
