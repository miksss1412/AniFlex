'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const [selectedProvider, setSelectedProvider] = useState('miruro');
  const fetchRunRef = useRef(0);

  const prevEp = epNum > 1 ? epNum - 1 : null;
  const nextEp = total && epNum < total ? epNum + 1 : null;

  const currentEp = episodeList.find((ep) => Number(ep.mal_id) === epNum);
  const epTitle = currentEp?.title || `Episode ${epNum}`;
  const currentStream = streamData?.streams?.[qualityIdx];
  const currentProvider = currentStream?.provider || streamData?.provider || 'Source';
  const streamProviders = useMemo(
    () => buildStreamProviders({ title, epNum, anilistId }),
    [title, epNum, anilistId]
  );
  const activeProvider = streamProviders.find((provider) => provider.id === selectedProvider) || streamProviders[0];

  useEffect(() => {
    if (!streamProviders.some((provider) => provider.id === selectedProvider)) {
      setSelectedProvider(streamProviders[0]?.id || 'miruro');
    }
  }, [streamProviders, selectedProvider]);

  const fetchStream = useCallback(async () => {
    if (!activeProvider) return;

    const runId = fetchRunRef.current + 1;
    fetchRunRef.current = runId;

    setStreamLoading(true);
    setStreamError(null);
    setStreamData(null);
    setQualityIdx(0);

    try {
      const { res, data } = await fetchProviderJson(activeProvider.url);
      if (fetchRunRef.current !== runId) return;

      if (res.ok && data.streams?.length) {
        const providerName = data.provider || activeProvider.name;
        setStreamData({
          ...data,
          provider: providerName,
          streams: data.streams.map((stream) => ({
            ...stream,
            provider: stream.provider || providerName,
          })),
        });
        const preferredIndex = data.streams.findIndex((stream) => stream.type === 'iframe');
        setQualityIdx(preferredIndex === -1 ? 0 : preferredIndex);
        return;
      }

      setStreamError('This server is unavailable for this episode. Try another server or reload.');
    } catch (error) {
      if (fetchRunRef.current !== runId) return;
      setStreamError('Unable to load the selected server right now. Try again in a moment.');
    } finally {
      if (fetchRunRef.current === runId) {
        setStreamLoading(false);
      }
    }
  }, [activeProvider]);

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
                <PlayerSurface
                  key={`${selectedProvider}-${currentStream?.url || streamError || 'loading'}`}
                  loading={streamLoading}
                  error={streamError}
                  stream={currentStream}
                  title={title}
                  episode={epNum}
                  cover={cover}
                  onEnded={() => {
                    if (autoPlay && nextEp) {
                      window.location.href = `/watch/${animeId}/${nextEp}`;
                    }
                  }}
                />
              </div>

              <div className={styles.bottomBar}>
                <div className={styles.serverPanel}>
                  <span className={styles.serverPanelLabel}>Server</span>
                  <div className={styles.serverBtns}>
                    {streamProviders.map((provider) => (
                      <button
                        key={provider.id}
                        className={`${styles.serverBtn} ${selectedProvider === provider.id ? styles.serverActive : ''}`}
                        onClick={() => setSelectedProvider(provider.id)}
                        type="button"
                      >
                        {provider.name}
                      </button>
                    ))}
                  </div>
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
                          {stream.quality}{stream.isDub ? ' Dub' : ''}
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
          </aside>
        </div>
      </main>
    </>
  );
}

function PlayerSurface({
  loading,
  error,
  stream,
  title,
  episode,
  cover,
  onEnded,
}) {
  if (loading) {
    return (
      <div className={styles.streamStatus}>
        <div className={styles.loadingSpinner} />
        <p>Loading stream...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.streamStatus}>
        <div className={styles.errorIcon}>!</div>
        <h2 className={styles.errorTitle}>Stream unavailable</h2>
        <p className={styles.errorMsg}>{error}</p>
      </div>
    );
  }

  if (!stream) return null;

  if (stream.type === 'iframe') {
    return (
      <iframe
        src={stream.url}
        className={styles.iframe}
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture"
        title={`${title} - Episode ${episode}`}
      />
    );
  }

  return (
    <HLSPlayer
      src={stream.url}
      poster={cover}
      onEnded={onEnded}
    />
  );
}

function buildStreamProviders({ title, epNum, anilistId }) {
  const params = new URLSearchParams({ title, episode: epNum.toString() });
  if (anilistId) params.set('anilistId', anilistId.toString());

  return [
    ...(anilistId ? [{ id: 'miruro', name: 'Server 1', url: `/api/anime/stream/miruro?${params}` }] : []),
    { id: 'animepahe', name: anilistId ? 'Server 2' : 'Server 1', url: `/api/anime/stream/animepahe?${params}` },
    ...(process.env.NEXT_PUBLIC_ENABLE_HIANIME_SCRAPER === 'true'
      ? [{ id: 'hianime', name: anilistId ? 'Server 3' : 'Server 2', url: `/api/anime/stream/hianime?${params}` }]
      : []),
  ];
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
