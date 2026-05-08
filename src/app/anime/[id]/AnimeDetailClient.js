'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AnimeCard from '@/components/AnimeCard/AnimeCard';
import AnimeSection from '@/components/AnimeSection/AnimeSection';
import styles from './AnimeDetail.module.css';

export default function AnimeDetailClient({
  anime, episodes, pagination, characters, streaming, extra, recommendations,
}) {
  const [tab, setTab]           = useState('episodes');
  const [imgError, setImgError] = useState(false);
  const [allEpisodes, setAllEpisodes] = useState(episodes);
  const [loadingEps, setLoadingEps]   = useState(false);

  // Re-sync episodes if props change (e.g. navigation)
  useEffect(() => {
    setAllEpisodes(episodes);
  }, [episodes]);

  // Fetch additional episodes if paginated
  useEffect(() => {
    async function fetchMore() {
      if (!pagination?.has_next_page) return;
      
      setLoadingEps(true);
      let currentEpisodes = [...episodes];
      const totalPages = pagination.last_visible_page;
      const malId = anime.mal_id;
      
      for (let p = 2; p <= Math.min(totalPages, 15); p++) { // Cap at 1500 episodes for safety
        try {
          const res = await fetch(`/api/proxy?path=/anime/${malId}/episodes?page=${p}`);
          const data = await res.json();
          if (data?.data) {
            currentEpisodes = [...currentEpisodes, ...data.data];
            setAllEpisodes([...currentEpisodes]); // Update UI incrementally
          }
          if (!data?.pagination?.has_next_page) break;
          // Respect Jikan rate limits
          await new Promise(r => setTimeout(r, 450));
        } catch (e) {
          console.error('Failed to fetch more episodes:', e);
          break; 
        }
      }
      setLoadingEps(false);
    }
    
    fetchMore();
  }, [anime.mal_id, pagination, episodes]);

  const banner     = extra?.bannerImage || null;
  const cover      = anime.images?.jpg?.large_image_url || extra?.coverImage?.large || '';
  const title      = anime.title_english || anime.title || '';
  const synopsis   = anime.synopsis || extra?.description?.replace(/<[^>]*>/g,'') || '';
  const score      = anime.score;
  const rank       = anime.rank;
  const popularity = anime.popularity;
  const genres     = anime.genres?.map(g => g.name) || extra?.genres || [];
  const studios    = anime.studios?.map(s => s.name) || extra?.studios?.nodes?.map(s=>s.name) || [];
  const status     = anime.status || '';
  const type       = anime.type || '';
  const episodes_n = anime.episodes || '';
  const aired      = anime.aired?.string || '';
  const rating     = anime.rating || '';
  const duration   = anime.duration || '';
  const malId      = anime.mal_id;

  const tabs = ['episodes', 'characters', 'info'];

  return (
    <div className={styles.page}>
      {/* Banner */}
      <div className={styles.bannerWrap}>
        {banner ? (
          <Image src={banner} alt={title} fill className={styles.bannerImg} priority sizes="100vw" />
        ) : cover ? (
          /* Fallback: use cover art as a blurred banner */
          <Image src={cover} alt={title} fill className={styles.bannerFallback} priority sizes="100vw" />
        ) : (
          <div className={styles.bannerGradient} />
        )}
        <div className={styles.bannerOverlay} />
      </div>

      <div className={`container ${styles.layout}`}>
        {/* Left sidebar */}
        <aside className={styles.sidebar}>
          {/* Cover */}
          <div className={styles.coverWrap}>
            {!imgError && cover ? (
              <Image
                src={cover}
                alt={title}
                fill
                className={styles.coverImg}
                onError={() => setImgError(true)}
                sizes="220px"
                priority
              />
            ) : (
              <div className={styles.coverFallback}><span>▶</span></div>
            )}
          </div>

          {/* Info group — on mobile this sits beside the cover in a flex row */}
          <div className={styles.sidebarInfo}>
            {/* Quick watch */}
            {episodes.length > 0 && (
              <Link
                href={`/watch/${malId}/1`}
                className={`btn btn-primary ${styles.watchBtn}`}
                id="detail-watch-ep1"
              >
                <span>▶</span> Watch Ep 1
              </Link>
            )}

            {/* Stats */}
            <div className={styles.stats}>
              {score && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Score</span>
                  <span className={styles.statValue} style={{color:'#f5a623'}}>⭐ {score}</span>
                </div>
              )}
              {rank && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Rank</span>
                  <span className={styles.statValue}>#{rank}</span>
                </div>
              )}
              {popularity && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Popularity</span>
                  <span className={styles.statValue}>#{popularity}</span>
                </div>
              )}
            </div>

            {/* Info list */}
            <ul className={styles.infoList}>
              {type     && <InfoRow label="Type"     value={type} />}
              {episodes_n && <InfoRow label="Episodes" value={episodes_n} />}
              {status   && <InfoRow label="Status"   value={status} color={
                status.includes('Airing') ? 'var(--teal-glow)' : undefined
              } />}
              {aired    && <InfoRow label="Aired"    value={aired} />}
              {duration && <InfoRow label="Duration" value={duration} />}
              {rating   && <InfoRow label="Rating"   value={rating} />}
              {studios.length > 0 && <InfoRow label="Studios" value={studios.join(', ')} />}
            </ul>

            {/* Official streaming links */}
            {streaming.length > 0 && (
              <div className={styles.officialStream}>
                <p className={styles.officialLabel}>Official Streaming</p>
                {streaming.map(s => (
                  <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className={styles.officialLink}>
                    {s.name} ↗
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className={styles.main}>
          {/* Title & genres */}
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{title}</h1>
            {anime.title_japanese && (
              <p className={styles.titleJp}>{anime.title_japanese}</p>
            )}
            <div className={styles.genreRow}>
              {genres.map(g => (
                <Link key={g} href={`/search?genre=${encodeURIComponent(g)}`} className="genre-pill">{g}</Link>
              ))}
            </div>
          </div>

          {/* Synopsis */}
          <div className={styles.synopsis}>
            <h2 className={styles.sectionHead}>Synopsis</h2>
            <p>{synopsis || 'No synopsis available.'}</p>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            {tabs.map(t => (
              <button
                key={t}
                id={`tab-${t}`}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab: Episodes */}
          {tab === 'episodes' && (
            <div className={styles.episodeGrid}>
              {allEpisodes.length === 0 ? (
                <p className={styles.empty}>No episode data available.</p>
              ) : (
                <>
                  {allEpisodes.map(ep => (
                    <Link
                      key={ep.mal_id}
                      href={`/watch/${malId}/${ep.mal_id}`}
                      className={styles.epCard}
                      id={`ep-card-${ep.mal_id}`}
                    >
                      <span className={styles.epNum}>EP {ep.mal_id}</span>
                      <span className={styles.epTitle}>{ep.title || `Episode ${ep.mal_id}`}</span>
                      {ep.score && <span className={styles.epScore}>⭐ {ep.score}</span>}
                    </Link>
                  ))}
                  {loadingEps && (
                    <div className={styles.loadingInfo}>
                      <span className={styles.loaderSmall}></span>
                      Loading more episodes...
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab: Characters */}
          {tab === 'characters' && (
            <div className={styles.charGrid}>
              {characters.length === 0 ? (
                <p className={styles.empty}>No character data.</p>
              ) : (
                characters.map(c => (
                  <CharCard key={c.character.mal_id} data={c} />
                ))
              )}
            </div>
          )}

          {/* Tab: Info */}
          {tab === 'info' && (
            <div className={styles.infoTab}>
              <InfoBlock label="Japanese Title"   value={anime.title_japanese} />
              <InfoBlock label="Synonyms"         value={anime.title_synonyms?.join(', ')} />
              <InfoBlock label="Source"           value={anime.source} />
              <InfoBlock label="Producers"        value={anime.producers?.map(p=>p.name).join(', ')} />
              <InfoBlock label="Licensors"        value={anime.licensors?.map(l=>l.name).join(', ')} />
              <InfoBlock label="Demographics"     value={anime.demographics?.map(d=>d.name).join(', ')} />
              <InfoBlock label="Themes"           value={anime.themes?.map(t=>t.name).join(', ')} />
              <InfoBlock label="Explicit Genres"  value={anime.explicit_genres?.map(g=>g.name).join(', ')} />
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className={styles.recsSection}>
              <AnimeSection 
                title="You Might Also Like" 
                anime={recommendations} 
                hideYear={true}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function InfoRow({ label, value, color }) {
  if (!value) return null;
  return (
    <li className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoVal} style={color ? { color } : {}}>{value}</span>
    </li>
  );
}

function InfoBlock({ label, value }) {
  if (!value) return null;
  return (
    <div className={styles.infoBlock}>
      <span className={styles.infoBlockLabel}>{label}</span>
      <span className={styles.infoBlockVal}>{value}</span>
    </div>
  );
}

function CharCard({ data }) {
  const char  = data.character;
  const voice = data.voice_actors?.find(v => v.language === 'Japanese');
  const img   = char.images?.jpg?.image_url;
  const role  = data.role;
  return (
    <div className={styles.charCard}>
      <div className={styles.charImg}>
        {img && <Image src={img} alt={char.name} fill sizes="80px" className={styles.charPhoto} />}
      </div>
      <div className={styles.charInfo}>
        <span className={styles.charName}>{char.name}</span>
        <span className={`badge ${role === 'Main' ? 'badge-teal' : 'badge-purple'}`}>{role}</span>
        {voice && <span className={styles.charVA}>{voice.person.name}</span>}
      </div>
    </div>
  );
}
