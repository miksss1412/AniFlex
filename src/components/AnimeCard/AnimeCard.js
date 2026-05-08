'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './AnimeCard.module.css';

export default function AnimeCard({ anime, priority = false, isManga = false, showYear = true }) {
  const [imgError, setImgError] = useState(false);

  const id      = anime.idMal || anime.mal_id || anime.id;
  const title   = anime.title?.english || anime.title?.romaji || anime.title_english || anime.title || anime.name || 'Unknown';
  const cover   = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
  const score   = (anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null) || anime.score;
  const type    = anime.format || anime.type || '';
  const eps     = anime.episodes || anime.episodes?.nodes?.length || anime.chapters || '';
  const status  = anime.status || '';
  const year    = anime.seasonYear || anime.year || anime.aired?.prop?.from?.year || '';

  const statusColor =
    status?.toLowerCase().includes('airing') || status?.toLowerCase().includes('releasing') ? 'var(--color-ongoing)' :
    status?.toLowerCase().includes('upcoming') || status?.toLowerCase().includes('not_yet_released') ? 'var(--color-upcoming)' :
    'var(--color-finished)';

  const displayType = isManga ? (
    anime.countryOfOrigin === 'KR' ? 'Manhwa' :
    anime.countryOfOrigin === 'CN' ? 'Manhua' :
    'Manga'
  ) : type;

  return (
    <Link href={isManga ? `/manga/${anime.id}` : `/anime/${id}`} className={styles.card} id={`anime-card-${id}`}>
      <div className={styles.poster}>
        {!imgError && cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            sizes="(max-width: 640px) 170px, 200px"
            className={styles.img}
            onError={() => setImgError(true)}
            priority={priority}
          />
        ) : (
          <div className={styles.fallback}>
            <span>▶</span>
          </div>
        )}

        {/* Overlay */}
        <div className={styles.overlay}>
          <button className={styles.playBtn} aria-label={isManga ? "Read now" : "Watch now"}>
            {isManga ? (
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M8 5v14l11-7z"></path>
              </svg>
            )}
          </button>
        </div>

        {/* Score badge */}
        {score && (
          <div className={styles.scoreBadge}>
            ⭐ {score}
          </div>
        )}

        {/* Status dot */}
        {status && (
          <div className={styles.statusDot} style={{ background: statusColor }} title={status} />
        )}

        {/* Tags inside poster */}
        <div className={styles.metaOverlay}>
          {displayType && <span className={styles.metaTag}>{displayType}</span>}
          {eps  && <span className={styles.metaTag}>{eps} {isManga ? 'CH' : 'EP'}</span>}
          {year && showYear && <span className={styles.metaTag}>{year}</span>}
        </div>
      </div>

      <div className={styles.info}>
        <h3 className={styles.title} title={title}>{title}</h3>
      </div>
    </Link>
  );
}
