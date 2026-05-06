'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './HeroSection.module.css';

export default function HeroSection({ anime = [] }) {
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
          {/* Genres */}
          <div className={styles.genreRow}>
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
            {malId && (
              <Link href={`/anime/${malId}`} className="btn btn-primary" id={`hero-watch-${malId}`}>
                <span>▶</span> Watch Now
              </Link>
            )}
            {malId && (
              <Link href={`/anime/${malId}`} className="btn btn-secondary" id={`hero-details-${malId}`}>
                ℹ Details
              </Link>
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
