import * as cheerio from 'cheerio';
import { CandidateMatch } from '../types.js';
import { parsePriceNumber } from './amazonScraper.js';
import { fetchAmazonHtml } from './fetchHelper.js';

export const ASIN_REGEX = /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/|\/clp\/|\/d\/|\/o\/ASIN\/|\/ASIN\/|\/offer-listing\/)(?:[^\/]+\/)?([A-Z0-9]{10})(?:[/?&#]|$)/i;
export const EXACT_ASIN_REGEX = /^[A-Z0-9]{10}$/i;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export interface ResolveResult {
  asin: string;
  alternateMatches: CandidateMatch[];
  resolvedTitle?: string;
  resolvedImage?: string;
  resolvedPrice?: number | null;
  matchNote?: string;
  inputType: 'asin' | 'url' | 'search';
}

/**
 * Extracts a 10-char ASIN from various Amazon URL formats.
 */
export function extractAsinFromUrl(url: string): string | null {
  // 1. Direct path matches: /dp/, /clp/, /gp/product/, /d/, etc.
  const pathMatch = url.match(ASIN_REGEX);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1].toUpperCase();
  }

  // 2. Query params: asin=, pd_rd_i=
  const paramMatch = url.match(/[?&](?:asin|pd_rd_i)=([A-Z0-9]{10})(?:[&/?#]|$)/i);
  if (paramMatch && paramMatch[1]) {
    return paramMatch[1].toUpperCase();
  }

  // 3. Generic Amazon path with 10-char ASIN token
  if (url.includes('amazon.') || url.includes('a.co')) {
    const genericMatch = url.match(/(?:^|\/|[?&=])([B0-9][A-Z0-9]{9})(?:[/?&#]|$)/i);
    if (genericMatch && genericMatch[1]) {
      return genericMatch[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Resolves user input (URL, ASIN, or product text query) to a verified 10-char ASIN.
 */
export async function resolveInputToAsin(input: string): Promise<ResolveResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Input is empty');
  }

  // 1. Direct 10-char ASIN (e.g. B0FQFB8FMG)
  if (EXACT_ASIN_REGEX.test(trimmed)) {
    return {
      asin: trimmed.toUpperCase(),
      alternateMatches: [],
      inputType: 'asin'
    };
  }

  // 2. Direct extraction from URL if matches known patterns
  const directAsin = extractAsinFromUrl(trimmed);
  if (directAsin) {
    return {
      asin: directAsin,
      alternateMatches: [],
      inputType: 'url'
    };
  }

  // 3. Shortened or redirecting Amazon URL (e.g. a.co or unexpanded links)
  const isUrl = /^https?:\/\//i.test(trimmed) || trimmed.includes('amazon.') || trimmed.includes('a.co');
  if (isUrl) {
    try {
      const fullUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      const res = await fetch(fullUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT }
      });
      const finalUrl = res.url || '';
      const expandedAsin = extractAsinFromUrl(finalUrl);
      if (expandedAsin) {
        return {
          asin: expandedAsin,
          alternateMatches: [],
          inputType: 'url'
        };
      }

      // Check HTML for canonical link or #ASIN
      const html = await res.text();
      const canonMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
      if (canonMatch && canonMatch[1]) {
        const canonAsin = extractAsinFromUrl(canonMatch[1]);
        if (canonAsin) {
          return {
            asin: canonAsin,
            alternateMatches: [],
            inputType: 'url'
          };
        }
      }

      const inputAsinMatch = html.match(/id="ASIN"\s+value="([A-Z0-9]{10})"/i) ||
                             html.match(/data-asin="([A-Z0-9]{10})"/i);
      if (inputAsinMatch && inputAsinMatch[1]) {
        return {
          asin: inputAsinMatch[1].toUpperCase(),
          alternateMatches: [],
          inputType: 'url'
        };
      }
    } catch (e) {
      console.warn('Error expanding Amazon URL:', e);
    }

    throw new Error(`Could not find a valid product ASIN in the provided Amazon link: "${trimmed}"`);
  }

  // 4. Natural language text search query
  return await searchAmazonForCandidates(trimmed);
}

/**
 * Scores how well a product title matches the user's intent:
 * - Eliminates cases/covers/protectors/straps when the user is searching for a device.
 * - Eliminates brand mismatches (e.g. Samsung/Google when searching for Apple iPhone).
 * - Prioritizes Core Hardware Entity: Exact Model Generation (e.g. iPhone 18 == 18) and Tier (Pro vs Pro Max).
 * - Treats color & cosmetic attributes as tiebreakers so a color variation never demotes an exact model match.
 */
export function scoreProductRelevance(title: string, query: string): number {
  const t = title.toLowerCase();
  const q = query.toLowerCase();

  // 1. Heavy penalty if query is a device (phone/watch/laptop) and result is an accessory
  const isAccessory = /\b(case|cover|protector|strap|band|cable|charger|adapter|holder|wallet|skin|stand|mount|film)\b/i.test(t);
  const wantsDevice = /\b(iphone|ipad|macbook|galaxy|watch|airpods|headphone|pixel|phone|laptop|tablet|smartwatch)\b/i.test(q);
  const wantsAccessory = /\b(case|cover|protector|strap|band|cable|charger|adapter|holder|wallet)\b/i.test(q);

  if (wantsDevice && !wantsAccessory && isAccessory) {
    return -100; // eliminate accessories when user wants a device
  }

  // 2. Heavy penalty if brand mismatch
  if (q.includes('iphone') && !t.includes('iphone')) return -50;
  if (q.includes('galaxy') && !t.includes('galaxy')) return -50;
  if (q.includes('pixel') && !t.includes('pixel')) return -50;

  let score = 100; // baseline for valid hardware

  // 3. Exact Generation matching (Highest Priority entity match)
  const qNumMatch = q.match(/(?:iphone|watch|galaxy)\s*([0-9]{1,2})/i) || q.match(/\b([0-9]{1,2})\s*(?:pro|plus|ultra|max)?\b/i);
  const tNumMatch = t.match(/(?:iphone|watch|galaxy)\s*([0-9]{1,2})/i) || t.match(/\b([0-9]{1,2})\s*(?:pro|plus|ultra|max)?\b/i);
  if (qNumMatch && tNumMatch) {
    const qNum = parseInt(qNumMatch[1], 10);
    const tNum = parseInt(tNumMatch[1], 10);
    if (qNum === tNum) {
      score += 60; // Huge boost for exact requested generation (e.g. 18 == 18)
    } else {
      const diff = Math.abs(qNum - tNum);
      score -= diff * 20; // Prior generations penalised relative to exact requested generation
    }
  }

  // 4. Hardware Tier Alignment (Pro, Pro Max, Plus, Ultra, SE)
  const wantsProMax = /\bpro\s*max\b/i.test(q);
  const hasProMax = /\bpro\s*max\b/i.test(t);
  const wantsPro = /\bpro\b/i.test(q) && !wantsProMax;
  const hasPro = /\bpro\b/i.test(t) && !hasProMax;

  if (wantsProMax) {
    if (hasProMax) score += 30;
    else score -= 25;
  } else if (wantsPro) {
    if (hasPro) score += 30;
    else if (hasProMax) score += 10; // Pro Max is acceptable alternate if no Pro, but ranks lower
    else score -= 30;
  }

  const wantsUltra = /\bultra\b/i.test(q);
  const hasUltra = /\bultra\b/i.test(t);
  if (wantsUltra && hasUltra) score += 30;
  else if (wantsUltra && !hasUltra) score -= 30;

  // 5. Storage Capacity Match (256gb, 512gb, 128gb, 1tb)
  const storageMatch = q.match(/\b([0-9]{2,4}\s*(?:gb|tb))\b/i);
  if (storageMatch) {
    const rawStorage = storageMatch[1].toLowerCase().replace(/\s+/g, '');
    if (t.includes(rawStorage)) {
      score += 20;
    } else {
      score -= 5;
    }
  }

  // 6. Color Matching (Tiebreaker / Secondary Attribute)
  const colors = [
    'sky blue', 'deep blue', 'sierra blue', 'pacific blue', 'blue titanium', 'navy blue', 'blue',
    'glacier', 'black', 'white', 'natural titanium', 'desert titanium', 'silver', 'gold', 'starlight', 'midnight'
  ];
  const matchedQueryColors = colors.filter(c => q.includes(c));
  if (matchedQueryColors.length > 0) {
    const exactColorMatch = matchedQueryColors.some(c => t.includes(c));
    if (exactColorMatch) {
      score += 15;
    } else if (matchedQueryColors.some(c => c.includes('blue')) && t.includes('blue')) {
      score += 10;
    }
  }

  // 7. AppleCare+ / Extended Warranty / Insurance Bundles
  // Always prioritize standalone hardware over AppleCare+ bundles unless user explicitly requested it
  const wantsCare = /\b(applecare\+?|apple\s*care|warranty|protection\s*plan|care\+|insurance)\b/i.test(q);
  const hasCare = /\b(applecare\+?|apple\s*care|warranty|protection\s*plan|care\+|insurance)\b/i.test(t);
  if (!wantsCare && hasCare) {
    score -= 45; // Substantial penalty so non-AppleCare devices always rank first
  } else if (wantsCare && hasCare) {
    score += 25;
  }

  // 8. Cellular / GPS connectivity alignment (Apple Watches, iPads, Tablets)
  const wantsCellular = /\b(cellular|lte|4g|5g)\b/i.test(q);
  const hasCellular = /\b(cellular|lte|4g|5g)\b/i.test(t);
  if (wantsCellular && hasCellular) {
    score += 25;
  } else if (wantsCellular && !hasCellular) {
    score -= 25; // Penalize GPS-only when user specifically requested cellular
  }

  // 9. Case / Display size alignment (e.g. 40mm, 44mm, 41mm, 45mm, 49mm)
  const sizeMatch = q.match(/\b([0-9]{2}\s*mm)\b/i);
  if (sizeMatch) {
    const rawSize = sizeMatch[1].toLowerCase().replace(/\s+/g, '');
    if (t.includes(rawSize)) {
      score += 20;
    } else {
      score -= 15;
    }
  }

  // 10. General Keyword Coverage
  const keywords = q.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
  for (const kw of keywords) {
    if (t.includes(kw)) {
      score += 5;
    }
  }

  if (t.includes('unlocked')) score += 5;
  if (!t.includes('renewed')) score += 5;

  return score;
}

/**
 * Generates progressive query relaxation variants for futuristic, misspelled,
 * or overly specific searches (e.g. "iPhone 18 pro sky blue 256gb" -> "iPhone pro 256gb blue").
 */
export function generateRelaxedQueries(input: string): string[] {
  const clean = input.replace(/\b(a|an|the|for|with)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const variants: string[] = [clean];

  // 1. Futuristic / unreleased generation numbers (e.g. iPhone 18 Pro -> iPhone Pro, iPhone 17 Pro, iPhone 16 Pro)
  const phoneMatch = clean.match(/iPhone\s*([1-9][0-9]+)\s*(Pro\s*Max|Pro|Plus|Mini)?/i);
  if (phoneMatch) {
    const fullMatch = phoneMatch[0];
    const tier = phoneMatch[2] || '';
    const num = parseInt(phoneMatch[1], 10);
    if (num > 17) {
      variants.push(clean.replace(fullMatch, `iPhone ${tier}`.trim()).replace(/\s+/g, ' '));
      variants.push(clean.replace(fullMatch, `iPhone 17 ${tier}`.trim()).replace(/\s+/g, ' '));
      variants.push(clean.replace(fullMatch, `iPhone 16 ${tier}`.trim()).replace(/\s+/g, ' '));
    }
  }

  // 2. Futuristic gadgets (Apple Watch 11, Ultra 4, M5, S26, Pixel 10)
  const gadgetMatch = clean.match(/\b(Watch|Ultra|Series|Pixel|PlayStation|PS)\s*([0-9]{1,2})\b/i);
  if (gadgetMatch) {
    const name = gadgetMatch[1];
    variants.push(clean.replace(gadgetMatch[0], name).replace(/\s+/g, ' '));
  }

  // 3. Simplify descriptive color names (sky blue -> blue, space black -> black)
  const colorMatch = clean.match(/\b(sky blue|deep blue|pacific blue|sierra blue|titanium blue|midnight blue|navy blue|starlight|midnight|space gray|space black|natural titanium|white titanium|black titanium|blue titanium|rose gold)\b/i);
  if (colorMatch) {
    variants.push(clean.replace(colorMatch[0], '').replace(/\s+/g, ' ').trim());
    if (colorMatch[0].toLowerCase().includes('blue')) {
      variants.push(clean.replace(colorMatch[0], 'blue').replace(/\s+/g, ' ').trim());
    }
  }

  // 4. Drop specific storage if search is too narrow
  const storageMatch = clean.match(/\b([0-9]{2,4}\s*(?:gb|tb))\b/i);
  if (storageMatch) {
    variants.push(clean.replace(storageMatch[0], '').replace(/\s+/g, ' ').trim());
  }

  // 5. Extract primary core subject (first 2-3 words)
  const words = clean.split(' ');
  if (words.length > 3) {
    variants.push(words.slice(0, 3).join(' '));
  }
  if (words.length > 2) {
    variants.push(words.slice(0, 2).join(' '));
  }

  return [...new Set(variants.filter(v => v.length >= 3))];
}

/**
 * Parses Amazon search HTML into scored, ranked candidate products.
 */
function extractAndRankCandidates(html: string, originalQuery: string): CandidateMatch[] {
  const $ = cheerio.load(html);
  const scoredItems: (CandidateMatch & { score: number; isSponsored?: boolean })[] = [];

  $('[data-component-type="s-search-result"], .s-result-item[data-asin]').each((_, el) => {
    const $el = $(el);
    const asin = $el.attr('data-asin')?.toUpperCase();
    if (!asin || asin.length !== 10 || scoredItems.some(c => c.asin === asin)) return;

    const isSponsored =
      $el.find('.s-sponsored-label-info-icon, .puis-sponsored-label-text, [data-ad-type]').length > 0 ||
      $el.hasClass('AdHolder');

    // Robust multi-selector title extraction
    let title = '';
    const h2Links = $el.find('h2 a, a[href*="/dp/"]');
    for (let i = 0; i < h2Links.length; i++) {
      const linkText = $(h2Links[i]).text().replace(/\s+/g, ' ').trim();
      if (linkText.length > title.length && !linkText.includes('stars') && !linkText.includes('$')) {
        title = linkText;
      }
    }
    if (!title || title.length < 5) {
      title = $el.find('img.s-image').attr('alt')?.trim() || '';
    }
    if (!title) {
      title = $el.find('h2').text().replace(/\s+/g, ' ').trim();
    }
    if (!title || title.length < 5) return;

    // Filter out accessories if user is looking for a device
    const score = scoreProductRelevance(title, originalQuery);
    if (score < 0) return;

    let price: number | null = null;
    const priceText = $el.find('.a-price:not(.a-text-price) .a-offscreen').first().text().trim();
    if (priceText) {
      price = parsePriceNumber(priceText);
    }
    if (!price) {
      const whole = $el.find('.a-price-whole').first().text().replace(/[^0-9]/g, '');
      if (whole) {
        const frac = $el.find('.a-price-fraction').first().text().replace(/[^0-9]/g, '') || '00';
        price = parsePriceNumber(`${whole}.${frac}`);
      }
    }

    const image = $el.find('img.s-image').first().attr('src') || null;

    scoredItems.push({
      asin,
      title,
      price,
      image,
      isSponsored,
      score: isSponsored ? score - 15 : score
    });
  });

  scoredItems.sort((a, b) => b.score - a.score);

  return scoredItems.map(item => ({
    asin: item.asin,
    title: item.title,
    price: item.price,
    image: item.image
  }));
}

/**
 * Executes a resilient live Amazon product search:
 * - Uses shopper cookies and HTTP/2 headers to prevent bot blocks.
 * - Progressively relaxes queries if futuristic, misspelled, or overly narrow.
 * - Extracts and semantically ranks candidates, eliminating accessories.
 * - Auto-locks #1 best match and attaches the top 4 alternates.
 */
export async function searchAmazonForCandidates(query: string): Promise<ResolveResult> {
  const queryVariants = generateRelaxedQueries(query);
  let bestCandidates: CandidateMatch[] = [];
  let isClosestMatch = false;

  for (let i = 0; i < queryVariants.length; i++) {
    const variant = queryVariants[i];
    try {
      const url = `https://www.amazon.com/s?k=${encodeURIComponent(variant)}&ref=nb_sb_noss`;
      const html = await fetchAmazonHtml(url);
      const candidates = extractAndRankCandidates(html, query);

      if (candidates.length > 0) {
        bestCandidates = candidates;
        if (i > 0) {
          isClosestMatch = true;
        }
        break;
      }
    } catch (err) {
      console.warn(`Query variant "${variant}" failed or was blocked, trying next relaxation...`);
    }
  }

  if (bestCandidates.length === 0) {
    throw new Error(`Could not find an Amazon product matching "${query}". Try searching with a broader title (e.g. "iPhone 16 Pro") or paste the direct Amazon link or ASIN.`);
  }

  const primary = bestCandidates[0];
  const alternates = bestCandidates.slice(1, 5);

  let matchNote: string | undefined;
  const qNumMatch = query.match(/(?:iphone|watch|galaxy)\s*([0-9]{1,2})/i) || query.match(/\b([0-9]{1,2})\s*(?:pro|plus|ultra|max)?\b/i);
  const pNumMatch = primary.title.match(/(?:iphone|watch|galaxy)\s*([0-9]{1,2})/i) || primary.title.match(/\b([0-9]{1,2})\s*(?:pro|plus|ultra|max)?\b/i);

  if (qNumMatch && pNumMatch && parseInt(qNumMatch[1], 10) !== parseInt(pNumMatch[1], 10)) {
    matchNote = `Closest available generation (${pNumMatch[0]})`;
  } else if (isClosestMatch) {
    matchNote = 'Closest match based on search intent';
  } else {
    // If the exact model/generation matched (e.g. iPhone 18 Pro), but color varied
    const knownColors = ['glacier', 'black', 'white', 'deep blue', 'sky blue', 'blue titanium', 'natural titanium', 'desert titanium', 'silver', 'gold', 'starlight', 'midnight'];
    const pColor = knownColors.find(c => primary.title.toLowerCase().includes(c));
    const qColor = knownColors.find(c => query.toLowerCase().includes(c));
    if (pColor && qColor && pColor !== qColor) {
      matchNote = `Available variation (${pColor.charAt(0).toUpperCase() + pColor.slice(1)})`;
    }
  }

  return {
    asin: primary.asin,
    resolvedTitle: primary.title,
    resolvedImage: primary.image || undefined,
    resolvedPrice: primary.price,
    alternateMatches: alternates,
    matchNote,
    inputType: 'search'
  };
}
