import * as cheerio from 'cheerio';
import { RetailerPriceComparison } from '../types.js';

export type ScoreMatcherFn = (candidateTitle: string, targetQuery: string) => number;

export interface InternalComparison extends RetailerPriceComparison {
  verifiedLive?: boolean;
}

export interface StoreIdentity {
  canonicalKey: string;
  displayName: string;
  domain: string;
  isCoreBigBox: boolean;
  buildSearchUrl: (query: string) => string;
}

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9'
};

const KNOWN_STORES: Array<{
  canonicalKey: string;
  displayName: string;
  domain: string;
  aliases: string[];
  isCoreBigBox?: boolean;
  buildSearchUrl: (q: string) => string;
}> = [
  {
    canonicalKey: 'target',
    displayName: 'Target',
    domain: 'target.com',
    aliases: ['target', 'target.com'],
    isCoreBigBox: true,
    buildSearchUrl: (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'best buy',
    displayName: 'Best Buy',
    domain: 'bestbuy.com',
    aliases: ['best buy', 'bestbuy', 'bestbuy.com'],
    isCoreBigBox: true,
    buildSearchUrl: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}&qp=condition_facet%3DCondition~New`
  },
  {
    canonicalKey: 'walmart',
    displayName: 'Walmart',
    domain: 'walmart.com',
    aliases: ['walmart', 'walmart.com', 'wal-mart'],
    isCoreBigBox: true,
    buildSearchUrl: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'gamestop',
    displayName: 'GameStop',
    domain: 'gamestop.com',
    aliases: ['gamestop', 'gamestop.com', 'game stop'],
    buildSearchUrl: (q) => `https://www.gamestop.com/search/?q=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'costco',
    displayName: 'Costco',
    domain: 'costco.com',
    aliases: ['costco', 'costco.com', 'costco wholesale'],
    buildSearchUrl: (q) => `https://www.costco.com/s?keyword=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'bhphotovideo',
    displayName: 'B&H Photo',
    domain: 'bhphotovideo.com',
    aliases: ['b&h photo', 'b&h', 'b&h photo video', 'bh photo', 'bhphotovideo', 'bhphotovideo.com', 'bhphoto.com'],
    buildSearchUrl: (q) => `https://www.bhphotovideo.com/c/search?Ntt=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'newegg',
    displayName: 'Newegg',
    domain: 'newegg.com',
    aliases: ['newegg', 'newegg.com'],
    buildSearchUrl: (q) => `https://www.newegg.com/p/pl?d=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'micro center',
    displayName: 'Micro Center',
    domain: 'microcenter.com',
    aliases: ['micro center', 'microcenter', 'microcenter.com'],
    buildSearchUrl: (q) => `https://www.microcenter.com/search/search_results.aspx?Ntt=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'apple',
    displayName: 'Apple',
    domain: 'apple.com',
    aliases: ['apple', 'apple.com', 'apple store'],
    buildSearchUrl: (q) => `https://www.apple.com/us/search/${encodeURIComponent(q)}?src=globalnav`
  },
  {
    canonicalKey: 'ebay',
    displayName: 'eBay',
    domain: 'ebay.com',
    aliases: ['ebay', 'ebay.com'],
    buildSearchUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_BIN=1&LH_ItemCondition=1000`
  },
  {
    canonicalKey: 'staples',
    displayName: 'Staples',
    domain: 'staples.com',
    aliases: ['staples', 'staples.com'],
    buildSearchUrl: (q) => `https://www.staples.com/${encodeURIComponent(q)}/directory_${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'nintendo store',
    displayName: 'Nintendo Store',
    domain: 'nintendo.com',
    aliases: ['nintendo', 'nintendo store', 'nintendo.com', 'store.nintendo.com'],
    buildSearchUrl: (q) => `https://www.nintendo.com/us/search/#q=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'adorama',
    displayName: 'Adorama',
    domain: 'adorama.com',
    aliases: ['adorama', 'adorama.com'],
    buildSearchUrl: (q) => `https://www.adorama.com/l/?searchinfo=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'home depot',
    displayName: 'Home Depot',
    domain: 'homedepot.com',
    aliases: ['home depot', 'the home depot', 'homedepot', 'homedepot.com'],
    buildSearchUrl: (q) => `https://www.homedepot.com/s/${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'lowes',
    displayName: "Lowe's",
    domain: 'lowes.com',
    aliases: ["lowe's", 'lowes', 'lowes.com'],
    buildSearchUrl: (q) => `https://www.lowes.com/search?searchTerm=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'kohls',
    displayName: "Kohl's",
    domain: 'kohls.com',
    aliases: ["kohl's", 'kohls', 'kohls.com'],
    buildSearchUrl: (q) => `https://www.kohls.com/search.jsp?search=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'macys',
    displayName: "Macy's",
    domain: 'macys.com',
    aliases: ["macy's", 'macys', 'macys.com'],
    buildSearchUrl: (q) => `https://www.macys.com/shop/featured/${encodeURIComponent(q.replace(/\s+/g, '-'))}`
  },
  {
    canonicalKey: 'sony',
    displayName: 'Sony',
    domain: 'electronics.sony.com',
    aliases: ['sony', 'sony.com', 'electronics.sony.com'],
    buildSearchUrl: (q) => `https://electronics.sony.com/search/${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'dell',
    displayName: 'Dell',
    domain: 'dell.com',
    aliases: ['dell', 'dell.com'],
    buildSearchUrl: (q) => `https://www.dell.com/en-us/search/${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'lenovo',
    displayName: 'Lenovo',
    domain: 'lenovo.com',
    aliases: ['lenovo', 'lenovo.com'],
    buildSearchUrl: (q) => `https://www.lenovo.com/us/en/search?text=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'samsung',
    displayName: 'Samsung',
    domain: 'samsung.com',
    aliases: ['samsung', 'samsung.com'],
    buildSearchUrl: (q) => `https://www.samsung.com/us/search/searchMain/?listType=g&searchTerm=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'anker',
    displayName: 'Anker',
    domain: 'anker.com',
    aliases: ['anker', 'anker.com'],
    buildSearchUrl: (q) => `https://www.anker.com/search?q=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'keychron',
    displayName: 'Keychron',
    domain: 'keychron.com',
    aliases: ['keychron', 'keychron.com'],
    buildSearchUrl: (q) => `https://www.keychron.com/search?q=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'crutchfield',
    displayName: 'Crutchfield',
    domain: 'crutchfield.com',
    aliases: ['crutchfield', 'crutchfield.com'],
    buildSearchUrl: (q) => `https://www.crutchfield.com/S-123/App/Search/Search.aspx?q=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'sweetwater',
    displayName: 'Sweetwater',
    domain: 'sweetwater.com',
    aliases: ['sweetwater', 'sweetwater.com'],
    buildSearchUrl: (q) => `https://www.sweetwater.com/store/search?s=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'monoprice',
    displayName: 'Monoprice',
    domain: 'monoprice.com',
    aliases: ['monoprice', 'monoprice.com'],
    buildSearchUrl: (q) => `https://www.monoprice.com/search/index?keyword=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'woot',
    displayName: 'Woot!',
    domain: 'woot.com',
    aliases: ['woot', 'woot!', 'woot.com'],
    buildSearchUrl: (q) => `https://www.woot.com/plus?q=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'lego',
    displayName: 'LEGO',
    domain: 'lego.com',
    aliases: ['lego', 'lego.com'],
    buildSearchUrl: (q) => `https://www.lego.com/en-us/search?q=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'rei',
    displayName: 'REI',
    domain: 'rei.com',
    aliases: ['rei', 'rei.com'],
    buildSearchUrl: (q) => `https://www.rei.com/search?q=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'nike',
    displayName: 'Nike',
    domain: 'nike.com',
    aliases: ['nike', 'nike.com'],
    buildSearchUrl: (q) => `https://www.nike.com/w?q=${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'bjs',
    displayName: "BJ's",
    domain: 'bjs.com',
    aliases: ['bjs', "bj's", 'bjs.com'],
    buildSearchUrl: (q) => `https://www.bjs.com/search/${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'samsclub',
    displayName: "Sam's Club",
    domain: 'samsclub.com',
    aliases: ['sams club', "sam's club", 'samsclub', 'samsclub.com'],
    buildSearchUrl: (q) => `https://www.samsclub.com/s/${encodeURIComponent(q)}`
  },
  {
    canonicalKey: 'wayfair',
    displayName: 'Wayfair',
    domain: 'wayfair.com',
    aliases: ['wayfair', 'wayfair.com'],
    buildSearchUrl: (q) => `https://www.wayfair.com/keyword.php?keyword=${encodeURIComponent(q)}`
  }
];

