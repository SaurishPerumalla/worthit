import * as cheerio from 'cheerio';
import { AmazonProductData } from '../types.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export async function scrapeAmazonProduct(asin: string): Promise<AmazonProductData> {
  const url = `https://www.amazon.com/dp/${asin}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    // 1. Remove accessory carousels, sponsored ads, trade-in, and installment blocks
    // so their prices are never mistaken for the main product price
    $(
      '[id^="sp_detail"], [id*="sponsored"], #sims-consolidated-2_feature_div, ' +
      '#dp-ads-center-promo_feature_div, #frequentlyBoughtTogether_feature_div, ' +
      '#bundle-v2-btf, #bundle-options, #desktop_buybox_accessories, ' +
      '.a-carousel-container, [id*="installment"], [id*="finance"], [id*="tradeIn"]'
    ).remove();

    // 2. Canonical Title
    let title = $('#productTitle').text().trim();
    if (!title) {
      title = $('meta[name="title"]').attr('content')?.replace(/ : Amazon\.com.*$/i, '').trim() || '';
    }
    if (!title) {
      title = $('title').text().replace(/ : Amazon\.com.*$/i, '').replace(/^Amazon\.com:\s*/i, '').trim() || `Product ${asin}`;
    }

    // 3. High-Res Thumbnail
    let image: string | null = null;
    const landingImg = $('#landingImage');
    if (landingImg.length) {
      image = landingImg.attr('data-old-hires') || landingImg.attr('src') || null;
      if (!image) {
        const dynImg = landingImg.attr('data-a-dynamic-image');
        if (dynImg) {
          try {
            const parsed = JSON.parse(dynImg);
            const keys = Object.keys(parsed);
            if (keys.length > 0) image = keys[0];
          } catch {
            // ignore
          }
        }
      }
    }
    if (!image) {
      image = $('#imgBlkFront').attr('src') || $('meta[property="og:image"]').attr('content') || null;
    }

    // 4. Live Price extraction scoped strictly to Main Product containers
    let price: number | null = null;
    const priceSelectors = [
      '#corePriceDisplay_desktop_feature_div .priceToPay',
      '#corePrice_feature_div .priceToPay',
      '#apex_desktop .priceToPay',
      '#desktop_buybox .priceToPay',
      '#corePriceDisplay_desktop_feature_div .apex-price-to-pay-value',
      '#apex_desktop .apex-price-to-pay-value',
      '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price):not(.basisPrice)',
      '#corePrice_feature_div .a-price:not(.a-text-price):not(.basisPrice)',
      '#desktop_buybox .a-price:not(.a-text-price):not(.basisPrice)',
      '#centerCol .priceToPay',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '.apex-price-to-pay-value'
    ];

    for (const sel of priceSelectors) {
      const els = $(sel);
      for (let i = 0; i < els.length; i++) {
        const el = $(els[i]);
        const parentContext = el.parent().text().toLowerCase();
        // Skip monthly payment plans or installments
        if (parentContext.includes('/mo') || parentContext.includes('/month') || parentContext.includes('per month')) {
          continue;
        }

        const parsed = extractPriceFromElement(el);
        if (parsed !== null && parsed > 0) {
          price = parsed;
          break;
        }
      }
      if (price !== null) break;
    }

    // 5. List / Strike-through Price
    let listPrice: number | null = null;
    const listSelectors = [
      '#corePriceDisplay_desktop_feature_div .basisPrice',
      '#corePriceDisplay_desktop_feature_div .a-text-price',
      '#corePrice_feature_div .basisPrice',
      '#corePrice_feature_div .a-text-price',
      '#apex_desktop .basisPrice',
      '#apex_desktop .apex-basis-price-value',
      '#apex_desktop .apex-basisprice-value',
      '#centerCol .basisPrice',
      '#centerCol .a-text-price',
      '.basisPrice',
      '.apex-basis-price-value',
      '.apex-basisprice-value',
      'span[data-a-strike="true"]'
    ];

    for (const sel of listSelectors) {
      const els = $(sel);
      for (let i = 0; i < els.length; i++) {
        const el = $(els[i]);
        const offscreen = el.find('.a-offscreen').text().trim();
        let val = parsePriceNumber(offscreen);
        if (val === null) {
          const whole = el.find('.a-price-whole').text().replace(/[^0-9]/g, '');
          if (whole) {
            const frac = el.find('.a-price-fraction').text().replace(/[^0-9]/g, '') || '00';
            const parsed = parseFloat(`${whole}.${frac}`);
            if (!isNaN(parsed) && parsed > 0) val = Number(parsed.toFixed(2));
          }
        }
        if (val === null) {
          val = parsePriceNumber(el.text().trim());
        }
        if (val !== null && val > 0) {
          listPrice = val;
          break;
        }
      }
      if (listPrice !== null) break;
    }

    if (listPrice === null) {
      const listMatch = html.match(/<span class="a-offscreen">List:\s*([^<]+)<\/span>/i) ||
                        html.match(/List Price:\s*<span[^>]*>([^<]+)<\/span>/i);
      if (listMatch && listMatch[1]) {
        listPrice = parsePriceNumber(listMatch[1]);
      }
    }

    if (listPrice !== null && price !== null && listPrice <= price) {
      listPrice = null;
    }

    // 6. In-Stock Status
    let inStock = true;
    const availText = $('#availability').text().toLowerCase();
    if (availText.includes('currently unavailable') || availText.includes('out of stock')) {
      inStock = false;
    }

    return {
      asin,
      title,
      price,
      listPrice,
      inStock,
      image,
      alternateMatches: []
    };
  } catch (error) {
    console.error(`Error scraping Amazon product ${asin}:`, error);
    return {
      asin,
      title: `Amazon Item (${asin})`,
      price: null,
      listPrice: null,
      inStock: true,
      image: null,
      alternateMatches: []
    };
  }
}

export function parsePriceNumber(str: string): number | null {
  if (!str) return null;
  const trimmed = str.trim();
  // Check if there is an explicit dollar sign price first (to avoid parsing discounts like "-23%" as "23")
  const dollarMatch = trimmed.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/);
  if (dollarMatch) {
    const val = parseFloat(dollarMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return Number(val.toFixed(2));
  }
  // Fallback for strings without $
  const match = trimmed.match(/\b([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\b/);
  if (match) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return Number(val.toFixed(2));
  }
  return null;
}

export function extractPriceFromElement(el: cheerio.Cheerio<any>): number | null {
  if (!el || !el.length) return null;

  // 1. Exclude any strike-through, basis, or list price element or parent
  if (
    el.hasClass('a-text-price') ||
    el.hasClass('basisPrice') ||
    el.hasClass('apex-basisprice-value') ||
    el.hasClass('apex-basis-price-value') ||
    el.attr('data-a-strike') === 'true' ||
    el.closest('.basisPrice, .a-text-price, .apex-basisprice-value, .apex-basis-price-value, [data-a-strike="true"]').length > 0
  ) {
    return null;
  }

  // 2. Try .a-offscreen child or self
  const offscreen = el.is('.a-offscreen') ? el : el.find('.a-offscreen');
  if (offscreen.length > 0) {
    const text = offscreen.first().text().trim();
    const parsed = parsePriceNumber(text);
    if (parsed !== null && parsed > 0) return parsed;
  }

  // 3. Try .a-price-whole and .a-price-fraction (crucial when .a-offscreen is whitespace or spacer)
  const whole = el.find('.a-price-whole').text().replace(/[^0-9]/g, '');
  if (whole) {
    const frac = el.find('.a-price-fraction').text().replace(/[^0-9]/g, '') || '00';
    const parsed = parseFloat(`${whole}.${frac}`);
    if (!isNaN(parsed) && parsed > 0) return Number(parsed.toFixed(2));
  }

  // 4. Try parsing direct text of element
  return parsePriceNumber(el.text().trim());
}
