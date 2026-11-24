import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

function generateSessionId(): string {
  const p1 = Math.floor(100 + Math.random() * 900);
  const p2 = Math.floor(1000000 + Math.random() * 9000000);
  const p3 = Math.floor(1000000 + Math.random() * 9000000);
  return `${p1}-${p2}-${p3}`;
}

const DEFAULT_COOKIES = `session-id=${generateSessionId()}; i18n-prefs=USD; lc-main=en_US; sp-cdn="L5Z:US"`;

export async function fetchAmazonHtml(url: string): Promise<string> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cookie': DEFAULT_COOKIES,
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  // 1. Try native fetch with shopper session cookies (strict 9s timeout for cloud reliability)
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(9000) });
    if (res.ok) {
      const html = await res.text();
      // Ensure it is not an Akamai or Amazon anti-bot challenge page
      if (
        !html.includes('api-services-support@amazon.com') &&
        !html.includes('validateCaptcha') &&
        !html.includes('bm-verify') &&
        html.length > 2000
      ) {
        return html;
      }
    }
  } catch (err) {
    console.warn(`Standard fetch failed for ${url}, switching to HTTP/2 curl...`);
  }

  // 2. Try HTTP/2 curl fallback with shopper cookies (bypasses datacenter bot blocks)
  try {
    const { stdout } = await execFileAsync('curl', [
      '-s',
      '-L',
      '--max-time', '10',
      '--compressed',
      '-H', `User-Agent: ${USER_AGENT}`,
      '-H', 'Accept-Language: en-US,en;q=0.9',
      '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '-H', `Cookie: ${DEFAULT_COOKIES}`,
      url
    ], { maxBuffer: 15 * 1024 * 1024 });

    if (stdout && stdout.length > 2000 && !stdout.includes('api-services-support@amazon.com')) {
      return stdout;
    }
  } catch (curlErr) {
    console.error('Curl fallback failed for Amazon URL:', url, curlErr);
  }

  throw new Error(`Unable to fetch live Amazon content for query. Please try searching with a simpler title or paste the Amazon link.`);
}
