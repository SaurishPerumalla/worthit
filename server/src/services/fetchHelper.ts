import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

export async function fetchAmazonHtml(url: string): Promise<string> {
  // 1. Try native fetch first
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

    if (res.ok) {
      const html = await res.text();
      // Ensure it is not an Akamai or Amazon anti-bot interstitial page
      if (
        !html.includes('api-services-support@amazon.com') &&
        !html.includes('validateCaptcha') &&
        !html.includes('bm-verify') &&
        html.length > 3000
      ) {
        return html;
      }
    }
  } catch (err) {
    console.warn(`Standard fetch failed for ${url}, switching to HTTP/2 curl...`, err);
  }

  // 2. Try HTTP/2 curl fallback (bypasses Akamai/CloudFront 503 bot gate on cloud/datacenter IPs)
  try {
    const { stdout } = await execFileAsync('curl', [
      '-s',
      '-L',
      '--compressed',
      '-H', `User-Agent: ${USER_AGENT}`,
      '-H', 'Accept-Language: en-US,en;q=0.9',
      '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      url
    ], { maxBuffer: 15 * 1024 * 1024 });

    if (stdout && stdout.length > 3000 && !stdout.includes('api-services-support@amazon.com')) {
      return stdout;
    }
  } catch (curlErr) {
    console.error('Curl fallback failed for Amazon URL:', url, curlErr);
  }

  throw new Error(`Unable to fetch live Amazon content from: ${url}`);
}
