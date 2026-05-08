import * as cheerio from 'cheerio';

const ANIMEPAHE_RU = 'https://animepahe.ru';
const ANIMEPAHE_CH = 'https://animepahe.ch';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest',
};

export async function scrapeAnimePahe(title, episode = 1) {
  console.log(`[AnimePahe] Scraping ${title} Episode ${episode}...`);
  // Try Original AnimePahe (RU) first
  let streams = await scrapeOriginalPahe(ANIMEPAHE_RU, title, episode);
  if (streams && streams.length > 0) return streams;

  // Try Mirror (PW)
  streams = await scrapeOriginalPahe('https://animepahe.pw', title, episode);
  if (streams && streams.length > 0) return streams;

  // Try WordPress Clone (CH) as last resort
  streams = await scrapeWordPressPahe(ANIMEPAHE_CH, title, episode);
  return streams;
}

async function scrapeOriginalPahe(baseUrl, title, episode) {
  try {
    // Clean title for better search (remove Season, Part, etc. if too specific)
    const cleanTitle = title.split(':')[0].split('Season')[0].trim();
    const searchUrl = `${baseUrl}/api?m=search&q=${encodeURIComponent(cleanTitle)}`;
    const searchRes = await fetch(searchUrl, { headers: { ...HEADERS, 'Referer': baseUrl } });
    
    if (!searchRes.ok) return null;
    const contentType = searchRes.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return null;

    const searchData = await searchRes.json();
    if (!searchData.data || searchData.data.length === 0) return null;

    // Try to find exact match first, then season-aware match, then partial
    const anime = searchData.data.find(a => a.title.toLowerCase() === title.toLowerCase()) || 
                  searchData.data.find(a => {
                    const t = title.toLowerCase();
                    const at = a.title.toLowerCase();
                    // Check if both titles mention the same season number
                    const sMatch = t.match(/(\d+)(?:st|nd|rd|th)? season|season (\d+)/);
                    const asMatch = at.match(/(\d+)(?:st|nd|rd|th)? season|season (\d+)/);
                    if (sMatch && asMatch) {
                      const sNum = sMatch[1] || sMatch[2];
                      const asNum = asMatch[1] || asMatch[2];
                      return sNum === asNum && at.includes(cleanTitle.toLowerCase());
                    }
                    return at.includes(title.toLowerCase());
                  }) ||
                  searchData.data.find(a => title.toLowerCase().includes(a.title.toLowerCase())) ||
                  searchData.data[0];
    
    console.log(`[AnimePahe] Found anime: ${anime.title} (${anime.session})`);
    const animeSession = anime.session;

    const page = Math.ceil(episode / 30);
    const releaseUrl = `${baseUrl}/api?m=release&id=${animeSession}&l=30&sort=episode_asc&page=${page}`;
    const releaseRes = await fetch(releaseUrl, { headers: { ...HEADERS, 'Referer': baseUrl } });
    if (!releaseRes.ok) return null;
    const releaseData = await releaseRes.json();

    const ep = releaseData.data.find(e => e.episode === Number(episode));
    if (!ep) return null;

    const playUrl = `${baseUrl}/play/${animeSession}/${ep.session}`;
    const playRes = await fetch(playUrl, { headers: { ...HEADERS, 'Referer': baseUrl } });
    const playHtml = await playRes.text();
    const $ = cheerio.load(playHtml);
    
    const links = [];
    $('#resolutionMenu button').each((i, el) => {
      const url = $(el).attr('data-src');
      if (url) links.push({ url, resolution: $(el).text().trim() });
    });

    if (links.length === 0) {
      const scripts = $('script');
      scripts.each((i, el) => {
        const content = $(el).text();
        if (content.includes('eval(function(p,a,c,k,e,d)')) {
          const params = content.match(/eval\(function\(p,a,c,k,e,d\)\{.*\}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)\)\)/);
          if (params) {
            const [_, p, a, c, kStr] = params;
            const decoded = decodePacked(p, parseInt(a), parseInt(c), kStr.split('|'));
            const urlMatch = decoded.match(/https:\/\/[\w\.-]+\/direct\/[\w\.-]+/);
            if (urlMatch) links.push({ url: urlMatch[0], resolution: 'Direct' });
          }
        }
      });
    }
    return links;
  } catch (e) {
    return null;
  }
}

async function scrapeWordPressPahe(baseUrl, title, episode) {
  try {
    // Clean title for better search
    const cleanTitle = title.split(':')[0].split('Season')[0].trim();
    const searchUrl = `${baseUrl}/?s=${encodeURIComponent(cleanTitle)}`;
    const searchRes = await fetch(searchUrl, { headers: HEADERS });
    const searchHtml = await searchRes.text();
    const $ = cheerio.load(searchHtml);

    const results = [];
    $('.post-title a').each((i, el) => {
      results.push({ title: $(el).text(), url: $(el).attr('href') });
    });

    const romanMap = { 'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10 };
    const getSeasonNum = (t) => {
      const match = t.toLowerCase().match(/(\d+)(?:st|nd|rd|th)? season|season (\d+)| ([ivx]+)(?: |$)/);
      if (!match) return null;
      if (match[1] || match[2]) return match[1] || match[2];
      return romanMap[match[3]]?.toString();
    };

    const targetSeason = getSeasonNum(title);
    const anime = results.find(r => {
      const rs = getSeasonNum(r.title);
      return rs === targetSeason && r.title.toLowerCase().includes(cleanTitle.toLowerCase());
    }) || results[0];

    if (!anime) return null;

    // 2. Fetch Anime Page
    const animeRes = await fetch(anime.url, { headers: HEADERS });
    const animeHtml = await animeRes.text();
    const $a = cheerio.load(animeHtml);

    // 3. Find Episode Link
    let epLink = null;
    $a('a').each((i, el) => {
      const text = $a(el).text().toLowerCase();
      const href = $a(el).attr('href') || '';
      // Matches "Episode 2", "Ep 2", or "/-episode-2-"
      if (text.includes(`episode ${episode}`) || text === `${episode}` || href.includes(`-episode-${episode}-`)) {
        epLink = href;
        return false;
      }
    });

    if (!epLink) {
      // Try to guess the URL pattern if not found
      const baseSlug = anime.url.replace(/\/$/, '');
      epLink = `${baseSlug}-episode-${episode}-english-subbed/`;
    }

    // 4. Fetch Episode Page
    const epRes = await fetch(epLink, { headers: HEADERS });
    const epHtml = await epRes.text();
    const $e = cheerio.load(epHtml);

    // 5. Extract iframe
    const iframeSrc = $e('iframe').first().attr('src');
    if (iframeSrc) {
      return [{ url: iframeSrc, resolution: 'Mirror' }];
    }
    return null;
  } catch (e) {
    return null;
  }
}

function decodePacked(p, a, c, k) {
  while (c--) if (k[c]) p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
  return p;
}