function cleanStoreRawInput(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[/?#].*$/, '')
    .trim();
}

export function normalizeStoreIdentity(rawStore: string): StoreIdentity {
  const cleaned = cleanStoreRawInput(rawStore);
  const lower = cleaned.toLowerCase();

  for (const known of KNOWN_STORES) {
    if (known.aliases.includes(lower) || known.domain === lower) {
      return {
        canonicalKey: known.canonicalKey,
        displayName: known.displayName,
        domain: known.domain,
        isCoreBigBox: Boolean(known.isCoreBigBox),
        buildSearchUrl: known.buildSearchUrl
      };
    }
  }

  const looksLikeDomain = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(lower);
  const inferredDomain = looksLikeDomain
    ? lower
    : `${lower.replace(/[^a-z0-9]+/g, '')}.com`;

  return {
    canonicalKey: lower,
    displayName: cleaned,
    domain: inferredDomain,
    isCoreBigBox: false,
    buildSearchUrl: (q) => `https://www.${inferredDomain}/search?q=${encodeURIComponent(q)}`
  };
}

export function simplifyProductQueryForStore(query: string): string {
  // 1. Strip HTML entities, trademarks, parentheticals, and common Amazon spec-sheet suffixes
  let cleaned = query
    .replace(/&#160;|&nbsp;/gi, ' ')
    .replace(/[™®©\u00a0]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,\s*(?:USA|US|International)\s*(?:Version|Model|Edition)?/gi, ' ')
    .replace(/\b\d+\s*(?:hr|hrs|hour|hours|h)\s*(?:battery(?:\s*life)?|playtime)\b/gi, ' ')
    .replace(/\b(?:active\s+)?noise[\s-]*(?:canceling|cancelling|cancellation)\b|\banc\b/gi, ' ')
    .replace(/\b(?:over-ear|on-ear|in-ear|true\s+wireless|wireless|bluetooth|spatial\s+audio|lossless\s+audio|usb-c|fast\s+charging|built-in\s+mic)\b/gi, ' ')
    .replace(/\b(?:unlocked|gsm|smartwatch|system|console|headphones|earbuds|with|for)\b/gi, ' ')
    .replace(/\s+[-–—]\s+.*$/, '') // strip trailing "- Black", "- Sandstone", "- 40H Battery..."
    .replace(/[,|/]+/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Cap ultra-long product titles to core 5 words so store search bars (like Newegg/BestBuy) match broadly
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > 5) {
    cleaned = words.slice(0, 5).join(' ');
  }

  return cleaned || query.replace(/\s+/g, ' ').trim();
}

function isPricePlausible(price: number, amazonPrice: number): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  if (amazonPrice > 50 && price < amazonPrice * 0.55) return false;
  if (amazonPrice > 20 && price > amazonPrice * 3.5) return false;
  return true;
}

function parseUsdNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? Number(raw.toFixed(2)) : null;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/,/g, '').match(/([0-9]+(?:\.[0-9]{1,2})?)/);
  if (!cleaned) return null;
  const val = Number(cleaned[1]);
  return Number.isFinite(val) && val > 0 ? Number(val.toFixed(2)) : null;
}

const SERPER_CACHE_TTL_MS = 30 * 60 * 1000;
const serperShoppingCache = new Map<string, { expiresAt: number; offers: Map<string, InternalComparison> }>();
const serperSiteCache = new Map<string, { expiresAt: number; comparison: InternalComparison | null }>();

function pruneMapIfNeeded<K, V>(map: Map<K, V>, maxSize: number) {
  if (map.size > maxSize) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
}

/**
 * Fetches live multi-store Google Shopping results via Serper.dev (1 API credit for all stores, cached 30m).
 * Keyed by canonical store key (e.g. 'home depot', 'lowes', 'costco', 'newegg', 'gamestop').
 */
export async function fetchSerperShoppingOffers(
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): Promise<Map<string, InternalComparison>> {
  const results = new Map<string, InternalComparison>();
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return results;

  const cleanQ = simplifyProductQueryForStore(targetQuery);
  const cacheKey = cleanQ.toLowerCase();
  const cached = serperShoppingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.offers;
  }

  try {
    const res = await fetchWithTimeout('https://google.serper.dev/shopping', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: cleanQ,
        gl: 'us',
        hl: 'en',
        num: 20
      })
    }, 4000);

    if (!res.ok) return results;
    const data: any = await res.json();
    const items: any[] = Array.isArray(data?.shopping) ? data.shopping : [];

    const bestScoreByKey = new Map<string, number>();

    for (const item of items) {
      const title = String(item?.title || '').trim();
      const source = String(item?.source || '').trim();
      const link = String(item?.link || '').trim();
      const rawPrice = String(item?.price || '').trim();

      if (!title || !source || !link || !rawPrice) continue;
      if (/\b(cad|eur|gbp|aud|mxn)\b/i.test(rawPrice)) continue;

      const price = parseUsdNumber(rawPrice);
      if (price === null || !isPricePlausible(price, amazonPrice)) continue;

      const sc = scoreStrictMatch(title, targetQuery);
      if (sc < 0) continue;

      const identity = normalizeStoreIdentity(source);
      if (identity.canonicalKey === 'amazon') continue;

      const prevScore = bestScoreByKey.get(identity.canonicalKey) ?? -Infinity;
      if (sc > prevScore) {
        bestScoreByKey.set(identity.canonicalKey, sc);
        results.set(identity.canonicalKey, {
          retailer: identity.displayName,
          price,
          regularPrice: null,
          url: link,
          inStock: true,
          isLowestPrice: false,
          label: `${identity.displayName} Price`,
          verifiedLive: true
        });
      }
    }
  } catch {
    // Fail softly if Serper times out or quota is exhausted
  }

  if (results.size > 0) {
    serperShoppingCache.set(cacheKey, { expiresAt: Date.now() + SERPER_CACHE_TTL_MS, offers: results });
    pruneMapIfNeeded(serperShoppingCache, 150);
  }

  return results;
}

/**
 * Queries Google Web Search via Serper.dev for `site:<domain> <product>` as a universal
 * fallback for any custom store website not listed in Google Shopping (cached 30m).
 */
export async function fetchSerperSiteSearch(
  identity: StoreIdentity,
  cleanQ: string,
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): Promise<InternalComparison | null> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return null;

  const cacheKey = `${identity.domain}:${cleanQ.toLowerCase()}`;
  const cached = serperSiteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.comparison;
  }

  try {
    const res = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: `site:${identity.domain} ${cleanQ}`,
        gl: 'us',
        hl: 'en',
        num: 5
      })
    }, 3800);

    if (!res.ok) return null;
    const data: any = await res.json();
    const organic: any[] = Array.isArray(data?.organic) ? data.organic : [];

    const ranked: Array<{ title: string; link: string; price: number | null; inStock: boolean; score: number }> = [];

    for (const item of organic) {
      const title = String(item?.title || '').replace(/\s*[-|–]\s*[^-|–]+$/, '').trim();
      const link = String(item?.link || '').trim();
      const snippet = String(item?.snippet || '');
      const priceRange = String(item?.priceRange || '');
      const attrs = item?.attributes ? JSON.stringify(item.attributes) : '';

      if (!link || !hostnameMatchesDomain(link, identity.domain)) continue;

      const sc = scoreStrictMatch(title || item?.title || '', targetQuery);
      if (sc < 0) continue;

      const combinedText = `${priceRange} ${attrs} ${snippet}`;
      if (/\b(cad|eur|gbp)\b/i.test(combinedText)) continue;

      const prices = extractPricesFromText(combinedText).filter((p) => isPricePlausible(p, amazonPrice));
      const inStock = !/\bout of stock\b|\bsold out\b|\bunavailable\b/i.test(combinedText);

      ranked.push({
        title,
        link,
        price: prices[0] ?? null,
        inStock,
        score: sc + (prices[0] ? 15 : 0)
      });
    }

    ranked.sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best) return null;

    if (best.price !== null) {
      const hit: InternalComparison = {
        retailer: identity.displayName,
        price: best.price,
        regularPrice: null,
        url: best.link,
        inStock: best.inStock,
        isLowestPrice: false,
        label: best.inStock ? `${identity.displayName} Price` : 'Out of Stock',
        verifiedLive: true
      };
      serperSiteCache.set(cacheKey, { expiresAt: Date.now() + SERPER_CACHE_TTL_MS, comparison: hit });
      pruneMapIfNeeded(serperSiteCache, 200);
      return hit;
    }

    // If Google returned the exact PDP link without a snippet price, try reading the PDP directly
    let pdpBlocked = false;
    try {
      const pdpRes = await fetchWithTimeout(best.link, {
        headers: { ...BROWSER_HEADERS, 'Accept': 'text/html,application/xhtml+xml' }
      }, 3000);
      const html = pdpRes.ok ? await pdpRes.text() : '';
      if (pdpRes.ok && !isBlockedHtmlOrStatus(pdpRes.status, html)) {
        const { comparison } = extractBestProductFromHtml(
          html,
          pdpRes.url || best.link,
          identity.displayName,
          targetQuery,
          amazonPrice,
          scoreStrictMatch
        );
        if (comparison) {
          serperSiteCache.set(cacheKey, { expiresAt: Date.now() + SERPER_CACHE_TTL_MS, comparison });
          pruneMapIfNeeded(serperSiteCache, 200);
          return comparison;
        }
      } else {
        pdpBlocked = true;
        // Direct PDP blocked (e.g. Cloudflare on Newegg/B&H); try headless Markdown reader on the exact Serper URL
        const jinaPdp = await fetchWithTimeout(`https://r.jina.ai/${best.link}`, {
          headers: { 'Accept': 'text/plain' }
        }, 6500);
        if (jinaPdp.ok) {
          const md = await jinaPdp.text();
          if (!isBlockedHtmlOrStatus(200, md)) {
            pdpBlocked = false;
            const mdHit = extractBestProductFromSinglePdpMarkdown(
              md,
              best.link,
              identity.displayName,
              targetQuery,
              amazonPrice,
              scoreStrictMatch
            );
            if (mdHit) {
              serperSiteCache.set(cacheKey, { expiresAt: Date.now() + SERPER_CACHE_TTL_MS, comparison: mdHit });
              pruneMapIfNeeded(serperSiteCache, 200);
              return mdHit;
            }
          }
        }
      }
    } catch {
      // ignore
    }

    if (pdpBlocked) {
      // Last-resort targeted Google Shopping query for "<product> <store>" when the store's PDP is CAPTCHA/Cloudflare-gated
      const targetedOffers = await fetchSerperShoppingOffers(
        `${cleanQ} ${identity.displayName}`,
        amazonPrice,
        scoreStrictMatch
      );
      const targetedHit = targetedOffers.get(identity.canonicalKey);
      if (targetedHit) {
        serperSiteCache.set(cacheKey, { expiresAt: Date.now() + SERPER_CACHE_TTL_MS, comparison: targetedHit });
        pruneMapIfNeeded(serperSiteCache, 200);
        return targetedHit;
      }

      const blockedHit: InternalComparison = {
        retailer: identity.displayName,
        price: null,
        regularPrice: null,
        url: best.link,
        inStock: best.inStock,
        isLowestPrice: false,
        label: 'Site Blocked',
        statusReason: 'blocked',
        verifiedLive: false
      };
      serperSiteCache.set(cacheKey, { expiresAt: Date.now() + SERPER_CACHE_TTL_MS, comparison: blockedHit });
      pruneMapIfNeeded(serperSiteCache, 200);
      return blockedHit;
    }
  } catch {
    // ignore
  }

  serperSiteCache.set(cacheKey, { expiresAt: Date.now() + SERPER_CACHE_TTL_MS, comparison: null });
  pruneMapIfNeeded(serperSiteCache, 200);
  return null;
}

