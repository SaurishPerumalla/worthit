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
 * auto-locks #1 organic match, and attaches alternate variations.
 */
export async function searchAmazonForCandidates(query: string): Promise<ResolveResult> {
  const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
  const text = await fetchAmazonHtml(url);
  const $ = cheerio.load(text);

  const candidates: (CandidateMatch & { isSponsored?: boolean })[] = [];

  $('[data-component-type="s-search-result"], .s-result-item[data-asin]').each((_, el) => {
    const $el = $(el);
    const asin = $el.attr('data-asin')?.toUpperCase();
    if (!asin || asin.length !== 10 || candidates.some(c => c.asin === asin)) return;

    // Check if this is a sponsored ad
    const isSponsored =
      $el.find('.s-sponsored-label-info-icon, .puis-sponsored-label-text, [data-ad-type]').length > 0 ||
      $el.hasClass('AdHolder');

    // Title extraction
    let title = $el.find('h2 a span, h2 span, h2 a').first().text().trim();
    if (!title || title.length < 5) {
      title = $el.find('h2').text().replace(/\s+/g, ' ').trim();
    }
    if (!title) {
      title = $el.find('img.s-image').attr('alt')?.trim() || '';
    }
    if (!title || title.length < 5) return;

    // Price extraction
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

    // Image extraction
    const image = $el.find('img.s-image').first().attr('src') || null;

    candidates.push({
      asin,
      title,
      price,
      image,
      isSponsored
    });
  });

  // Prioritize organic results over sponsored accessory ads
  candidates.sort((a, b) => (a.isSponsored === b.isSponsored ? 0 : a.isSponsored ? 1 : -1));

  if (candidates.length === 0) {
    // Check fallback data-asin attributes
    const fallbackAsins = [...new Set([...text.matchAll(/data-asin="(B0[A-Z0-9]{8})"/g)].map(m => m[1].toUpperCase()))];
    if (fallbackAsins.length > 0) {
      const bestAsin = fallbackAsins[0];
      return {
        asin: bestAsin,
        alternateMatches: fallbackAsins.slice(1, 4).map(a => ({ asin: a, title: `Product variation (${a})`, price: null, image: null })),
        inputType: 'search'
      };
    }
    throw new Error(`No matching Amazon products found for search query "${query}". Please paste the direct Amazon link or ASIN.`);
  }

  const primary = candidates[0];
  const alternates = candidates.slice(1, 5).map(c => ({
    asin: c.asin,
    title: c.title,
    price: c.price,
    image: c.image
  }));

  return {
    asin: primary.asin,
    resolvedTitle: primary.title,
    resolvedImage: primary.image || undefined,
    resolvedPrice: primary.price,
    alternateMatches: alternates,
    inputType: 'search'
  };
}
