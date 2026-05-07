'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AnimeSection from '@/components/AnimeSection/AnimeSection';
import styles from './MangaDetail.module.css';

export default function MangaDetailClient({ manga, chapters, mangaDexId, isFallback = false }) {
  const [tab, setTab] = useState('chapters');
  const [imgError, setImgError] = useState(false);

  const banner = manga.bannerImage;
  const cover = manga.coverImage?.extraLarge || manga.coverImage?.large || '';
  const title = manga.title.english || manga.title.romaji || '';
  const synopsis = manga.description?.replace(/<[^>]*>/g, '') || '';
  const score = manga.averageScore ? (manga.averageScore / 10).toFixed(1) : null;
  const status = manga.status || '';
  const format = manga.format || '';
  const country = manga.countryOfOrigin;
  const displayType = country === 'KR' ? 'Manhwa' : country === 'CN' ? 'Manhua' : 'Manga';
  
  const chapters_n = manga.chapters || '';
  const genres = manga.genres || [];
  const tags = manga.tags?.slice(0, 8) || [];

  const tabs = ['chapters', 'characters', 'info'];

  return (
    <div className={styles.page}>
      {/* Banner */}
      <div className={styles.bannerWrap}>
        {banner ? (
          <Image src={banner} alt={title} fill className={styles.bannerImg} priority sizes="100vw" />
        ) : cover ? (
          <Image src={cover} alt={title} fill className={styles.bannerFallback} priority sizes="100vw" />
        ) : (
          <div className={styles.bannerGradient} />
        )}
        <div className={styles.bannerOverlay} />
      </div>

      <div className={`container ${styles.layout}`}>
        {/* Left sidebar */}
        <aside className={styles.sidebar}>
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
              <div className={styles.coverFallback}>
                <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" opacity="0.3">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              </div>
            )}
          </div>

          <div className={styles.sidebarInfo}>
            {chapters.length > 0 && (
              <Link
                href={`/manga/read/${manga.id}/${chapters[chapters.length - 1].id}${chapters[chapters.length - 1].isFallback ? '?source=fallback' : ''}`}
                className={`btn btn-primary ${styles.readBtn}`}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{ marginRight: '4px' }}>
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                Read Chap 1
              </Link>
            )}

            <div className={styles.stats}>
              {score && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Score</span>
                  <span className={styles.statValue} style={{color:'#f5a623'}}>⭐ {score}</span>
                </div>
              )}
              {status && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Status</span>
                  <span className={styles.statValue}>{status.replace(/_/g, ' ')}</span>
                </div>
              )}
            </div>

            <ul className={styles.infoList}>
              {displayType && <InfoRow label="Type" value={displayType} />}
              {chapters_n && <InfoRow label="Chapters" value={chapters_n} />}
            </ul>
          </div>
        </aside>

        {/* Main content */}
        <main className={styles.main}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{title}</h1>
            {manga.title.native && (
              <p className={styles.titleJp}>{manga.title.native}</p>
            )}
            <div className={styles.genreRow}>
              {genres.map(g => (
                <Link key={g} href={`/search?type=manga&genre=${encodeURIComponent(g)}`} className="genre-pill">{g}</Link>
              ))}
            </div>
          </div>

          <div className={styles.synopsis}>
            <h2 className={styles.sectionHead}>Synopsis</h2>
            <p>{synopsis || 'No synopsis available.'}</p>
          </div>

          <div className={styles.tabs}>
            {tabs.map(t => (
              <button
                key={t}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab: Chapters */}
          {tab === 'chapters' && (
            <div className={styles.chapterList}>
              {isFallback && (
                <div className={styles.fallbackNotice}>
                  <span className={styles.fallbackBadge}>Fallback Mode</span>
                  <p>Chapters are being served from an alternative source (MangaHook).</p>
                </div>
              )}
              {!mangaDexId ? (
                <p className={styles.empty}>Manga not found on MangaDex. Reading may be unavailable.</p>
              ) : chapters.length === 0 ? (
                <p className={styles.empty}>No chapters found for this title.</p>
              ) : (
                <div className={styles.chapterGrid}>
                  {chapters.map(ch => (
                    <Link
                      key={ch.id}
                      href={`/manga/read/${manga.id}/${ch.id}${ch.isFallback ? '?source=fallback' : ''}`}
                      className={styles.chCard}
                    >
                      <div className={styles.chMain}>
                        <span className={styles.chNum}>Chapter {ch.attributes.chapter}</span>
                        <span className={styles.chTitle}>{ch.attributes.title || 'Untitled'}</span>
                      </div>
                      <div className={styles.chMeta}>
                        <span className={styles.chLang}>{ch.attributes.translatedLanguage}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Characters */}
          {tab === 'characters' && (
            <div className={styles.charGrid}>
              {manga.characters?.nodes?.length === 0 ? (
                <p className={styles.empty}>No character data.</p>
              ) : (
                manga.characters?.nodes?.map(c => (
                  <div key={c.id} className={styles.charCard}>
                    <div className={styles.charImg}>
                      {c.image?.large && <Image src={c.image.large} alt={c.name.full} fill sizes="80px" className={styles.charPhoto} />}
                    </div>
                    <div className={styles.charInfo}>
                      <span className={styles.charName}>{c.name.full}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab: Info */}
          {tab === 'info' && (
            <div className={styles.infoTab}>
              <div className={styles.tagsSection}>
                <h3 className={styles.subHead}>Tags</h3>
                <div className={styles.tagCloud}>
                  {tags.map(t => (
                    <span key={t.name} className={styles.tagPill}>{t.name}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {manga.recommendations?.nodes?.length > 0 && (
            <div className={styles.recsSection}>
              <AnimeSection 
                title="You Might Also Like" 
                anime={manga.recommendations.nodes.map(n => n.mediaRecommendation)}
                isManga={true}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <li className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoVal}>{value}</span>
    </li>
  );
}