function extractPricesFromText(text: string): number[] {
  const out: number[] = [];
  // Strip Apple/trade-in promo ranges ("Get $30 – $430 off ... trade in") & save/savings phrases before matching prices
  const sanitized = text
    .replace(/Get\s+\$[0-9,.]+\s*[-–—]\s*\$[0-9,.]+\s+off[\s\S]{0,80}?trade\s*in/gi, ' ')
    .replace(/(?:Savings?|Save|Off|Trade[\s-]*in)[:\s]*\$[0-9,.]+/gi, ' ');
  // Strip markdown bold/sup tags around dollars like "$**149**.99" or "$149<sup>.99</sup>"
  const norm = sanitized.replace(/\*\*/g, '').replace(/<\/?sup>/gi, '');
  // Matches "$499.99", "$1,299.00", or B&H-style Markdown "$229 00"
  const re = /\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|\d{2,4}\s+\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    const token = m[1].replace(/,/g, '').replace(/\s+/, '.');
    const n = Number(token);
    if (Number.isFinite(n) && n > 0) out.push(Number(n.toFixed(2)));
  }
  return out;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs: number = 4000): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs)
  });
}

function isBlockedHtmlOrStatus(status: number, html: string): boolean {
  if (status === 401 || status === 403 || status === 429 || status === 503) return true;
  if (!html || html.length < 300) return true;
  const head = html.slice(0, 6000);
  return (
    /Attention Required!\s*\|\s*Cloudflare/i.test(head) ||
    /<title>\s*(?:Just a moment\.\.\.|Access Denied|Robot or human\?|Error Page)\s*<\/title>/i.test(head) ||
    /perimeterx|px-captcha|validateCaptcha|cf-browser-verification|Warning:\s*Target URL returned error\s*403/i.test(head)
  );
}

function unwrapRedirectUrl(rawUrl: string): string {
  try {
    let target = rawUrl;
    if (target.includes('duckduckgo.com/l/') && target.includes('uddg=')) {
      const m = target.match(/[?&]uddg=([^&]+)/);
      if (m) target = decodeURIComponent(m[1]);
    }
    if (target.includes('howl.me/') || target.includes('bestbuycreators') || target.includes('goto')) {
      const m = target.match(/[?&](?:url|u)=([^&]+)/);
      if (m) target = decodeURIComponent(m[1]);
    }
    if (target.includes('api.bestbuy.com/click/-/')) {
      const skuM = target.match(/\/click\/-\/([0-9]{6,10})\//);
      if (skuM) return `https://www.bestbuy.com/site/${skuM[1]}.p`;
    }
    return target;
  } catch {
    return rawUrl;
  }
}

function toAbsoluteUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function hostnameMatchesDomain(urlStr: string, domain: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    return host === cleanDomain || host.endsWith(`.${cleanDomain}`);
  } catch {
    return false;
  }
}

/**
 * Dynamically searches Target's RedSky product search endpoint for ANY product query.
 */
export async function resolveTargetRedSkySearch(
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): Promise<InternalComparison | null> {
  try {
    const cleanQ = simplifyProductQueryForStore(targetQuery);
    const url = `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&channel=WEB&count=10&keyword=${encodeURIComponent(cleanQ)}&offset=0&page=%2Fs%2F${encodeURIComponent(cleanQ)}&pricing_store_id=3991&visitor_id=018c123456789`;
    const res = await fetchWithTimeout(url, {
      headers: { ...BROWSER_HEADERS, 'Accept': 'application/json' }
    }, 3200);

    if (!res.ok) return null;
    const json: any = await res.json();
    const products: any[] = json?.data?.search?.products || [];

    const ranked = products
      .map((p: any) => {
        const title = String(p?.item?.product_description?.title || '').replace(/&#160;|&nbsp;/gi, ' ').trim();
        const price = parseUsdNumber(p?.price?.current_retail ?? p?.price?.current_retail_min);
        const regPrice = parseUsdNumber(p?.price?.reg_retail ?? p?.price?.reg_retail_max);
        const buyUrl = p?.item?.enrichment?.buy_url;
        const score = title ? scoreStrictMatch(title, targetQuery) : -1;
        return { title, price, regPrice, buyUrl, score };
      })
      .filter((x) => x.score >= 0 && x.price !== null && x.buyUrl && isPricePlausible(x.price, amazonPrice))
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) return null;
    const best = ranked[0];
    const p = best.price as number;
    const isSale = typeof best.regPrice === 'number' && best.regPrice > p;
    return {
      retailer: 'Target',
      price: p,
      regularPrice: best.regPrice,
      url: toAbsoluteUrl(best.buyUrl, 'https://www.target.com'),
      inStock: true,
      isLowestPrice: false,
      label: isSale ? 'Sale' : 'Target Price',
      verifiedLive: true
    };
  } catch {
    return null;
  }
}

/**
 * Fetches live multi-retailer pricing from DekuDeals for gaming consoles, controllers, and games.
 */
