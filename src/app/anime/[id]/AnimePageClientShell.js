'use client';
import { useState, useEffect } from 'react';
import { getAnimeById, getAnilistData, getAnimeRecommendations } from '@/lib/api';
import AnimeDetailClient from './AnimeDetailClient';

export default function AnimePageClientShell({ id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      // Don't fetch if id is 'template' (the static generation phase)
      if (id === 'template') return;

      setLoading(true);
      try {
        const [detail, anilistData, recommendations] = await Promise.allSettled([
          getAnimeById(id),
          getAnilistData(id),
          getAnimeRecommendations(id),
        ]);

        const detailVal = detail.status === 'fulfilled' ? detail.value : {};
        const extraVal  = anilistData.status === 'fulfilled' ? anilistData.value : null;
        const recsVal   = recommendations.status === 'fulfilled' ? recommendations.value : [];

        setData({
          anime: detailVal.anime,
          episodes: detailVal.episodes || [],
          pagination: detailVal.pagination,
          characters: detailVal.characters || [],
          streaming: detailVal.streaming || [],
          extra: extraVal,
          recommendations: recsVal
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (id === 'template') return (
    <div style={{background:'#0a0a1a', minHeight:'100vh', color:'white', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <p>Initializing…</p>
    </div>
  );

  if (loading) return (
    <div style={{background:'#0a0a1a', minHeight:'100vh', color:'white', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <p>Loading Anime Details…</p>
    </div>
  );

  if (!data?.anime) return (
    <div style={{background:'#0a0a1a', minHeight:'100vh', color:'white', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <p>Anime not found.</p>
    </div>
  );

  return (
    <AnimeDetailClient
      anime={data.anime}
      episodes={data.episodes}
      pagination={data.pagination}
      characters={data.characters}
      streaming={data.streaming}
      extra={data.extra}
      recommendations={data.recommendations}
    />
  );
}
