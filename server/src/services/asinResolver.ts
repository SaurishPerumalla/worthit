import { CandidateMatch } from '../types.js';
import { parsePriceNumber } from './amazonScraper.js';

export const ASIN_REGEX = /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/|\/clp\/|\/d\/|\/o\/ASIN\/|\/ASIN\/|\/offer-listing\/)(?:[^\/]+\/)?([A-Z0-9]{10})(?:[/?&#]|$)/i;
export const EXACT_ASIN_REGEX = /^[A-Z0-9]{10}$/i;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export interface ResolveResult {
  asin: string;
  alternateMatches: CandidateMatch[];
  resolvedTitle?: string;
  resolvedImage?: string;
  resolvedPrice?: number | null;
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
 * Executes a live Amazon product search, extracts top candidates,
 * auto-locks #1 match, and attaches alternate variations.
 */
export async function searchAmazonForCandidates(query: string): Promise<ResolveResult> {
  const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!res.ok) {
    throw new Error(`Amazon search returned status ${res.status}`);
  }

  const text = await res.text();
  const itemMatches = [...text.matchAll(/<div[^>]+data-asin="([A-Z0-9]{10})"[^>]*data-component-type="s-search-result"[\s\S]*?(?=<div[^>]+data-component-type="s-search-result"|$)/g)];

  const candidates: CandidateMatch[] = [];

  for (const match of itemMatches) {
    const asin = match[1].toUpperCase();
    const html = match[0];
    if (candidates.some(c => c.asin === asin)) continue;

    // Title extraction
    let title = '';
    const imgAltMatch = html.match(/<img[^>]+class="s-image"[^>]+alt="([^"]+)"/i) || html.match(/<img[^>]+alt="([^"]+)"[^>]+class="s-image"/i);
    if (imgAltMatch && imgAltMatch[1].length > 5) {
      title = imgAltMatch[1].trim();
    }
    if (!title) {
      const h2Match = html.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
      if (h2Match) {
        title = h2Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }

    // Price extraction
    let price: number | null = null;
    const priceMatch = html.match(/<span class="a-price"[^>]*>[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/i) || html.match(/<span class="a-offscreen">([^<]+)<\/span>/i);
    if (priceMatch) {
      price = parsePriceNumber(priceMatch[1]);
    }
    if (!price) {
      const wholeMatch = html.match(/<span class="a-price-whole">([^<]+)<\/span>/i);
      if (wholeMatch) {
        const whole = wholeMatch[1].replace(/[^0-9]/g, '');
        const fracMatch = html.match(/<span class="a-price-fraction">([^<]+)<\/span>/i);
        const frac = fracMatch ? fracMatch[1].replace(/[^0-9]/g, '') : '00';
        const parsed = parseFloat(`${whole}.${frac}`);
        if (!isNaN(parsed) && parsed > 0) price = Number(parsed.toFixed(2));
      }
    }

    // Image extraction
    let image: string | null = null;
    const imgMatch = html.match(/<img class="s-image"[^>]*src="([^"]+)"/i) || html.match(/src="([^"]+)"[^>]*class="s-image"/i);
    if (imgMatch) image = imgMatch[1];

    if (title && asin) {
      candidates.push({ asin, title, price, image });
    }
    if (candidates.length >= 4) break;
  }

  if (candidates.length === 0) {
    // If no search results matched container, check any data-asin
    const fallbackAsins = [...new Set([...text.matchAll(/data-asin="([A-Z0-9]{10})"/g)].map(m => m[1].toUpperCase()))];
    if (fallbackAsins.length > 0) {
      const bestAsin = fallbackAsins[0];
      return {
        asin: bestAsin,
        alternateMatches: fallbackAsins.slice(1, 4).map(a => ({ asin: a, title: `Product variation (${a})`, price: null, image: null })),
        inputType: 'search'
      };
    }
    throw new Error(`No matching Amazon products found for search query "${query}"`);
  }

  const primary = candidates[0];
  const alternates = candidates.slice(1);

  return {
    asin: primary.asin,
    resolvedTitle: primary.title,
    resolvedImage: primary.image || undefined,
    resolvedPrice: primary.price,
    alternateMatches: alternates,
    inputType: 'search'
  };
}
