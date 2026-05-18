/**
 * DateScamCheck — reverse image search proxy.
 *
 * Calls the SerpApi Google Reverse Image API server-side so the API key
 * (env var SERPAPI_KEY) is never exposed to the browser.
 *
 * Request:  POST { "image_url": "https://..." }
 * Response: { verdict, summary, matches:[{title,link,source,thumbnail}], total }
 */

const STOCK_DOMAINS = [
  "shutterstock", "istockphoto", "gettyimages", "alamy", "dreamstime",
  "123rf", "depositphotos", "adobe.com/stock", "stock.adobe", "pexels",
  "unsplash", "pixabay", "freepik"
];

const MODEL_KEYWORDS = [
  "stock photo", "model", "modeling", "modelling", "actor", "actress",
  "headshot", "portfolio", "fashion model", "free stock"
];

exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, headers, { error: "method_not_allowed" });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return json(503, headers, {
      error: "not_configured",
      message: "SERPAPI_KEY environment variable is not set."
    });
  }

  let imageUrl;
  try {
    imageUrl = JSON.parse(event.body || "{}").image_url;
  } catch (e) {
    return json(400, headers, { error: "bad_request" });
  }

  if (!imageUrl || !/^https?:\/\/.+/i.test(imageUrl)) {
    return json(400, headers, { error: "bad_image", message: "A valid image URL is required." });
  }

  const endpoint = "https://serpapi.com/search.json"
    + "?engine=google_reverse_image"
    + "&image_url=" + encodeURIComponent(imageUrl)
    + "&api_key=" + encodeURIComponent(apiKey);

  let data;
  try {
    const resp = await fetch(endpoint);
    data = await resp.json();
  } catch (e) {
    return json(502, headers, { error: "search_failed", message: "Could not reach the search service." });
  }

  if (data.error) {
    const err = String(data.error).toLowerCase();
    if (err.includes("run out") || err.includes("plan searches") || err.includes("limit")) {
      return json(429, headers, { error: "quota", message: data.error });
    }
    if (err.includes("image") || err.includes("url")) {
      return json(400, headers, { error: "bad_image", message: data.error });
    }
    return json(502, headers, { error: "search_failed", message: data.error });
  }

  const matches = extractMatches(data);
  const result = buildVerdict(matches);

  return json(200, headers, {
    verdict: result.verdict,
    summary: result.summary,
    total: matches.length,
    matches: matches.slice(0, 12)
  });
};

/* ---------- Parse SerpApi response ---------- */
function extractMatches(data) {
  const raw = []
    .concat(data.image_results || [])
    .concat(data.inline_images || []);

  const seen = {};
  const out = [];
  for (const item of raw) {
    const link = item.link || item.source || "";
    if (!link || seen[link]) continue;
    seen[link] = true;
    out.push({
      title: (item.title || "").trim(),
      link: link,
      source: (item.source || hostOf(link)).trim(),
      thumbnail: item.thumbnail || item.original || ""
    });
  }
  return out;
}

/* ---------- Verdict heuristic ---------- */
function buildVerdict(matches) {
  const count = matches.length;

  let stockHits = 0;
  let modelHits = 0;
  for (const m of matches) {
    const hay = ((m.title || "") + " " + (m.source || "") + " " + (m.link || "")).toLowerCase();
    if (STOCK_DOMAINS.some((d) => hay.includes(d))) stockHits++;
    if (MODEL_KEYWORDS.some((k) => hay.includes(k))) modelHits++;
  }

  // Strong signal: photo sold as stock or tied to modelling/acting work.
  if (stockHits > 0 || modelHits >= 2) {
    return {
      verdict: "bad",
      summary: "This photo appears on stock-photo or modelling sites. Scammers frequently use these images — treat this profile as high risk."
    };
  }

  if (count === 0) {
    return {
      verdict: "ok",
      summary: "We found no other copies of this photo online. That's typical for a genuine private person — but a brand-new fake photo may not be indexed yet, so stay alert."
    };
  }

  if (count >= 10) {
    return {
      verdict: "bad",
      summary: "This photo is spread across many websites. Widely circulated images are a classic sign of a stolen photo used on fake profiles."
    };
  }

  if (count >= 4) {
    return {
      verdict: "warn",
      summary: "This photo shows up in several places online. Check whether those pages match who this person claims to be — if they don't, that's a serious warning sign."
    };
  }

  // 1–3 matches.
  return {
    verdict: "warn",
    summary: "We found a few copies of this photo. Open the links below: if they belong to the same person under the same name, that's reassuring. If not, be very cautious."
  };
}

/* ---------- Helpers ---------- */
function hostOf(link) {
  try { return new URL(link).hostname.replace(/^www\./, ""); }
  catch (e) { return ""; }
}

function json(statusCode, headers, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}