export async function fetchDekuDealsPrices(
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): Promise<Map<string, InternalComparison>> {
  const results = new Map<string, InternalComparison>();
  const qLower = targetQuery.toLowerCase();
  const isGaming = /\b(nintendo|switch|playstation|ps[45]|xbox|zelda|mario|pokemon|pokémon|kirby|metroid|joy-con|dualsense|pro\s*controller|amiibo|steam\s*deck|game)\b/i.test(qLower);
  if (!isGaming) return results;

  try {
    const cleanQ = simplifyProductQueryForStore(targetQuery);
    const slug = cleanQ.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let itemHtml: string | null = null;

    // 1. Try direct canonical slug first if simple console/game title
    if (slug && slug.length >= 4 && !slug.includes('-edition-') && !slug.includes('-with-')) {
      try {
        const directRes = await fetchWithTimeout(`https://www.dekudeals.com/items/${slug}`, {
          headers: { ...BROWSER_HEADERS, 'Accept': 'text/html' }
        }, 3000);
        if (directRes.ok) {
          const text = await directRes.text();
          if (text.includes('Switch') || text.includes('$')) {
            itemHtml = text;
          }
        }
      } catch {
        // continue to search lookup
      }
    }

    // 2. Fallback to DekuDeals search page
    if (!itemHtml) {
      const searchRes = await fetchWithTimeout(`https://www.dekudeals.com/search?q=${encodeURIComponent(cleanQ)}`, {
        headers: { ...BROWSER_HEADERS, 'Accept': 'text/html' }
      }, 3000);
      if (searchRes.ok) {
        const sHtml = await searchRes.text();
        const $s = cheerio.load(sHtml);
        const candidates: Array<{ href: string; score: number }> = [];
        $s('a[href*="/items/"]').each((_, el) => {
          const href = $s(el).attr('href');
          const txt = $s(el).text().replace(/\s+/g, ' ').trim();
          if (!href || !txt || txt.length < 3) return;
          const sc = scoreStrictMatch(txt, targetQuery);
          if (sc >= 0) candidates.push({ href, score: sc });
        });
        candidates.sort((a, b) => b.score - a.score);
        if (candidates[0]) {
          const itemRes = await fetchWithTimeout(toAbsoluteUrl(candidates[0].href, 'https://www.dekudeals.com'), {
            headers: { ...BROWSER_HEADERS, 'Accept': 'text/html' }
          }, 3000);
          if (itemRes.ok) itemHtml = await itemRes.text();
        }
      }
    }

    if (!itemHtml) return results;

    const $ = cheerio.load(itemHtml);
    const pageTitle = $('h1, .main-title').first().text().replace(/\s+/g, ' ').trim();
    if (pageTitle && scoreStrictMatch(pageTitle, targetQuery) < 0) return results;

    $('table tr').each((_, el) => {
      const row = $(el);
      const storeAlt = (row.find('img').attr('alt') || '').trim();
      const rowText = row.text().replace(/\s+/g, ' ').trim();
      if (!storeAlt || !rowText) return;
      if (/\b(cad|eur|gbp|aud|mxn|jpy)\b/i.test(rowText) || /\bUsed:\b/i.test(rowText)) return;

      const prices = extractPricesFromText(rowText);
      const price = prices[0];
      if (!price || !isPricePlausible(price, amazonPrice)) return;

      const rawHref = row.find('a').first().attr('href');
      if (!rawHref) return;
      const resolvedUrl = unwrapRedirectUrl(toAbsoluteUrl(rawHref, 'https://www.dekudeals.com'));
      const identity = normalizeStoreIdentity(storeAlt);
      if (identity.canonicalKey === 'amazon') return;

      const isSoldOut = /\bsold out\b|\bout of stock\b/i.test(rowText);
      if (!results.has(identity.canonicalKey)) {
        results.set(identity.canonicalKey, {
          retailer: identity.displayName,
          price,
          regularPrice: null,
          url: resolvedUrl,
          inStock: !isSoldOut,
          isLowestPrice: false,
          label: isSoldOut ? 'Out of Stock' : undefined,
          verifiedLive: true
        });
      }
    });
  } catch {
    // DekuDeals lookup failed cleanly
  }

  return results;
}

/**
 * Extracts best USD Product/Offer match from structured JSON-LD scripts in any HTML document.
 */
