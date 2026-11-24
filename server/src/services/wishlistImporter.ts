import * as cheerio from 'cheerio';
import { WishlistItemImport } from '../types.js';
import { ASIN_REGEX } from './asinResolver.js';
import { parsePriceNumber } from './amazonScraper.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export async function importAmazonWishlist(wishlistUrl: string): Promise<WishlistItemImport[]> {
  const trimmedUrl = wishlistUrl.trim();
  if (!trimmedUrl.includes('amazon.com') && !trimmedUrl.includes('a.co')) {
    throw new Error('Please provide a valid Amazon Wishlist URL');
  }

  const res = await fetch(trimmedUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Amazon Wishlist: HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const items: WishlistItemImport[] = [];

  // Each item in public wishlist is usually inside li[data-itemid] or inside #g-items
  const listElements = $('#g-items li[data-itemid], li[data-itemid]');

  listElements.each((_, el) => {
    const $el = $(el);
    let asin: string | null = null;

    // 1. Check data-reposition-action-params JSON
    const actionParams = $el.attr('data-reposition-action-params');
    if (actionParams) {
      try {
        const parsed = JSON.parse(actionParams);
        if (parsed.itemExternalId && /^[A-Z0-9]{10}$/i.test(parsed.itemExternalId)) {
          asin = parsed.itemExternalId.toUpperCase();
        }
      } catch {
        // ignore
      }
    }

    // 2. Check links inside item
    if (!asin) {
      $el.find('a[href*="/dp/"]').each((__, a) => {
        const href = $(a).attr('href') || '';
        const match = href.match(ASIN_REGEX);
        if (match && match[1]) {
          asin = match[1].toUpperCase();
          return false;
        }
      });
    }

    // 3. Extract title
    let title = $el.find('h2 a, [id^="itemName_"], .a-link-normal[title]').first().text().trim();
    if (!title) {
      title = $el.find('a[id^="itemName_"]').attr('title') || '';
    }

    // 4. Extract price
    let listedPrice: number | null = null;
    const priceText = $el.find('[id^="itemPrice_"], .a-price .a-offscreen, .itemPriceDrop').first().text().trim();
    if (priceText) {
      listedPrice = parsePriceNumber(priceText);
    }

    // 5. Extract thumbnail
    let image: string | null = null;
    const imgEl = $el.find('[id^="itemImage_"] img, img.a-declarative, img').first();
    if (imgEl.length) {
      image = imgEl.attr('src') || null;
    }

    if (asin && title) {
      items.push({
        asin,
        title,
        listedPrice,
        image
      });
    }
  });

  // If list elements didn't match, fallback regex search for /dp/ links in wishlist page
  if (items.length === 0) {
    const linkMatches = [...html.matchAll(/\/dp\/([A-Z0-9]{10})/gi)];
    const uniqueAsins = [...new Set(linkMatches.map(m => m[1].toUpperCase()))];
    for (const a of uniqueAsins.slice(0, 10)) {
      items.push({
        asin: a,
        title: `Wishlist Item (${a})`,
        listedPrice: null,
        image: null
      });
    }
  }

  if (items.length === 0) {
    throw new Error('No items found in the Amazon Wishlist. Please ensure the wishlist is set to Public or Shareable.');
  }

  return items;
}
