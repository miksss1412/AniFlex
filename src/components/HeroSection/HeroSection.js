'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './HeroSection.module.css';

export default function HeroSection({ anime = [], isManga = false }) {
  const [current, setCurrent] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const validAnime = anime.filter(a => a?.bannerImage || a?.coverImage?.extraLarge);

  const goTo = useCallback((idx) => {
    if (transitioning) return;
    setTransitioning(true);
    setTimeout(() => { setCurrent(idx); setTransitioning(false); }, 400);
  }, [transitioning]);

  useEffect(() => {
    if (validAnime.length <= 1) return;
    const id = setInterval(() => {
      goTo((current + 1) % validAnime.length);
    }, 6000);
    return () => clearInterval(id);
  }, [current, validAnime.length, goTo]);

  if (!validAnime.length) return <div className={styles.heroEmpty} />;

  const item   = validAnime[current];
  const banner = item.bannerImage || item.coverImage?.extraLarge;
  const cover  = item.coverImage?.large || item.coverImage?.extraLarge;
  const title  = item.title?.english || item.title?.romaji || 'Unknown Title';
  const desc   = item.description?.replace(/<[^>]*>/g, '').slice(0, 180) + '…' || '';
  const malId  = item.idMal;
  const score  = item.averageScore ? (item.averageScore / 10).toFixed(1) : null;
  const genres = item.genres?.slice(0, 3) || [];
  const typeLabel = isManga ? (
    item.countryOfOrigin === 'KR' ? 'Manhwa' :
    item.countryOfOrigin === 'CN' ? 'Manhua' :
    'Manga'
  ) : (item.format || 'Anime');

  return (
    <section className={styles.hero}>
      {/* Background banner */}
      <div className={`${styles.bg} ${transitioning ? styles.bgFade : ''}`}>
        {banner && (
          <Image
            src={banner}
            alt={title}
            fill
            priority
            className={styles.bgImg}
            sizes="100vw"
          />
        )}
        <div className={styles.bgOverlay} />
        <div className={styles.bgGradient} />
      </div>

      {/* Content */}
      <div className={`container ${styles.content}`}>
        <div className={`${styles.textBlock} ${transitioning ? styles.textFade : ''}`}>
          {/* Genres & Type */}
          <div className={styles.genreRow}>
            <span className="badge badge-teal" style={{ background: 'var(--grad-hero)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
              {typeLabel}
            </span>
            {genres.map(g => (
              <span key={g} className="badge badge-teal">{g}</span>
            ))}
          </div>

          <h1 className={styles.title}>{title}</h1>

          {score && (
            <div className={styles.scoreLine}>
              <span className={styles.star}>⭐</span>
              <span className={styles.score}>{score}</span>
              <span className={styles.scoreLabel}> / 10</span>
            </div>
          )}

          <p className={styles.desc}>{desc}</p>

          <div className={styles.actions}>
            {isManga ? (
              <>
                <Link href={`/manga/${item.id}`} className="btn btn-primary" id={`hero-read-${item.id}`}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                  Read Now
                </Link>
                <Link href={`/manga/${item.id}`} className="btn btn-secondary" id={`hero-details-${item.id}`}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/>
                  </svg>
                  Details
                </Link>
              </>
            ) : (
              <>
                {malId && (
                  <Link href={`/anime/${malId}`} className="btn btn-primary" id={`hero-watch-${malId}`}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Watch Now
                  </Link>
                )}
                {malId && (
                  <Link href={`/anime/${malId}`} className="btn btn-secondary" id={`hero-details-${malId}`}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/>
                    </svg>
                    Details
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* Cover art */}
        {cover && (
          <div className={`${styles.coverWrap} hide-mobile`}>
            <div className={styles.cover}>
              <Image src={cover} alt={title} fill className={styles.coverImg} sizes="260px" />
              <div className={styles.coverGlow} />
            </div>
          </div>
        )}
      </div>

      {/* Slide indicators */}
      {validAnime.length > 1 && (
        <div className={styles.indicators}>
          {validAnime.map((_, i) => (
            <button
              key={i}
              id={`hero-dot-${i}`}
              className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
