'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './BroadcastSchedule.module.css';

const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const makeDays = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      key: dateKey(date),
      date,
      day: date.toLocaleDateString(undefined, { weekday: 'short' }),
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    };
  });
};

const getTitle = (anime) => (
  anime?.title?.english ||
  anime?.title?.romaji ||
  anime?.title_english ||
  anime?.title ||
  anime?.name ||
  'Unknown Title'
);

const getAnimeId = (anime) => anime?.idMal || anime?.mal_id || anime?.id;

const formatTime = (airingAt) => {
  if (!airingAt) return 'TBA';

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(airingAt * 1000));
};

export default function BroadcastSchedule({ schedules = [] }) {
  const days = useMemo(makeDays, []);
  const [activeDay, setActiveDay] = useState(days[0]?.key);

  const groupedSchedules = useMemo(() => {
    return schedules.reduce((groups, item) => {
      if (!item?.airingAt) return groups;

      const key = dateKey(new Date(item.airingAt * 1000));
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);

      return groups;
    }, {});
  }, [schedules]);

  const activeItems = (groupedSchedules[activeDay] || [])
    .slice()
    .sort((a, b) => (a.airingAt || 0) - (b.airingAt || 0));

  if (!schedules.length) return null;

  return (
    <section className={styles.schedule} aria-labelledby="broadcast-schedule-title">
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2 id="broadcast-schedule-title">Estimated Schedule</h2>
        </div>
      </div>

      <div className={styles.dayRail} aria-label="Broadcast days">
        {days.map((day, index) => {
          const count = groupedSchedules[day.key]?.length || 0;
          const isActive = activeDay === day.key;

          return (
            <button
              type="button"
              key={day.key}
              className={`${styles.dayCard} ${isActive ? styles.activeDay : ''}`}
              onClick={() => setActiveDay(day.key)}
              aria-pressed={isActive}
            >
              <span className={styles.dayName}>{index === 0 ? 'Today' : day.day}</span>
              <span className={styles.dayDate}>{day.label}</span>
              <span className={styles.dayCount}>{count || 'No'} drops</span>
            </button>
          );
        })}
      </div>

      <div className={styles.timeline}>
        {activeItems.length ? (
          activeItems.map((item) => {
            const anime = item.media || item;
            const animeId = getAnimeId(anime);
            const title = getTitle(anime);
            const format = anime?.format?.replaceAll('_', ' ');
            const href = animeId ? `/anime/${animeId}` : `/search?query=${encodeURIComponent(title)}`;

            return (
              <Link
                key={`${item.id || animeId}-${item.episode || item.airingAt}`}
                href={href}
                className={styles.row}
              >
                <div className={styles.timeBlock}>
                  <span className={styles.time}>{formatTime(item.airingAt)}</span>
                  <span className={styles.dot} />
                </div>

                <div className={styles.info}>
                  <h3 title={title}>{title}</h3>
                  <div className={styles.meta}>
                    {format && <span>{format}</span>}
                    {anime?.seasonYear && <span>{anime.seasonYear}</span>}
                  </div>
                </div>

                <div className={styles.episodeBadge}>
                  Episode {item.episode || '?'}
                </div>
              </Link>
            );
          })
        ) : (
          <div className={styles.empty}>
            <span>No broadcasts listed for this day.</span>
          </div>
        )}
      </div>
    </section>
  );
}
