// Analytics logging — server-side, no cookies, no PII (no IPs stored)
function logPageView(pathname, request, env) {
  if (!env.ANALYTICS) return;
  try {
    const ua = request.headers.get('user-agent') || '';
    const ref = request.headers.get('referer') || '';
    const cf = request.cf || {};

    const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';

    let refSource = 'direct';
    if (ref) {
      if (/twitter\.com|x\.com|t\.co/i.test(ref))  refSource = 'twitter';
      else if (/linkedin\.com/i.test(ref))          refSource = 'linkedin';
      else if (/whatsapp/i.test(ref))               refSource = 'whatsapp';
      else if (/telegram/i.test(ref))               refSource = 'telegram';
      else if (/google\.com/i.test(ref))            refSource = 'google';
      else                                          refSource = 'other';
    }

    // Classify page type
    let pageType = 'landing';
    if (pathname.startsWith('/blog/') || pathname.includes('blog')) pageType = 'blog';
    if (pathname.startsWith('/cv') || pathname.includes('CV'))       pageType = 'cv';

    env.ANALYTICS.writeDataPoint({
      indexes: [pathname],               // primary query index
      blobs: [
        pathname,                        // blob[0]: page path
        cf.country || 'XX',             // blob[1]: country
        cf.city    || '',               // blob[2]: city
        device,                         // blob[3]: mobile|desktop
        refSource,                      // blob[4]: referrer source
        pageType,                       // blob[5]: landing|blog|cv
      ],
      doubles: [Date.now()],            // double[0]: unix ms timestamp
    });
  } catch (_) {
    // never break page serving
  }
}

// File extensions to skip tracking (assets, not pages)
const ASSET_EXTS = /\.(css|js|svg|ico|jpg|jpeg|png|webp|gif|mp3|mp4|pdf|woff2?|ttf|otf|map)$/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only track HTML page views, not asset requests
    if (!ASSET_EXTS.test(url.pathname) && request.method === 'GET') {
      ctx.waitUntil(Promise.resolve(logPageView(url.pathname, request, env)));
    }

    // Serve static assets as before
    return env.ASSETS.fetch(request);
  },
};
