'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './AnimeCard.module.css';

export default function AnimeCard({ anime, priority = false }) {
  const [imgError, setImgError] = useState(false);

  const id      = anime.mal_id || anime.idMal || anime.id;
  const title   = anime.title_english || anime.title || anime.name || 'Unknown';
  const cover   = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.coverImage?.large || anime.coverImage?.medium || '';
  const score   = anime.score || (anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null);
  const type    = anime.type || anime.format || '';
  const eps     = anime.episodes || anime.episodes?.nodes?.length || '';
  const status  = anime.status || '';
  const year    = anime.year || anime.aired?.prop?.from?.year || '';

  const statusColor =
    status?.toLowerCase().includes('airing') ? 'var(--color-ongoing)' :
    status?.toLowerCase().includes('upcoming') ? 'var(--color-upcoming)' :
    'var(--color-finished)';

  return (
    <Link href={`/anime/${id}`} className={styles.card} id={`anime-card-${id}`}>
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
          <button className={styles.playBtn} aria-label="Watch now">
            <span className={styles.playIcon}>▶</span>
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
      </div>

      <div className={styles.info}>
        <h3 className={styles.title} title={title}>{title}</h3>
        <div className={styles.meta}>
          {type && <span className={styles.metaTag}>{type}</span>}
          {eps  && <span className={styles.metaTag}>{eps} eps</span>}
          {year && <span className={styles.metaTag}>{year}</span>}
        </div>
      </div>
    </Link>
  );
}
