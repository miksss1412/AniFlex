'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar/Navbar';
import HLSPlayer from '@/components/HLSPlayer/HLSPlayer';
import styles from './Watch.module.css';

export default function WatchPageClient({ animeId, anilistId, episode, anime, episodes }) {
  const epNum = parseInt(episode);
  const episodeList = episodes || [];
  const total = anime?.episodes || episodeList.length || 0;
  const title = anime?.title_english || anime?.title || `Anime ${animeId}`;
  const cover = anime?.images?.jpg?.large_image_url || '';

  const [streamData, setStreamData] = useState(null);
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamError, setStreamError] = useState(null);
  const [qualityIdx, setQualityIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  const prevEp = epNum > 1 ? epNum - 1 : null;
  const nextEp = total && epNum < total ? epNum + 1 : null;

  const currentEp = episodeList.find((ep) => Number(ep.mal_id) === epNum);
  const epTitle = currentEp?.title || `Episode ${epNum}`;
  const currentStream = streamData?.streams?.[qualityIdx];
  const currentProvider = currentStream?.provider || streamData?.provider || 'Source';

  const fetchStream = useCallback(async () => {
    setStreamLoading(true);
    setStreamError(null);
    setStreamData(null);
    setQualityIdx(0);

    try {
      const params = new URLSearchParams({ title, episode: epNum.toString() });
      if (anilistId) params.set('anilistId', anilistId.toString());

      const providers = [
        ...(process.env.NEXT_PUBLIC_ENABLE_HIANIME_SCRAPER === 'true'
          ? [{ name: 'HiAnime', url: `/api/anime/stream/hianime?${params}` }]
          : []),
        ...(anilistId ? [{ name: 'Miruro', url: `/api/anime/stream/miruro?${params}` }] : []),
        { name: 'AnimePahe', url: `/api/anime/stream/animepahe?${params}` },
      ];
      const errors = [];

      for (const provider of providers) {
        try {
          const { res, data } = await fetchProviderJson(provider.url);

          if (res.ok && data.streams?.length) {
            const providerName = data.provider || provider.name;
            setStreamData({
              ...data,
              provider: providerName,
              streams: data.streams.map((stream) => ({
                ...stream,
                provider: stream.provider || providerName,
              })),
            });
            return;
          }

          errors.push(`${provider.name}: ${data.error || res.statusText || 'no stream'}`);
        } catch (error) {
          errors.push(`${provider.name}: ${error.message || 'failed to fetch'}`);
        }
      }

      setStreamError(
        errors.length
          ? `No streams available from the configured providers. ${errors.join(' | ')}`
          : 'No streams available from the configured providers.'
      );
    } catch (e) {
      setStreamError('Failed to fetch stream. Check your connection.');
    } finally {
      setStreamLoading(false);
    }
  }, [title, epNum, anilistId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchStream();
  }, [fetchStream]);

  const handleExpand = () => {
    const el = document.getElementById('player-shell');
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <div className={`container ${styles.layout}`}>
          <section className={styles.playerColumn}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link href="/" className={styles.crumb}>Anime</Link>
              <span className={styles.sep}>/</span>
              <Link href={`/anime/${animeId}`} className={styles.crumb}>{title}</Link>
              <span className={styles.sep}>/</span>
              <span className={styles.crumbCurrent}>Episode {epNum}</span>
            </nav>

            <header className={styles.watchHeader}>
              <div className={styles.titleBlock}>
                <span className={styles.kicker}>Now Watching</span>
                <h1 className={styles.watchTitle}>{title}</h1>
                <div className={styles.watchMeta}>
                  <span>Episode {epNum}</span>
                  <span>{epTitle}</span>
                  <span>
                    {currentStream
                      ? `${currentProvider} / ${currentStream.quality}${currentStream.isDub ? ' Dub' : ' Sub'}`
                      : 'Finding source'}
                  </span>
                </div>
              </div>

              <div className={styles.headerActions}>
                {prevEp && (
                  <Link href={`/watch/${animeId}/${prevEp}`} className={styles.episodeNavBtn}>
                    Prev
                  </Link>
                )}
                {nextEp && (
                  <Link
                    href={`/watch/${animeId}/${nextEp}`}
                    className={`${styles.episodeNavBtn} ${styles.episodeNavBtnPrimary}`}
                  >
                    Next
                  </Link>
                )}
              </div>
            </header>

            <div id="player-shell" className={styles.playerShell}>
              <div className={styles.topBar}>
                <div className={styles.topBarLeft}>
                  <button className={styles.tbBtn} onClick={handleExpand} type="button">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                    Expand
                  </button>
                  <button
                    className={`${styles.tbBtn} ${autoPlay ? styles.tbBtnOn : ''}`}
                    onClick={() => setAutoPlay((value) => !value)}
                    type="button"
                  >
                    Autoplay <span className={styles.tbToggle}>{autoPlay ? 'On' : 'Off'}</span>
                  </button>
                  <button className={styles.tbBtn} onClick={fetchStream} title="Reload stream" type="button">
                    Reload
                  </button>
                </div>

                <div className={styles.topBarRight}>
                  {prevEp && (
                    <Link href={`/watch/${animeId}/${prevEp}`} className={styles.tbNavBtn}>Prev</Link>
                  )}
                  {nextEp && (
                    <Link href={`/watch/${animeId}/${nextEp}`} className={`${styles.tbNavBtn} ${styles.tbNavBtnNext}`}>
                      Next
                    </Link>
                  )}
                </div>
              </div>

              <div className={styles.playerWrap}>
                {streamLoading && (
                  <div className={styles.streamStatus}>
                    <div className={styles.loadingSpinner} />
                    <p>Finding stream...</p>
                    <span className={styles.statusHint}>Trying configured providers</span>
                  </div>
                )}

                {!streamLoading && streamError && (
                  <div className={styles.streamStatus}>
                    <div className={styles.errorIcon}>!</div>
                    <p className={styles.errorMsg}>{streamError}</p>
                    <button className={styles.retryBtn} onClick={fetchStream} type="button">Retry</button>
                  </div>
                )}

                {!streamLoading && currentStream?.type === 'iframe' && (
                  <iframe
                    src={currentStream.url}
                    className={styles.iframe}
                    allowFullScreen
                    allow="autoplay; encrypted-media; picture-in-picture"
                    title={`${title} - Episode ${epNum}`}
                  />
                )}

                {!streamLoading && currentStream && currentStream.type !== 'iframe' && (
                  <HLSPlayer
                    src={currentStream.url}
                    poster={cover}
                    onEnded={() => {
                      if (autoPlay && nextEp) {
                        window.location.href = `/watch/${animeId}/${nextEp}`;
                      }
                    }}
                  />
                )}
              </div>

              <div className={styles.bottomBar}>
                <div className={styles.nowWatching}>
                  <span className={styles.nowLabel}>Now Watching</span>
                  <span className={styles.nowEp}>Episode {epNum} - {epTitle}</span>
                  <span className={styles.nowHint}>
                    {currentStream
                      ? `${currentProvider} / ${currentStream.quality}${currentStream.isDub ? ' / DUB' : ' / SUB'}`
                      : 'Searching for stream...'}
                  </span>
                </div>

                {streamData?.streams?.length > 1 && (
                  <div className={styles.serverPanel}>
                    <span className={styles.serverPanelLabel}>Quality</span>
                    <div className={styles.serverBtns}>
                      {streamData.streams.map((stream, index) => (
                        <button
                          key={`${stream.quality}-${index}`}
                          className={`${styles.serverBtn} ${qualityIdx === index ? styles.serverActive : ''}`}
                          onClick={() => setQualityIdx(index)}
                          type="button"
                        >
                          {stream.provider || streamData.provider} {stream.quality}{stream.isDub ? ' Dub' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className={styles.epListSidebar}>
            <div className={styles.epListHeader}>
              <div>
                <span className={styles.kicker}>Season</span>
                <h2 className={styles.epListTitle}>Episodes</h2>
              </div>
              <span className={styles.epCount}>{episodeList.length || total || 0}</span>
            </div>

            <div className={styles.epList}>
              {episodeList.length === 0 ? (
                <p className={styles.empty}>No episode list available.</p>
              ) : (
                episodeList.map((ep) => (
                  <Link
                    key={ep.mal_id}
                    href={`/watch/${animeId}/${ep.mal_id}`}
                    id={`ep-list-${ep.mal_id}`}
                    className={`${styles.epItem} ${Number(ep.mal_id) === epNum ? styles.epItemActive : ''}`}
                  >
                    <span className={styles.epItemNum}>EP {ep.mal_id}</span>
                    <span className={styles.epItemTitle}>{ep.title || `Episode ${ep.mal_id}`}</span>
                  </Link>
                ))
              )}
            </div>

            <Link href={`/anime/${animeId}`} className={`btn btn-secondary ${styles.backBtn}`} id="back-to-details">
              Back to Details
            </Link>
          </aside>
        </div>
      </main>
    </>
  );
}

async function fetchProviderJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('timed out');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
