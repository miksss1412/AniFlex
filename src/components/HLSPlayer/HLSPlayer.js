'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './HLSPlayer.module.css';

export default function HLSPlayer({ src, onEnded, poster }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!src || !videoRef.current) return undefined;
    let cancelled = false;
    let nativeLoadedHandler = null;
    setLoading(true);
    setError(null);

    const video = videoRef.current;

    const loadStream = async () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      try {
        const Hls = (await import('hls.js')).default;

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
          });

          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            setLoading(false);
            video.play().catch(() => {});
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (!cancelled && data.fatal) {
              setError('Stream error. The source may be blocked by CORS. Try refreshing.');
              setLoading(false);
            }
          });

          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src;
          nativeLoadedHandler = () => {
            if (cancelled) return;
            setLoading(false);
            video.play().catch(() => {});
          };
          video.addEventListener('loadedmetadata', nativeLoadedHandler);
        } else {
          setError('HLS playback is not supported in your browser.');
          setLoading(false);
        }
      } catch (e) {
        setError(`Failed to initialize player: ${e.message}`);
        setLoading(false);
      }
    };

    loadStream();

    return () => {
      cancelled = true;
      if (nativeLoadedHandler) {
        video.removeEventListener('loadedmetadata', nativeLoadedHandler);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  return (
    <div className={styles.playerContainer}>
      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <span>Loading stream...</span>
        </div>
      )}

      {error && (
        <div className={styles.errorOverlay}>
          <div className={styles.errorIcon}>!</div>
          <p>{error}</p>
        </div>
      )}

      <video
        ref={videoRef}
        className={styles.video}
        controls
        playsInline
        poster={poster}
        onEnded={onEnded}
        crossOrigin="anonymous"
      />
    </div>
  );
}
