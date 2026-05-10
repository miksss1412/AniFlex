import styles from './RouteSkeleton.module.css';

function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

function CardSkeleton() {
  return (
    <div className={styles.card}>
      <Skeleton className={styles.cardPoster} />
      <Skeleton className={styles.cardTitle} />
      <Skeleton className={styles.cardSub} />
    </div>
  );
}

function CardRows({ sections = 3, cards = 6 }) {
  return (
    <div className={`container ${styles.sections}`}>
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <section className={styles.section} key={sectionIndex}>
          <div className={styles.sectionHeader}>
            <Skeleton className={styles.sectionTitle} />
            <Skeleton className={styles.sectionAction} />
          </div>
          <div className={styles.cardRow}>
            {Array.from({ length: cards }).map((__, cardIndex) => (
              <CardSkeleton key={cardIndex} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function HomeSkeletonPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <div className={styles.pillRow}>
              <Skeleton className={styles.pill} />
              <Skeleton className={styles.pill} />
              <Skeleton className={styles.pill} />
            </div>
            <Skeleton className={styles.titleLine} />
            <Skeleton className={`${styles.textLine} ${styles.longLine}`} />
            <Skeleton className={`${styles.textLine} ${styles.mediumLine}`} />
            <Skeleton className={styles.buttonLine} />
          </div>
          <Skeleton className={styles.poster} />
        </div>
      </section>
      <CardRows sections={4} />
    </main>
  );
}

export function DetailSkeletonPage() {
  return (
    <main className={styles.page}>
      <div className={styles.detailBanner} />
      <div className={`container ${styles.detailLayout}`}>
        <aside className={styles.sidebar}>
          <Skeleton className={styles.poster} />
          <Skeleton className={styles.buttonLine} />
          <Skeleton className={styles.panel} />
          <Skeleton className={styles.panel} />
        </aside>
        <section className={styles.detailMain}>
          <Skeleton className={styles.titleLine} />
          <div className={styles.genreRow}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton className={styles.pill} key={index} />
            ))}
          </div>
          <div className={styles.lineStack}>
            <Skeleton className={`${styles.textLine} ${styles.longLine}`} />
            <Skeleton className={`${styles.textLine} ${styles.longLine}`} />
            <Skeleton className={`${styles.textLine} ${styles.mediumLine}`} />
          </div>
          <div className={styles.tabs}>
            <Skeleton className={styles.tab} />
            <Skeleton className={styles.tab} />
            <Skeleton className={styles.tab} />
          </div>
          <div className={styles.episodeGrid}>
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton className={styles.episode} key={index} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export function WatchSkeletonPage() {
  return (
    <main className={styles.watchPage}>
      <div className={`container ${styles.watchLayout}`}>
        <section className={styles.watchColumn}>
          <div className={styles.pillRow}>
            <Skeleton className={styles.pill} />
            <Skeleton className={styles.pill} />
          </div>
          <Skeleton className={styles.watchTitle} />
          <div className={styles.playerShell}>
            <div className={styles.playerTop} />
            <Skeleton className={styles.playerSurface} />
            <div className={styles.playerBottom} />
          </div>
        </section>
        <aside className={styles.watchSidebar}>
          <Skeleton className={styles.sectionTitle} />
          <div className={styles.episodeList}>
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton className={styles.episodeItem} key={index} />
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

export function SearchSkeletonPage() {
  return (
    <main className={`${styles.page} ${styles.pagePadded}`}>
      <div className={`container ${styles.searchHeader}`}>
        <Skeleton className={styles.titleLine} />
        <div className={styles.filterRow}>
          <Skeleton className={styles.filter} />
          <Skeleton className={styles.filter} />
          <Skeleton className={styles.filter} />
        </div>
        <div className={styles.genreRow}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton className={styles.pill} key={index} />
          ))}
        </div>
        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    </main>
  );
}

export function ReaderSkeletonPage() {
  return (
    <main className={styles.readerPage}>
      <nav className={styles.readerNav}>
        <Skeleton className={styles.readerButton} />
        <Skeleton className={styles.readerTitle} />
        <Skeleton className={styles.readerButton} />
      </nav>
      <div className={styles.readerPages}>
        <Skeleton className={styles.readerPageBlock} />
      </div>
    </main>
  );
}
