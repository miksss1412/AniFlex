import zlib from 'zlib';

const MIRURO_BASE = 'https://www.miruro.tv';
const PIPE_ENDPOINT = `${MIRURO_BASE}/api/secure/pipe`;

/**
 * Custom encoding for Miruro's secure pipe
 */
function encodePipeRequest(payload) {
  const jsonStr = JSON.stringify(payload);
  return Buffer.from(jsonStr).toString('base64url').replace(/=+$/, '');
}

/**
 * Custom decoding for Miruro's secure pipe
 */
function decodePipeResponse(encodedStr) {
  try {
    let str = encodedStr;
    while (str.length % 4 !== 0) str += '=';
    
    const compressed = Buffer.from(str, 'base64url');
    const decompressed = zlib.gunzipSync(compressed);
    return JSON.parse(decompressed.toString());
  } catch (error) {
    return null;
  }
}

/**
 * ID decoding for Miruro's internal IDs
 */
function decodeId(id) {
  try {
    let str = id;
    while (str.length % 4 !== 0) str += '=';
    const decoded = Buffer.from(str, 'base64url').toString();
    return decoded.includes(':') ? decoded : id;
  } catch (e) {
    return id;
  }
}

/**
 * Recursively decode all 'id' fields in an object
 */
function deepTranslateIds(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(item => deepTranslateIds(item));
  } else if (obj !== null && typeof obj === 'object') {
    for (const key in obj) {
      if (key === 'id' && typeof obj[key] === 'string') {
        obj[key] = decodeId(obj[key]);
      } else {
        deepTranslateIds(obj[key]);
      }
    }
  }
}

/**
 * Core fetcher for Miruro Pipe
 */
async function fetchFromPipe(payload) {
  const encodedPayload = encodePipeRequest(payload);
  const url = `${PIPE_ENDPOINT}?e=${encodedPayload}`;
  
  try {
    console.log('[Miruro] Pipe URL:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': MIRURO_BASE,
        'Origin': MIRURO_BASE,
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      console.error('[Miruro] Pipe error status:', response.status);
      throw new Error(`Miruro Pipe returned ${response.status}`);
    }

    const encodedResponse = await response.text();
    console.log('[Miruro] Encoded Response (first 100 chars):', encodedResponse.substring(0, 100));
    const decoded = decodePipeResponse(encodedResponse.trim());
    if (decoded) deepTranslateIds(decoded);
    return decoded;
  } catch (error) {
    console.error('Miruro Pipe fetch error:', error);
    return null;
  }
}

/**
 * Get Full Episode Data (including all providers) for an Anilist ID
 */
export async function getMiruroFullData(anilistId) {
  const payload = {
    path: 'episodes',
    method: 'GET',
    query: { anilistId: Number(anilistId) },
    body: null,
    version: '0.1.0',
  };

  const data = await fetchFromPipe(payload);
  
  if (!data) return null;

  // Miruro returns an object, sometimes with success/data wrapper
  const result = data.data || (data.success ? data.data : data);
  return result;
}

/**
 * Get Streaming Sources for a Miruro Episode
 */
export async function getMiruroSources(episodeId, anilistId, provider, category = 'sub') {
  // Miruro's episode list returns encoded ids. The route may pass either the
  // original encoded value or a decoded id after deepTranslateIds().
  const normalizedEpisodeId = decodeId(episodeId);
  const encodedEpId = Buffer.from(normalizedEpisodeId).toString('base64url').replace(/=+$/, '');
  
  console.log('[Miruro] Requesting Sources:', {
    episodeId: normalizedEpisodeId,
    encodedEpId,
    provider,
    category,
    anilistId
  });

  const payload = {
    path: 'sources',
    method: 'GET',
    query: { 
      episodeId: encodedEpId,
      provider: provider,
      category: category,
      anilistId: Number(anilistId) 
    },
    body: null,
    version: '0.1.0',
  };

  const data = await fetchFromPipe(payload);
  const sourceData = data?.data || data;
  const sources = sourceData?.sources || sourceData?.streams || [];

  if (sources.length) {
    return {
      sources,
      subtitles: sourceData.subtitles || sourceData.tracks || [],
      intro: sourceData.intro || null,
      outro: sourceData.outro || null,
      download: sourceData.download || null,
      headers: {
        'Referer': MIRURO_BASE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }
    };
  }

  console.warn('[Miruro] No sources returned from pipe');
  return null;
}

/**
 * Search for an anime on Miruro
 */
export async function searchMiruro(query) {
  const payload = {
    path: 'search',
    method: 'GET',
    query: { query: query },
    body: null,
    version: '0.1.0',
  };

  const data = await fetchFromPipe(payload);
  return data?.data || [];
}
