'use client';
import { useState, useEffect } from 'react';
import { getAnimeById, getAnilistData } from '@/lib/api';
import WatchPageClient from './WatchPageClient';

export default function WatchPageClientShell({ id, ep }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (id === 'template') return;

      setLoading(true);
      try {
        const [detail, anilistData] = await Promise.allSettled([
          getAnimeById(id),
          getAnilistData(id),
        ]);

        const detailVal = detail.status === 'fulfilled' ? detail.value : {};
        const extraVal  = anilistData.status === 'fulfilled' ? anilistData.value : null;

        setData({
          anime: detailVal.anime,
          episodes: detailVal.episodes || [],
          anilistId: extraVal?.id || null
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
      <p>Initializing Player Template…</p>
    </div>
  );

  if (loading) return (
    <div style={{background:'#0a0a1a', minHeight:'100vh', color:'white', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <p>Loading Player…</p>
    </div>
  );

  return (
    <WatchPageClient
      animeId={id}
      anilistId={data?.anilistId}
      episode={ep}
      anime={data?.anime}
      episodes={data?.episodes || []}
    />
  );
}