function extractFromJsonLd(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): { title: string; price: number; regularPrice: number | null; url: string; inStock: boolean; score: number } | null {
  const wantsRefurb = /\b(renewed|refurbished|pre-owned|preowned|used|open[\s-]*box|restored)\b/i.test(targetQuery);
  const candidates: Array<{ title: string; price: number; regularPrice: number | null; url: string; inStock: boolean; score: number }> = [];

  const processNode = (node: any, fallbackTitle?: string, fallbackUrl?: string) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((n) => processNode(n, fallbackTitle, fallbackUrl));
      return;
    }
    if (Array.isArray(node['@graph'])) {
      node['@graph'].forEach((n: any) => processNode(n, fallbackTitle, fallbackUrl));
    }
    if (Array.isArray(node.itemListElement)) {
      node.itemListElement.forEach((n: any) => processNode(n.item || n, fallbackTitle, fallbackUrl));
    }

    const typeRaw = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
    if (!/\bProduct(?:Group)?\b/i.test(typeRaw)) return;

    const title = String(node.name || fallbackTitle || '').replace(/\s+/g, ' ').trim();
    if (!title) return;
    const score = scoreStrictMatch(title, targetQuery);
    if (score < 0) return;

    const productUrl = typeof node.url === 'string' ? toAbsoluteUrl(node.url, baseUrl) : (fallbackUrl || baseUrl);
    const rawOffers = node.offers || node.hasVariant;
    const offersList = Array.isArray(rawOffers) ? rawOffers : rawOffers ? [rawOffers] : [];

    for (const offer of offersList) {
      if (!offer || typeof offer !== 'object') continue;
      if (offer.offers) {
        processNode({ ...offer, '@type': 'Product', name: offer.name || title, url: offer.url || productUrl }, title, productUrl);
        continue;
      }

      const cur = String(offer.priceCurrency || offer.currency || 'USD').toUpperCase();
      if (cur && cur !== 'USD' && cur !== '$') continue;

      const condStr = `${offer.itemCondition || ''} ${offer.name || ''}`;
      const isUsedOffer = /\b(UsedCondition|RefurbishedCondition|Pre-Owned|PreOwned|Refurbished|OpenBox|Damaged)\b/i.test(condStr);
      if (!wantsRefurb && isUsedOffer) continue;

      const parsedPrice = parseUsdNumber(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
      if (parsedPrice === null || !isPricePlausible(parsedPrice, amazonPrice)) continue;

      const regPrice = parseUsdNumber(offer.highPrice);
      const offerUrl = typeof offer.url === 'string' ? toAbsoluteUrl(offer.url, baseUrl) : productUrl;
      const availStr = String(offer.availability || '');
      const inStock = !/OutOfStock|SoldOut|Discontinued/i.test(availStr);
      const conditionBoost = /NewCondition/i.test(condStr) ? 15 : 0;

      candidates.push({
        title,
        price: parsedPrice,
        regularPrice: regPrice && regPrice > parsedPrice ? regPrice : null,
        url: offerUrl,
        inStock,
        score: score + conditionBoost + (inStock ? 5 : 0)
      });
    }
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (!raw) return;
      processNode(JSON.parse(raw));
    } catch {
      // skip invalid json-ld
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

/**
 * Live GameStop resolver: queries GameStop search for matching PIDs and pulls verified
 * New-condition USD pricing directly from GameStop PDP JSON-LD, with DekuDeals & Jina backup.
 */
export async function resolveGameStopLiveProduct(
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn,
  dekuOffers?: Map<string, InternalComparison>
): Promise<InternalComparison | null> {
  const dekuMatch = dekuOffers?.get('gamestop');
  const cleanQ = simplifyProductQueryForStore(targetQuery);

  try {
    const searchUrl = `https://www.gamestop.com/search/?q=${encodeURIComponent(cleanQ)}`;
    const searchRes = await fetchWithTimeout(searchUrl, {
      headers: { ...BROWSER_HEADERS, 'Accept': 'text/html,application/xhtml+xml' }
    }, 3600);

    if (searchRes.ok) {
      const searchHtml = await searchRes.text();
      const pids = [...new Set([...searchHtml.matchAll(/data-pid="([0-9A-Za-z]+)"/g)].map(m => m[1]))].slice(0, 4);

      if (pids.length > 0) {
        const pdpResults = await Promise.all(
          pids.map(async (pid) => {
            try {
              const pdpRes = await fetchWithTimeout(`https://www.gamestop.com/${pid}.html`, {
                headers: { ...BROWSER_HEADERS, 'Accept': 'text/html,application/xhtml+xml' },
                redirect: 'follow'
              }, 3500);
              if (!pdpRes.ok) return null;
              const html = await pdpRes.text();
              const $ = cheerio.load(html);
              const bestLd = extractFromJsonLd($, pdpRes.url || searchUrl, targetQuery, amazonPrice, scoreStrictMatch);
              if (bestLd) return bestLd;
            } catch {
              return null;
            }
            return null;
          })
        );

        const valid = pdpResults.filter((x): x is NonNullable<typeof x> => Boolean(x)).sort((a, b) => b.score - a.score);
        if (valid[0]) {
          return {
            retailer: 'GameStop',
            price: valid[0].price,
            regularPrice: valid[0].regularPrice,
            url: valid[0].url,
            inStock: valid[0].inStock,
            isLowestPrice: false,
            label: valid[0].inStock ? 'GameStop Price' : 'Out of Stock',
            verifiedLive: true
          };
        }
      }
    }
  } catch {
    // fallback below
  }

  if (dekuMatch) return dekuMatch;
  return null;
}

/**
 * Live Apple Store resolver: searches apple.com/us/search and extracts SKU-exact price
 * from Apple's interactive buy page matrix or JSON-LD offers.
 */
export async function resolveAppleLiveProduct(
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): Promise<InternalComparison | null> {
  const isAppleProduct = /\b(apple|iphone|ipad|macbook|imac|mac\s*(?:mini|studio|pro)|airpods|watch\s*(?:se|series|ultra)|apple\s*watch|airtag|homepod|apple\s*tv|apple\s*pencil|magic\s*(?:keyboard|mouse|trackpad)|beats|vision\s*pro|studio\s*display)\b/i.test(targetQuery);
  if (!isAppleProduct) {
    return {
      retailer: 'Apple',
      price: null,
      regularPrice: null,
      url: `https://www.apple.com/us/search/${encodeURIComponent(simplifyProductQueryForStore(targetQuery))}?src=globalnav`,
      inStock: false,
      isLowestPrice: false,
      label: 'Not Sold',
      statusReason: 'not_found',
      verifiedLive: false
    };
  }

  try {
    const cleanQ = simplifyProductQueryForStore(targetQuery);
    const searchUrl = `https://www.apple.com/us/search/${encodeURIComponent(cleanQ)}?src=globalnav`;
    const sr = await fetchWithTimeout(searchUrl, {
      headers: { ...BROWSER_HEADERS, 'Accept': 'text/html' }
    }, 3500);
    if (!sr.ok) return null;

    const sHtml = await sr.text();
    const $s = cheerio.load(sHtml);
    const candidates: Array<{ url: string; score: number }> = [];

    $s('a[href*="/shop/"]').each((_, el) => {
      const href = $s(el).attr('href');
      if (!href || /\/shop\/accessories|\/shop\/refurbished|carrier-offers/i.test(href)) return;
      const absUrl = toAbsoluteUrl(href.split('?')[0], 'https://www.apple.com');
      const linkText = $s(el).text().replace(/\s+/g, ' ').trim();
      const slugText = absUrl.replace(/https?:\/\/www\.apple\.com\/(?:us\/)?shop\/(?:buy-[a-z]+\/|product\/[^/]+\/[^/]+\/)?/i, '').replace(/[-/]+/g, ' ');
      const candidateTitle = /^https?:\/\//i.test(linkText) || linkText.length < 3 ? slugText : `${linkText} ${slugText}`;
      // Apple buy slugs often drop the generation number (e.g. /shop/buy-watch/apple-watch-se), so match base keywords here
      // and verify exact model/price on the PDP itself.
      const qWords = cleanQ.toLowerCase().split(/\s+/).filter(w => w.length >= 2 && !/^(apple|gps|cellular|40mm|44mm|41mm|45mm|49mm|256gb|512gb|128gb|\d+)$/i.test(w));
      const combinedLower = candidateTitle.toLowerCase();
      const matchedWords = qWords.filter(w => combinedLower.includes(w)).length;
      const sc = scoreStrictMatch(candidateTitle, targetQuery);
      if ((sc >= 0 || (qWords.length > 0 && matchedWords === qWords.length)) && !candidates.some(c => c.url === absUrl)) {
        candidates.push({ url: absUrl, score: (sc >= 0 ? sc : matchedWords * 25) + (absUrl.includes('/shop/buy-') ? 20 : 0) });
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    const targetUrl = candidates[0]?.url;
    if (!targetUrl) return null;

    const pdpRes = await fetchWithTimeout(targetUrl, {
      headers: { ...BROWSER_HEADERS, 'Accept': 'text/html' }
    }, 3500);
    if (!pdpRes.ok) return null;
    const pdpHtml = await pdpRes.text();

    // 1. Direct priceKey -> amount lookup from Apple buy page pricing map (e.g. watch_cases-aluminum-40mm-gps)
    const applePriceEntries = [...pdpHtml.matchAll(/"([a-z0-9_-]{8,80})":\{[^{}]{0,350}"amount":([0-9]+(?:\.[0-9]{2})?)/gi)]
      .map(m => ({ key: m[1].toLowerCase(), amount: Number(m[2]) }))
      .filter(e => !Number.isNaN(e.amount) && isPricePlausible(e.amount, amazonPrice));

    if (applePriceEntries.length > 0) {
      const wantsCell = /\b(cellular|lte|5g)\b/i.test(targetQuery);
      const sizeMatch = targetQuery.match(/\b([0-9]{2}\s*mm|[0-9]{2}-?inch)\b/i);
      const targetSize = sizeMatch ? sizeMatch[1].toLowerCase().replace(/\s+/g, '') : null;

      const scoredEntries = applePriceEntries
        .map((e) => {
          let s = 0;
          if (/\bwatch\b/i.test(targetQuery)) {
            const isCell = /gpscell|cellular|lte/.test(e.key);
            if (wantsCell && isCell) s += 25;
            else if (!wantsCell && !isCell && /gps/.test(e.key)) s += 25;
            else if (!wantsCell && isCell) s -= 25;
          }
          if (targetSize && e.key.includes(targetSize)) s += 20;
          if (e.key.includes('aluminum')) s += 8;
          if (e.key.includes('titanium') && !/\btitanium\b/i.test(targetQuery)) s -= 15;
          return { ...e, s };
        })
        .sort((a, b) => b.s - a.s || a.amount - b.amount);

      if (scoredEntries[0] && scoredEntries[0].s >= 0) {
        return {
          retailer: 'Apple',
          price: Number(scoredEntries[0].amount.toFixed(2)),
          regularPrice: null,
          url: targetUrl,
          inStock: true,
          isLowestPrice: false,
          label: 'Apple Retail',
          verifiedLive: true
        };
      }
    }

    // 2. Fallback to Apple JSON-LD Offer/AggregateOffer
    const $p = cheerio.load(pdpHtml);
    const ldMatch = extractFromJsonLd($p, targetUrl, targetQuery, amazonPrice, scoreStrictMatch);
    if (ldMatch) {
      return {
        retailer: 'Apple',
        price: ldMatch.price,
        regularPrice: ldMatch.regularPrice,
        url: targetUrl,
        inStock: ldMatch.inStock,
        isLowestPrice: false,
        label: 'Apple Retail',
        verifiedLive: true
      };
    }

    // 3. Fallback single-product "amount" (e.g. AirPods Pro 3 -> "amount":249.00)
    const amts = [...pdpHtml.matchAll(/"amount"\s*:\s*([0-9]+\.[0-9]{2})/g)]
      .map(m => Number(m[1]))
      .filter(n => isPricePlausible(n, amazonPrice));
    if (amts.length > 0) {
      const price = Number(Math.min(...amts).toFixed(2));
      return {
        retailer: 'Apple',
        price,
        regularPrice: null,
        url: targetUrl,
        inStock: true,
        isLowestPrice: false,
        label: 'Apple Retail',
        verifiedLive: true
      };
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Live Staples resolver via Staples Next.js SSR productTileData.
 */
export async function resolveStaplesLiveProduct(
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): Promise<InternalComparison | null> {
  try {
    const cleanQ = simplifyProductQueryForStore(targetQuery);
    const searchUrl = `https://www.staples.com/${encodeURIComponent(cleanQ)}/directory_${encodeURIComponent(cleanQ)}`;
    const res = await fetchWithTimeout(searchUrl, {
      headers: { ...BROWSER_HEADERS, 'Accept': 'text/html' }
    }, 3600);
    if (!res.ok) return null;

    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    const data = JSON.parse(m[1]);
    const items: any[] = data?.props?.initialStateOrStore?.searchState?.productTileData || [];

    const ranked = items
      .map((item) => {
        const title = String(item?.title || '').trim();
        const price = parseUsdNumber(item?.activePrice ?? item?.finalPrice ?? item?.price);
        const url = item?.url ? toAbsoluteUrl(item.url, 'https://www.staples.com') : null;
        const score = title ? scoreStrictMatch(title, targetQuery) : -1;
        return { title, price, url, score };
      })
      .filter((x) => x.score >= 0 && x.price !== null && x.url && isPricePlausible(x.price, amazonPrice))
      .sort((a, b) => b.score - a.score);

    if (ranked[0]) {
      return {
        retailer: 'Staples',
        price: ranked[0].price,
        regularPrice: null,
        url: ranked[0].url!,
        inStock: true,
        isLowestPrice: false,
        label: 'Staples Price',
        verifiedLive: true
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Parses Markdown product listings (e.g., from r.jina.ai rendered store search pages)
 * by pairing [Title](productUrl) links with nearby USD $prices.
 */
function extractBestProductFromMarkdown(
  markdown: string,
  domain: string,
  displayName: string,
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): InternalComparison | null {
  const lines = markdown.split('\n');
  const candidates: Array<{ title: string; url: string; price: number; regularPrice: number | null; inStock: boolean; score: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    // Strip nested markdown images `![...](...)` before parsing outer product links `[Title](url)`
    const line = lines[i].replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
    // Look for Markdown links that are actual product headings or links on the target domain
    const linkMatches = [...line.matchAll(/\[([^\]\n]{6,200})\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g)];
    for (const lm of linkMatches) {
      const rawTitle = lm[1].replace(/[*_`!]/g, '').replace(/^Image\s*\d+:\s*/i, '').trim();
      const rawUrl = lm[2];

      if (!hostnameMatchesDomain(rawUrl, domain)) continue;
      if (/\/(?:reviews|cart|add-to-cart|login|account|help|giftcards|explora)\b/i.test(rawUrl)) continue;
      if (/^Image\s*\d+/i.test(lm[1]) || /^Add to Cart$/i.test(rawTitle)) continue;

      const score = scoreStrictMatch(rawTitle, targetQuery);
      if (score < 0) continue;

      // Scan up to 45 lines before the next product card/heading for prices (handles multi-line feature bullets + blank lines)
      const windowLines: string[] = [];
      for (let j = i; j < Math.min(lines.length, i + 45); j++) {
        if (j > i && (/^#{1,4}\s+\[/.test(lines[j]) || /^\[!\[Image\s+\d+/i.test(lines[j]))) break;
        windowLines.push(lines[j]);
      }
      const block = windowLines.join(' ');
      if (/\bCAD\b|\bEUR\b|\bGBP\b/i.test(block)) continue;

      // Capture crossed-out regular price if present (~~$379.00~~)
      const regMatch = block.match(/~~\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)~~/);
      const regularPrice = regMatch ? parseUsdNumber(regMatch[1]) : null;

      // Strip savings phrases ("Savings $150.00", "Save $50") before parsing selling price
      const cleanedBlock = block
        .replace(/~~\$[0-9,.]+~~/g, ' ')
        .replace(/(?:Savings?|Save|Off|Bonus)[:\s]*\$[0-9,.]+/gi, ' ');
      const prices = extractPricesFromText(cleanedBlock).filter((p) => isPricePlausible(p, amazonPrice));
      if (prices.length === 0) continue;

      const price = prices[0];
      const inStock = !/\bout of stock\b|\bsold out\b|\btemporarily unavailable\b/i.test(block);

      candidates.push({
        title: rawTitle,
        url: rawUrl,
        price,
        regularPrice: regularPrice && regularPrice > price ? regularPrice : null,
        inStock,
        score: score + (inStock ? 5 : 0)
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  if (!candidates[0]) return null;

  const top = candidates[0];
  const isSale = typeof top.regularPrice === 'number' && top.regularPrice > top.price;
  return {
    retailer: displayName,
    price: top.price,
    regularPrice: top.regularPrice,
    url: top.url,
    inStock: top.inStock,
    isLowestPrice: false,
    label: !top.inStock ? 'Out of Stock' : isSale ? 'Sale' : `${displayName} Price`,
    verifiedLive: true
  };
}

/**
 * Extracts price from a single product detail page's Markdown (e.g. from r.jina.ai)
 * where the product title sits in Title:/# H1 rather than an anchor tag.
 */
function extractBestProductFromSinglePdpMarkdown(
  markdown: string,
  pdpUrl: string,
  displayName: string,
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): InternalComparison | null {
  const titleLineMatch = markdown.match(/^Title:\s*(.+)$/m) || markdown.match(/^#\s+(.+)$/m);
  const pageTitle = titleLineMatch?.[1]?.replace(/\|.*$/, '').trim() || '';
  if (!pageTitle || scoreStrictMatch(pageTitle, targetQuery) < 0) return null;

  const contentIdx = markdown.indexOf('Markdown Content:');
  const body = (contentIdx >= 0 ? markdown.slice(contentIdx) : markdown).slice(0, 5000);
  if (/\bCAD\b|\bEUR\b|\bGBP\b/i.test(body.slice(0, 1200))) return null;

  const cleanedBody = body
    .replace(/~~\$[0-9,.]+~~/g, ' ')
    .replace(/(?:Savings?|Save|Off|Trade in|Trade-in)[:\s]*\$[0-9,.]+/gi, ' ');
  const prices = extractPricesFromText(cleanedBody).filter((p) => isPricePlausible(p, amazonPrice));
  if (prices.length === 0) return null;

  const inStock = !/\bout of stock\b|\bsold out\b|\bcurrently unavailable\b/i.test(body.slice(0, 2000));
  return {
    retailer: displayName,
    price: prices[0],
    regularPrice: null,
    url: pdpUrl,
    inStock,
    isLowestPrice: false,
    label: inStock ? `${displayName} Price` : 'Out of Stock',
    verifiedLive: true
  };
}

/**
 * Resolves live eBay Brand-New market/listing data for gaming & electronics via PriceCharting
 * when eBay directly challenges datacenter HTTP requests.
 */
export async function resolveEbayLiveProduct(
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): Promise<InternalComparison | null> {
  const cleanQ = simplifyProductQueryForStore(targetQuery);
  const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(cleanQ)}&LH_BIN=1&LH_ItemCondition=1000`;

  try {
    const pcUrl = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(cleanQ)}&type=prices`;
    const res = await fetchWithTimeout(pcUrl, {
      headers: { ...BROWSER_HEADERS, 'Accept': 'text/html' }
    }, 3600);
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);
    const wantsUsed = /\b(renewed|refurbished|pre-owned|preowned|used)\b/i.test(targetQuery);

    const rows: Array<{ title: string; href: string; price: number; score: number }> = [];
    $('tr[id^="product-"], table#games_table tr').each((_, el) => {
      const title = $(el).find('.title a').first().text().replace(/\s+/g, ' ').trim();
      const href = $(el).find('.title a').first().attr('href');
      if (!title || !href) return;

      const sc = scoreStrictMatch(title, targetQuery);
      if (sc < 0) return;

      const priceText = wantsUsed
        ? ($(el).find('.used_price').text().trim() || $(el).find('.cib_price').text().trim())
        : ($(el).find('.new_price').text().trim() || $(el).find('.cib_price').text().trim());

      const price = parseUsdNumber(priceText);
      if (price && isPricePlausible(price, amazonPrice)) {
        rows.push({ title, href: toAbsoluteUrl(href, 'https://www.pricecharting.com'), price, score: sc });
      }
    });

    rows.sort((a, b) => b.score - a.score);
    if (rows[0]) {
      return {
        retailer: 'eBay',
        price: rows[0].price,
        regularPrice: null,
        url: ebaySearchUrl,
        inStock: true,
        isLowestPrice: false,
        label: wantsUsed ? 'eBay Market' : 'eBay New Avg',
        verifiedLive: true
      };
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Recursively hunts __NEXT_DATA__ payloads on unknown retail websites for product objects.
 */
function extractFromNextData(
  html: string,
  baseUrl: string,
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): { title: string; price: number; url: string; score: number } | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let root: any;
  try {
    root = JSON.parse(m[1]);
  } catch {
    return null;
  }

  const hits: Array<{ title: string; price: number; url: string; score: number }> = [];
  const visited = new Set<any>();

  const walk = (node: any, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 12 || visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      for (const item of node.slice(0, 60)) walk(item, depth + 1);
      return;
    }

    const title = node.title || node.name || node.productName;
    const rawPrice = node.price ?? node.currentPrice ?? node.activePrice ?? node.finalPrice ?? node.priceInfo?.currentPrice?.price ?? node.priceInfo?.linePrice;
    const urlField = node.url || node.canonicalUrl || node.pdpUrl || node.link;

    if (typeof title === 'string' && title.length >= 4 && rawPrice !== undefined) {
      const price = parseUsdNumber(rawPrice);
      const sc = scoreStrictMatch(title, targetQuery);
      if (sc >= 0 && price !== null && isPricePlausible(price, amazonPrice)) {
        hits.push({
          title,
          price,
          url: typeof urlField === 'string' ? toAbsoluteUrl(urlField, baseUrl) : baseUrl,
          score: sc
        });
      }
    }

    for (const val of Object.values(node)) {
      if (val && typeof val === 'object') walk(val, depth + 1);
    }
  };

  walk(root, 0);
  hits.sort((a, b) => b.score - a.score);
  return hits[0] || null;
}

/**
 * Generic HTML product/price extractor across JSON-LD, __NEXT_DATA__, Microdata/OG, and product tiles.
 */
function extractBestProductFromHtml(
  html: string,
  baseUrl: string,
  displayName: string,
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): { comparison: InternalComparison | null; candidatePdpUrl: string | null } {
  const $ = cheerio.load(html);

  // 1. JSON-LD Product / Offer
  const ld = extractFromJsonLd($, baseUrl, targetQuery, amazonPrice, scoreStrictMatch);
  if (ld) {
    return {
      comparison: {
        retailer: displayName,
        price: ld.price,
        regularPrice: ld.regularPrice,
        url: ld.url,
        inStock: ld.inStock,
        isLowestPrice: false,
        label: ld.inStock ? `${displayName} Price` : 'Out of Stock',
        verifiedLive: true
      },
      candidatePdpUrl: ld.url
    };
  }

  // 2. __NEXT_DATA__ deep walk
  const nextHit = extractFromNextData(html, baseUrl, targetQuery, amazonPrice, scoreStrictMatch);
  if (nextHit) {
    return {
      comparison: {
        retailer: displayName,
        price: nextHit.price,
        regularPrice: null,
        url: nextHit.url,
        inStock: true,
        isLowestPrice: false,
        label: `${displayName} Price`,
        verifiedLive: true
      },
      candidatePdpUrl: nextHit.url
    };
  }

  // 3. OpenGraph / Microdata single-product PDP tags
  const pageTitle = ($('h1').first().text() || $('meta[property="og:title"]').attr('content') || $('title').text() || '').replace(/\s+/g, ' ').trim();
  const metaPrice = parseUsdNumber(
    $('meta[property="product:price:amount"]').attr('content') ||
    $('meta[property="og:price:amount"]').attr('content') ||
    $('[itemprop="price"]').first().attr('content') ||
    $('[itemprop="price"]').first().text()
  );
  if (pageTitle && metaPrice !== null && scoreStrictMatch(pageTitle, targetQuery) >= 0 && isPricePlausible(metaPrice, amazonPrice)) {
    return {
      comparison: {
        retailer: displayName,
        price: metaPrice,
        regularPrice: null,
        url: baseUrl,
        inStock: true,
        isLowestPrice: false,
        label: `${displayName} Price`,
        verifiedLive: true
      },
      candidatePdpUrl: baseUrl
    };
  }

  // 4. HTML product tiles & anchor-adjacent price pairing
  const tileCandidates: Array<{ title: string; url: string; price: number | null; score: number }> = [];
  $('[itemtype*="Product"], .product-tile, .product-card, .product-item, .grid-item, article, li').each((_, el) => {
    const $el = $(el);
    const links = $el.find('a[href]');
    let bestTitle = '';
    let bestHref = '';
    links.each((__, a) => {
      const t = $(a).text().replace(/\s+/g, ' ').trim();
      const h = $(a).attr('href') || '';
      if (t.length > bestTitle.length && !t.includes('$') && !/review|compare|cart|login/i.test(h)) {
        bestTitle = t;
        bestHref = h;
      }
    });
    if (!bestTitle || !bestHref) return;
    const sc = scoreStrictMatch(bestTitle, targetQuery);
    if (sc < 0) return;

    const tileText = $el.text().replace(/\s+/g, ' ').trim();
    if (/\bCAD\b|\bEUR\b|\bGBP\b/i.test(tileText)) return;
    const prices = extractPricesFromText(tileText).filter(p => isPricePlausible(p, amazonPrice));
    tileCandidates.push({
      title: bestTitle,
      url: toAbsoluteUrl(bestHref, baseUrl),
      price: prices[0] ?? null,
      score: sc + (prices[0] ? 10 : 0)
    });
  });

  tileCandidates.sort((a, b) => b.score - a.score);
  const topTile = tileCandidates[0];
  if (topTile?.price) {
    return {
      comparison: {
        retailer: displayName,
        price: topTile.price,
        regularPrice: null,
        url: topTile.url,
        inStock: true,
        isLowestPrice: false,
        label: `${displayName} Price`,
        verifiedLive: true
      },
      candidatePdpUrl: topTile.url
    };
  }

  // Record highest scoring PDP-like anchor even if tile omitted price (can follow up once)
  let bestPdpUrl = topTile?.url || null;
  if (!bestPdpUrl) {
    const linkHits: Array<{ url: string; score: number }> = [];
    $('a[href]').each((_, a) => {
      const h = $(a).attr('href');
      const t = $(a).text().replace(/\s+/g, ' ').trim();
      if (!h || !t || t.length < 5) return;
      if (!/\/(?:p|pd|ip|product|products|item|itm)\/|\.html(?:\?|$)/i.test(h)) return;
      const sc = scoreStrictMatch(t, targetQuery);
      if (sc >= 0) linkHits.push({ url: toAbsoluteUrl(h, baseUrl), score: sc });
    });
    linkHits.sort((a, b) => b.score - a.score);
    bestPdpUrl = linkHits[0]?.url || null;
  }

  return { comparison: null, candidatePdpUrl: bestPdpUrl };
}

/**
 * Tries Shopify's universal JSON search endpoint (/search/suggest.json).
 */
async function tryShopifyStoreSearch(
  identity: StoreIdentity,
  cleanQ: string,
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): Promise<InternalComparison | null> {
  const hosts = [`https://www.${identity.domain}`, `https://${identity.domain}`];
  for (const host of hosts) {
    try {
      const apiUrl = `${host}/search/suggest.json?q=${encodeURIComponent(cleanQ)}&resources[type]=product&resources[limit]=8`;
      const res = await fetchWithTimeout(apiUrl, {
        headers: { ...BROWSER_HEADERS, 'Accept': 'application/json' }
      }, 2400);
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) continue;

      const data: any = await res.json();
      const products: any[] = data?.resources?.results?.products || [];
      const ranked = products
        .map((p) => {
          const title = String(p?.title || '').trim();
          const price = parseUsdNumber(p?.price);
          const regPrice = parseUsdNumber(p?.compare_at_price_max ?? p?.compare_at_price_min);
          const sc = title ? scoreStrictMatch(title, targetQuery) : -1;
          return { title, price, regPrice, url: toAbsoluteUrl(p?.url || '', host), available: p?.available !== false, score: sc };
        })
        .filter((x) => x.score >= 0 && x.price !== null && isPricePlausible(x.price, amazonPrice))
        .sort((a, b) => b.score - a.score);

      if (ranked[0]) {
        const best = ranked[0];
        const isSale = typeof best.regPrice === 'number' && best.regPrice > (best.price as number);
        return {
          retailer: identity.displayName,
          price: best.price,
          regularPrice: best.regPrice,
          url: best.url,
          inStock: best.available,
          isLowestPrice: false,
          label: !best.available ? 'Out of Stock' : isSale ? 'Sale' : `${identity.displayName} Price`,
          verifiedLive: true
        };
      }
      return null; // valid Shopify JSON returned but no match
    } catch {
      // try without www or move on
    }
  }
  return null;
}

/**
 * Tries WooCommerce's universal Store API (/wp-json/wc/store/v1/products).
 */
async function tryWooCommerceStoreSearch(
  identity: StoreIdentity,
  cleanQ: string,
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn
): Promise<InternalComparison | null> {
  try {
    const apiUrl = `https://www.${identity.domain}/wp-json/wc/store/v1/products?search=${encodeURIComponent(cleanQ)}&per_page=8`;
    const res = await fetchWithTimeout(apiUrl, {
      headers: { ...BROWSER_HEADERS, 'Accept': 'application/json' }
    }, 2400);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) return null;

    const items = await res.json();
    if (!Array.isArray(items)) return null;

    const ranked = items
      .map((item) => {
        const title = String(item?.name || '').trim();
        const minor = Number(item?.prices?.currency_minor_unit ?? 2);
        const cur = String(item?.prices?.currency_code || 'USD').toUpperCase();
        const rawPrice = Number(item?.prices?.price);
        const rawReg = Number(item?.prices?.regular_price);
        const price = Number.isFinite(rawPrice) && rawPrice > 0 ? Number((rawPrice / Math.pow(10, minor)).toFixed(2)) : null;
        const regPrice = Number.isFinite(rawReg) && rawReg > 0 ? Number((rawReg / Math.pow(10, minor)).toFixed(2)) : null;
        const sc = cur === 'USD' && title ? scoreStrictMatch(title, targetQuery) : -1;
        return {
          title,
          price,
          regPrice: regPrice && price && regPrice > price ? regPrice : null,
          url: String(item?.permalink || identity.buildSearchUrl(cleanQ)),
          inStock: item?.is_in_stock !== false,
          score: sc
        };
      })
      .filter((x) => x.score >= 0 && x.price !== null && isPricePlausible(x.price, amazonPrice))
      .sort((a, b) => b.score - a.score);

    if (ranked[0]) {
      const best = ranked[0];
      return {
        retailer: identity.displayName,
        price: best.price,
        regularPrice: best.regPrice,
        url: best.url,
        inStock: best.inStock,
        isLowestPrice: false,
        label: best.inStock ? `${identity.displayName} Price` : 'Out of Stock',
        verifiedLive: true
      };
    }
  } catch {
    // not WooCommerce
  }
  return null;
}

/**
 * Universal resolver for ANY custom store name or arbitrary retail website entered by the user.
 * Chains specialized extractors -> Shopify/WooCommerce APIs -> direct HTML/JSON-LD search ->
 * headless Markdown extraction (r.jina.ai) -> web search PDP discovery.
 */
export async function resolveUniversalCustomStore(
  identity: StoreIdentity,
  targetQuery: string,
  amazonPrice: number,
  scoreStrictMatch: ScoreMatcherFn,
  dekuOffers?: Map<string, InternalComparison>,
  options?: { allowSerperSite?: boolean }
): Promise<InternalComparison> {
  const cleanQ = simplifyProductQueryForStore(targetQuery);
  const fallbackSearchUrl = identity.buildSearchUrl(cleanQ);

  // 0. Check pre-fetched DekuDeals cross-store table (free)
  const dekuHit = dekuOffers?.get(identity.canonicalKey);
  if (dekuHit) return dekuHit;

  // 1. Specialized high-accuracy store resolvers
  if (identity.canonicalKey === 'gamestop') {
    const gs = await resolveGameStopLiveProduct(targetQuery, amazonPrice, scoreStrictMatch, dekuOffers);
    if (gs) return gs;
  }
  if (identity.canonicalKey === 'apple') {
    const apple = await resolveAppleLiveProduct(targetQuery, amazonPrice, scoreStrictMatch);
    if (apple) return apple;
    return {
      retailer: 'Apple',
      price: null,
      regularPrice: null,
      url: fallbackSearchUrl,
      inStock: false,
      isLowestPrice: false,
      label: 'Not Listed',
      statusReason: 'not_found',
      verifiedLive: false
    };
  }
  if (identity.canonicalKey === 'staples') {
    const staples = await resolveStaplesLiveProduct(targetQuery, amazonPrice, scoreStrictMatch);
    if (staples) return staples;
  }
  if (identity.canonicalKey === 'ebay') {
    const ebay = await resolveEbayLiveProduct(targetQuery, amazonPrice, scoreStrictMatch);
    if (ebay) return ebay;
  }

  let sawBlocked = false;
  let sawReadableSearchPage = false;

  // 2. Concurrent Shopify + WooCommerce fast platform probes (free)
  const [shopifyHit, wooHit] = await Promise.all([
    tryShopifyStoreSearch(identity, cleanQ, targetQuery, amazonPrice, scoreStrictMatch),
    tryWooCommerceStoreSearch(identity, cleanQ, targetQuery, amazonPrice, scoreStrictMatch)
  ]);
  if (shopifyHit) return shopifyHit;
  if (wooHit) return wooHit;

  // 3. Cookie-warmed Direct Store Search HTML + Universal JSON-LD / __NEXT_DATA__ / Tile Extractor
  const candidateSearchUrls = Array.from(new Set([
    fallbackSearchUrl,
    `https://www.${identity.domain}/search?q=${encodeURIComponent(cleanQ)}`,
    `https://www.${identity.domain}/?s=${encodeURIComponent(cleanQ)}`,
    `https://www.${identity.domain}/catalogsearch/result/?q=${encodeURIComponent(cleanQ)}`
  ])).slice(0, 3);

  let sessionCookie = '';
  try {
    const homeRes = await fetchWithTimeout(`https://www.${identity.domain}/`, {
      headers: { ...BROWSER_HEADERS, 'Accept': 'text/html' }
    }, 2200);
    const rawCookies = (homeRes.headers as any).getSetCookie ? (homeRes.headers as any).getSetCookie() : [];
    sessionCookie = rawCookies.map((c: string) => c.split(';')[0]).join('; ');
    if (isBlockedHtmlOrStatus(homeRes.status, 'ok')) {
      sawBlocked = true;
    }
  } catch {
    // proceed without warmup cookies
  }

  let discoveredPdpUrl: string | null = null;
  for (const sUrl of candidateSearchUrls) {
    try {
      const sRes = await fetchWithTimeout(sUrl, {
        headers: {
          ...BROWSER_HEADERS,
          'Accept': 'text/html,application/xhtml+xml',
          ...(sessionCookie ? { Cookie: sessionCookie, Referer: `https://www.${identity.domain}/` } : {})
        }
      }, 2800);
      const html = sRes.ok ? await sRes.text() : '';
      if (isBlockedHtmlOrStatus(sRes.status, html)) {
        if (sRes.status === 403 || sRes.status === 429) sawBlocked = true;
        continue;
      }
      if (sRes.ok && html.length > 1000) {
        sawReadableSearchPage = true;
        const { comparison, candidatePdpUrl } = extractBestProductFromHtml(
          html,
          sRes.url || sUrl,
          identity.displayName,
          targetQuery,
          amazonPrice,
          scoreStrictMatch
        );
        if (comparison) return comparison;
        if (candidatePdpUrl && !discoveredPdpUrl) discoveredPdpUrl = candidatePdpUrl;
        break;
      }
    } catch {
      // try next search URL shape
    }
  }

  // Follow discovered PDP URL directly if search HTML gave a product link without inline price
  if (discoveredPdpUrl) {
    try {
      const pRes = await fetchWithTimeout(discoveredPdpUrl, {
        headers: {
          ...BROWSER_HEADERS,
          'Accept': 'text/html,application/xhtml+xml',
          ...(sessionCookie ? { Cookie: sessionCookie } : {})
        }
      }, 2800);
      const pHtml = pRes.ok ? await pRes.text() : '';
      if (pRes.ok && !isBlockedHtmlOrStatus(pRes.status, pHtml)) {
        const { comparison } = extractBestProductFromHtml(
          pHtml,
          pRes.url || discoveredPdpUrl,
          identity.displayName,
          targetQuery,
          amazonPrice,
          scoreStrictMatch
        );
        if (comparison) return comparison;
      }
    } catch {
      // move on
    }
  }

  let blockedPdpUrl: string | null = null;

  // 4. Headless Markdown Reader (r.jina.ai) — works cleanly on Cloudflare / SPA stores like B&H Photo, Crutchfield, etc.
  try {
    const jinaRes = await fetchWithTimeout(`https://r.jina.ai/${fallbackSearchUrl}`, {
      headers: { 'Accept': 'text/plain' }
    }, 7800);
    if (jinaRes.ok) {
      const md = await jinaRes.text();
      if (!isBlockedHtmlOrStatus(200, md)) {
        sawReadableSearchPage = true;
        const mdHit = extractBestProductFromMarkdown(
          md,
          identity.domain,
          identity.displayName,
          targetQuery,
          amazonPrice,
          scoreStrictMatch
        );
        if (mdHit) return mdHit;
      } else {
        sawBlocked = true;
      }
    }
  } catch {
    // move to web discovery
  }

  // 5. Web Index Discovery Fallback (BingRSS + r.jina.ai DuckDuckGo site:<domain>) -> scrape discovered PDP
  try {
    const [bingUrl, ddgUrl] = await Promise.all([
      (async (): Promise<string | null> => {
        try {
          const r = await fetchWithTimeout(`https://www.bing.com/search?q=${encodeURIComponent(`${cleanQ} ${identity.displayName}`)}&format=rss&setlang=en-US&cc=US`, {
            headers: BROWSER_HEADERS
          }, 2600);
          if (!r.ok) return null;
          const xml = await r.text();
          const links = [...xml.matchAll(/<link>([\s\S]*?)<\/link>/g)].map(m => m[1].trim());
          return links.find((u) =>
            hostnameMatchesDomain(u, identity.domain) &&
            u.length > `https://www.${identity.domain}/`.length + 4 &&
            !/sponsored[-_]?ad|sellers\/category\/sponsored|\.pdf(\?|$)|\/lit_files\//i.test(u)
          ) || null;
        } catch {
          return null;
        }
      })(),
      (async (): Promise<string | null> => {
        try {
          const r = await fetchWithTimeout(`https://r.jina.ai/https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${identity.domain} ${cleanQ}`)}`, {
            headers: { 'Accept': 'text/plain' }
          }, 4200);
          if (!r.ok) return null;
          const md = await r.text();
          for (const m of md.matchAll(/\[([^\]\n]{6,160})\]\((https?:\/\/[^\s)]+)\)/g)) {
            const linkTitle = m[1].trim();
            if (/sponsored\s*ad/i.test(linkTitle)) continue;
            const unwrapped = unwrapRedirectUrl(m[2]);
            if (
              hostnameMatchesDomain(unwrapped, identity.domain) &&
              !/ad_domain|duckduckgo\.com|sponsored[-_]?ad|sellers\/category\/sponsored|\.pdf(\?|$)|\/lit_files\//i.test(unwrapped) &&
              scoreStrictMatch(linkTitle, targetQuery) >= 0
            ) {
              return unwrapped;
            }
          }
          return null;
        } catch {
          return null;
        }
      })()
    ]);

    const pdpTarget = ddgUrl || bingUrl;
    if (pdpTarget) {
      // Fetch direct PDP first
      try {
        const directPdp = await fetchWithTimeout(pdpTarget, {
          headers: { ...BROWSER_HEADERS, 'Accept': 'text/html,application/xhtml+xml' }
        }, 3000);
        const pdpHtml = directPdp.ok ? await directPdp.text() : '';
        if (directPdp.ok && !isBlockedHtmlOrStatus(directPdp.status, pdpHtml)) {
          const { comparison } = extractBestProductFromHtml(
            pdpHtml,
            directPdp.url || pdpTarget,
            identity.displayName,
            targetQuery,
            amazonPrice,
            scoreStrictMatch
          );
          if (comparison) return comparison;
        } else if (isBlockedHtmlOrStatus(directPdp.status, pdpHtml)) {
          blockedPdpUrl = pdpTarget;
        }
      } catch {
        // try jina reader on discovered PDP
      }

      try {
        const jinaPdp = await fetchWithTimeout(`https://r.jina.ai/${pdpTarget}`, {
          headers: { 'Accept': 'text/plain' }
        }, 4500);
        if (jinaPdp.ok) {
          const md = await jinaPdp.text();
          if (!isBlockedHtmlOrStatus(200, md)) {
            blockedPdpUrl = null;
            const mdHit =
              extractBestProductFromSinglePdpMarkdown(
                md,
                pdpTarget,
                identity.displayName,
                targetQuery,
                amazonPrice,
                scoreStrictMatch
              ) ||
              extractBestProductFromMarkdown(
                md,
                identity.domain,
                identity.displayName,
                targetQuery,
                amazonPrice,
                scoreStrictMatch
              );
            if (mdHit) return mdHit;
          } else {
            sawBlocked = true;
            blockedPdpUrl = pdpTarget;
          }
        }
      } catch {
        // exhausted all channels
      }
    }
  } catch {
    // ignore
  }

  // 6. Paid Serper `site:<domain>` ONLY as last resort if all free scrapers & Jina failed
  if (options?.allowSerperSite !== false) {
    const serperSiteHit = await fetchSerperSiteSearch(identity, cleanQ, targetQuery, amazonPrice, scoreStrictMatch);
    if (serperSiteHit) return serperSiteHit;
  }

  const isBlocked = (sawBlocked && !sawReadableSearchPage) || Boolean(blockedPdpUrl);
  return {
    retailer: identity.displayName,
    price: null,
    regularPrice: null,
    url: blockedPdpUrl || fallbackSearchUrl,
    inStock: !sawReadableSearchPage,
    isLowestPrice: false,
    label: isBlocked ? 'Site Blocked' : 'Not Listed',
    statusReason: isBlocked ? 'blocked' : 'not_found',
    verifiedLive: false
  };
}
