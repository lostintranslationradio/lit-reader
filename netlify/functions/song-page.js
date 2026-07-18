// Prerenders /song/<slug>.html so Google (and anyone sharing a link) gets
// the real per-song <title>, meta description, canonical URL, and OG tags
// in the very first response — no JavaScript execution required.
//
// This intentionally does NOT bake in the lyrics/translation content itself.
// The page still ships the same reader.html shell and client-side script,
// which fetches the full song from Supabase and renders it exactly as
// before. Only the <head> tags that matter for search/social are stamped
// in server-side. That keeps this in sync with the "Publish" button in the
// creator panel, which writes straight to Supabase with no redeploy —
// there's nothing here that needs a rebuild to pick up a new song.
exports.handler = async function (event) {
  const SUPABASE_URL = 'https://urozuwaidryhduquvtzi.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tHobcgdhTkhP18yvEdg79Q_ItYxDVuw';
  const SITE_URL = 'https://lostintranslationradio.com';
  const htmlHeaders = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' };

  const match = event.path.match(/\/song\/([^/]+?)(?:\.html)?\/?$/);
  const songId = match ? decodeURIComponent(match[1]) : null;

  let template;
  try {
    const templateRes = await fetch(`${SITE_URL}/reader.html`);
    if (!templateRes.ok) throw new Error(`template fetch failed: ${templateRes.status}`);
    template = await templateRes.text();
  } catch (err) {
    // Can't even get the base shell — nothing sensible left to prerender.
    // Let Netlify's normal static handling take over instead of erroring out.
    return { statusCode: 404, headers: htmlHeaders, body: 'Not found' };
  }

  if (!songId) {
    return { statusCode: 200, headers: htmlHeaders, body: template };
  }

  let song = null;
  try {
    const songRes = await fetch(
      `${SUPABASE_URL}/rest/v1/songs?id=eq.${encodeURIComponent(songId)}&status=eq.published&select=zh,en,artist,context,video_thumbnail_url`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (songRes.ok) {
      const rows = await songRes.json();
      song = rows && rows[0];
    }
  } catch (err) {
    // Supabase hiccup — fall through and serve the plain shell below rather
    // than failing the whole page load. The client-side script will still
    // try its own fetch once the page loads.
  }

  // Unknown slug, or a draft/unpublished song requested directly: serve the
  // plain shell. The client-side init() already handles both cases (shows
  // the "couldn't load" message, or the creator-only draft view if signed in).
  if (!song) {
    return { statusCode: 200, headers: htmlHeaders, body: template };
  }

  const artistList = Array.isArray(song.artist) ? song.artist : (song.artist ? [song.artist] : []);
  const titleEn = song.en ? ` (${song.en})` : '';
  const artistSuffix = artistList.length ? ` — ${artistList.join(', ')}` : '';
  const title = `${song.zh}${titleEn}${artistSuffix} | Lyric Reader`;

  function plainTextDescription(text, fallback) {
    if (!text || !text.trim()) return fallback;
    const plain = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/\s+/g, ' ').trim();
    if (plain.length <= 155) return plain;
    const cut = plain.slice(0, 155);
    const lastSpace = cut.lastIndexOf(' ');
    return cut.slice(0, lastSpace > 0 ? lastSpace : 155).trim() + '…';
  }
  const genericDescription =
    `${song.zh}${titleEn}${artistSuffix}: line-by-line English translation with pinyin, word glosses, and grammar notes — built for Chinese learners.`;
  const description = plainTextDescription(song.context, genericDescription);
  const canonicalUrl = `${SITE_URL}/song/${encodeURIComponent(songId)}.html`;

  const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  template = template
    .replace(/<title>.*?<\/title>/, `<title>${escAttr(title)}</title>`)
    .replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${escAttr(description)}">`)
    .replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${escAttr(title)}">`)
    .replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${escAttr(description)}">`)
    .replace(/<meta property="og:url" content=".*?">/, `<meta property="og:url" content="${escAttr(canonicalUrl)}">`)
    .replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="${escAttr(canonicalUrl)}">`)
    .replace(/<meta name="twitter:title" content=".*?">/, `<meta name="twitter:title" content="${escAttr(title)}">`)
    .replace(/<meta name="twitter:description" content=".*?">/, `<meta name="twitter:description" content="${escAttr(description)}">`);

  if (song.video_thumbnail_url) {
    template = template
      .replace(/<meta property="og:image" content=".*?">/, `<meta property="og:image" content="${escAttr(song.video_thumbnail_url)}">`)
      .replace(/<meta name="twitter:image" content=".*?">/, `<meta name="twitter:image" content="${escAttr(song.video_thumbnail_url)}">`);
  }

  return { statusCode: 200, headers: htmlHeaders, body: template };
};
