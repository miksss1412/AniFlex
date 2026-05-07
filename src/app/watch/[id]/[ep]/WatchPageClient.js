'use client';
import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar/Navbar';
import { getStreamUrlFallbacks } from '@/lib/api';
import styles from './Watch.module.css';

export default function WatchPageClient({ animeId, anilistId, episode, anime, episodes }) {
  const epNum  = parseInt(episode);
  const total  = anime?.episodes || episodes?.length || 0;
  const title  = anime?.title_english || anime?.title || `Anime ${animeId}`;
  const covers  = anime?.images?.jpg?.large_image_url;
  const streams = getStreamUrlFallbacks(animeId, epNum, anilistId);
  console.log('[WatchPageClient] Stream URLs:', streams);
  const [streamIdx, setStreamIdx] = useState(0);
  const [loaded, setLoaded]       = useState(false);

  const prevEp = epNum > 1 ? epNum - 1 : null;
  const nextEp = total && epNum < total ? epNum + 1 : null;

  const currentEp = episodes?.find(e => e.mal_id === epNum);
  const epTitle   = currentEp?.title || `Episode ${epNum}`;

  return (
    <>
      <Navbar />
      <div className={styles.page}>
        <div className={`container ${styles.layout}`}>

          {/* Player column */}
          <div className={styles.playerColumn}>
            {/* Breadcrumb */}
            <nav className={styles.breadcrumb}>
              <Link href="/" className={styles.crumb}>Home</Link>
              <span className={styles.sep}>›</span>
              <Link href={`/anime/${animeId}`} className={styles.crumb}>{title}</Link>
              <span className={styles.sep}>›</span>
              <span className={styles.crumbCurrent}>Episode {epNum}</span>
            </nav>

            {/* Player */}
            <div className={styles.playerWrap}>
              {!loaded && (
                <div className={styles.playerLoading}>
                  <div className={styles.loadingSpinner} />
                  <p>Loading stream…</p>
                </div>
              )}
              <iframe
                key={streams[streamIdx]}
                src={streams[streamIdx]}
                className={`${styles.iframe} ${loaded ? styles.iframeVisible : ''}`}
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture"
                onLoad={() => setLoaded(true)}
                title={`${title} - Episode ${epNum}`}
                id="anime-player"
              />
              <div className={styles.playerActions}>
                <p className={styles.adblockWarning}>
                  ⚠️ <strong>Black Screen?</strong> Please disable your Adblocker or Browser Shields. Streaming servers often refuse to play if popups are blocked.
                </p>
                <div style={{display:'flex', gap:'10px'}}>
                  <button 
                    className={styles.refreshBtn} 
                    onClick={() => { setLoaded(false); const s = streams[streamIdx]; setStreamIdx(-1); setTimeout(()=>setStreamIdx(streams.indexOf(s)), 50); }}
                    title="Refresh Player"
                  >
                    🔄
                  </button>
                  <a 
                    href={streams[streamIdx]} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={styles.externalLink}
                    title="Open in New Tab"
                  >
                    ↗ Open in New Tab
                  </a>
                </div>
              </div>
            </div>

            {/* Server switcher */}
            <div className={styles.serverBar}>
              <span className={styles.serverLabel}>Servers:</span>
              {streams.map((_, i) => (
                <button
                  key={i}
                  id={`server-${i + 1}`}
                  className={`${styles.serverBtn} ${streamIdx === i ? styles.serverActive : ''}`}
                  onClick={() => { setStreamIdx(i); setLoaded(false); }}
                >
                  Server {i + 1}
                </button>
              ))}
            </div>

            {/* Ep navigation */}
            <div className={styles.epNav}>
              <div className={styles.epInfo}>
                <h1 className={styles.epTitle}>{title}</h1>
                <p className={styles.epSubtitle}>Episode {epNum} {currentEp?.title ? `— ${currentEp.title}` : ''}</p>
              </div>
              <div className={styles.epNavBtns}>
                {prevEp && (
                  <Link href={`/watch/${animeId}/${prevEp}`} className="btn btn-secondary" id="prev-episode">
                    ← Ep {prevEp}
                  </Link>
                )}
                {nextEp && (
                  <Link href={`/watch/${animeId}/${nextEp}`} className="btn btn-primary" id="next-episode">
                    Ep {nextEp} →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Episode list sidebar */}
          <aside className={styles.epListSidebar}>
            <h2 className={styles.epListTitle}>Episodes</h2>
            <div className={styles.epList}>
              {episodes.length === 0 ? (
                <p className={styles.empty}>No episode list available.</p>
              ) : (
                episodes.map(ep => (
                  <Link
                    key={ep.mal_id}
                    href={`/watch/${animeId}/${ep.mal_id}`}
                    id={`ep-list-${ep.mal_id}`}
                    className={`${styles.epItem} ${ep.mal_id === epNum ? styles.epItemActive : ''}`}
                  >
                    <span className={styles.epItemNum}>Ep {ep.mal_id}</span>
                    <span className={styles.epItemTitle}>{ep.title || `Episode ${ep.mal_id}`}</span>
                  </Link>
                ))
              )}
            </div>
            <Link href={`/anime/${animeId}`} className={`btn btn-secondary ${styles.backBtn}`} id="back-to-details">
              ← Back to Details
            </Link>
          </aside>

        </div>
      </div>
    </>
  );
}
