import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { extractPriceCandidates, formatPkr, normalizePrice } from "./priceUtils.js";
import { getHostname } from "./shoppingFilter.js";

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const priceSelectors = [
  "[itemprop='price']",
  "[content][itemprop='price']",
  "meta[property='product:price:amount']",
  "meta[property='og:price:amount']",
  "meta[name='twitter:data1']",
  ".pdp-price",
  ".pdp-price_color_orange",
  ".pdp-price_size_xl",
  ".pdp-product-price",
  "[class*='pdp-price']",
  "[data-testid*='price' i]",
  "[data-test*='price' i]",
  "[data-price]",
  "[class*='price' i]",
  "[id*='price' i]",
  ".price",
  ".product-price",
  ".sales-price",
  ".current-price",
  ".regular-price",
  ".special-price",
  ".sale-price",
  ".final-price",
  ".price-box",
  ".price-wrapper",
  ".amount",
  ".a-price-whole"
];

const listingPathSignals = [
  "/tag/",
  "/tags/",
  "/search",
  "/catalog",
  "/category",
  "/categories",
  "/collection",
  "/collections",
  "/shop/",
  "/shops/",
  "/store/",
  "/brand/"
];

const productPathSignals = [
  "/products/",
  "/product/",
  "/item/",
  "/items/",
  "/sku/",
  "/p/"
];

const listingCardSelectors = [
  "[data-qa-locator='product-item']",
  "[data-tracking='product-card']",
  "[data-tracking='product_item']",
  ".Bm3ON",
  ".gridItem--Yd0sa",
  ".product-card",
  ".product-item",
  ".item",
  "article",
  "li"
];

function cleanText(value, maxLength = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function text($, selector) {
  return cleanText($(selector).first().text());
}

function attr($, selector, name) {
  return $(selector).first().attr(name);
}

function selectorValue($, selector) {
  const node = $(selector).first();
  return (node.attr("content") || node.attr("data-price") || node.text()).replace(/\s+/g, " ").trim();
}

function absolutize(url, base) {
  if (!url) return undefined;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function productUrlKey(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return String(url || "").split("?")[0].replace(/\/$/, "").toLowerCase();
  }
}

function isSameHostOrUnknown(url, baseHost) {
  if (!baseHost || baseHost === "unknown") return true;
  const host = getHostname(url).toLowerCase();
  return host === baseHost || host.endsWith(`.${baseHost}`);
}

function isDarazProductUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().includes("daraz.") && /\/products\/.+(?:-i\d+|\.html?)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isLikelyListingUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();
    return (
      listingPathSignals.some((signal) => path.includes(signal)) ||
      /[?&](?:q|query|keyword|search|tag)=/.test(query)
    );
  } catch {
    return false;
  }
}

function timeoutForResult(result) {
  const host = getHostname(result.url).toLowerCase();
  if (host.includes("daraz.pk")) {
    return Math.max(env.REQUEST_TIMEOUT_MS, isLikelyListingUrl(result.url) ? 22000 : 18000);
  }
  return env.REQUEST_TIMEOUT_MS;
}

function hasUsefulPartialHtml(result, html) {
  if (!html || html.length < 1000) return false;
  if (!isDirectProductUrl(result.url) && html.includes("/products/")) return true;
  const sample = html.slice(0, 80000);
  return /application\/ld\+json|itemprop=["']price|og:price|product:price/i.test(sample) || extractPriceCandidates(sample).length > 0;
}

function isDirectProductUrl(url) {
  if (isDarazProductUrl(url)) return true;

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const pathLooksLikeProduct =
      productPathSignals.some((signal) => path.includes(signal)) ||
      /(?:^|[-_/])(?:sku|item|pid|product)[-_/]?[a-z0-9]{3,}/i.test(path) ||
      /(?:^|[-_/])i\d{5,}/i.test(path);
    const pathLooksLikeListing = listingPathSignals.some((signal) => path.includes(signal));
    const pathLooksLikeUtility = /\/(?:cart|checkout|login|signin|account|wishlist|privacy|terms|contact|about|help|blog|news)(?:\/|$)/i.test(path);

    return pathLooksLikeProduct && !pathLooksLikeListing && !pathLooksLikeUtility;
  } catch {
    return false;
  }
}

function looksLikeProductLink(url, baseHost) {
  if (!url || !isSameHostOrUnknown(url, baseHost)) return false;
  if (isDirectProductUrl(url)) return true;

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    if (listingPathSignals.some((signal) => path.includes(signal))) return false;
    if (/\/(?:cart|checkout|login|signin|account|wishlist|privacy|terms|contact|about|help|blog|news)(?:\/|$)/i.test(path)) {
      return false;
    }
    return productPathSignals.some((signal) => path.includes(signal)) || /(?:^|[-_/])i\d{5,}/i.test(path);
  } catch {
    return false;
  }
}

function unescapeEmbeddedUrl(value) {
  return String(value || "")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}

function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(last)
      .replace(/\.html?$/i, "")
      .replace(/(?:^|-)i\d+.*$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function firstSrcsetUrl(value) {
  return value ? cleanText(value).split(",")[0]?.trim().split(/\s+/)[0] : undefined;
}

function imageFromNode($, root, baseUrl) {
  const candidates = [];

  root.find("img").each((_, image) => {
    const node = $(image);
    candidates.push(
      node.attr("src"),
      node.attr("data-src"),
      node.attr("data-original"),
      node.attr("data-lazy-src"),
      node.attr("data-ks-lazyload"),
      firstSrcsetUrl(node.attr("srcset"))
    );
  });

  const chosen =
    candidates.find((candidate) => candidate && !String(candidate).startsWith("data:")) ||
    candidates.find(Boolean);
  return absolutize(chosen, baseUrl);
}

function priceTextFromNode($, root) {
  const selectors = [
    ".pdp-price",
    ".pdp-price_color_orange",
    ".pdp-product-price",
    "[data-price]",
    "[class*='currency']",
    "[class*='Currency']",
    "[class*='price']",
    "[class*='Price']",
    ".ooOxS",
    ".price"
  ];

  for (const selector of selectors) {
    const value = cleanText(root.find(selector).first().attr("content") || root.find(selector).first().attr("data-price") || root.find(selector).first().text(), 500);
    if (normalizePrice(value)) return value;
  }

  return "";
}

function closestListingCard($, anchor) {
  for (const selector of listingCardSelectors) {
    const card = $(anchor).closest(selector).first();
    if (card.length) return card;
  }
  return $(anchor).parent().parent();
}

function listingCandidateFromAnchor($, anchor, result) {
  const rawHref = $(anchor).attr("href");
  const url = absolutize(rawHref, result.url);
  const baseHost = getHostname(result.url).toLowerCase();

  if (!looksLikeProductLink(url, baseHost)) return null;

  const card = closestListingCard($, anchor);
  const anchorText = cleanText($(anchor).text(), 500);
  const cardText = cleanText(card.text(), 2500);
  const cardPriceText = priceTextFromNode($, card);
  const image = imageFromNode($, card, result.url);
  const title =
    cleanText($(anchor).attr("title"), 220) ||
    cleanText($(anchor).attr("aria-label"), 220) ||
    cleanText($(anchor).find("img").first().attr("alt"), 220) ||
    anchorText ||
    titleFromUrl(url) ||
    result.title;
  const normalizedPrice = normalizePrice(cardPriceText) || normalizePrice(cardText) || normalizePrice(anchorText);
  const storeName = result.source || getHostname(url);

  return {
    id: `${result.id || result._id || result.url}:${productUrlKey(url)}`,
    title,
    url,
    source: storeName,
    snippet: cardText || result.snippet,
    keyword: result.keyword,
    rank: result.rank,
    page: result.page,
    provider: result.provider,
    metadata: {
      title,
      image,
      price: normalizePrice(cardPriceText) ? cardPriceText : Number.isFinite(normalizedPrice) ? formatPkr(normalizedPrice) : undefined,
      normalizedPrice,
      storeName,
      sourceListingUrl: result.url,
      description: cardText || result.snippet
    }
  };
}

function listingCandidatesFromEmbeddedUrls(result, html) {
  const unescaped = unescapeEmbeddedUrl(html);
  const matches = [
    ...unescaped.matchAll(/(?:https?:)?\/\/(?:www\.)?daraz\.pk\/products\/[^"'<>\s\\]+?\.html(?:\?[^"'<>\s\\]*)?/gi),
    ...unescaped.matchAll(/\/products\/[^"'<>\s\\]+?\.html(?:\?[^"'<>\s\\]*)?/gi)
  ];

  return matches
    .map((match) => absolutize(match[0], result.url))
    .filter((url) => looksLikeProductLink(url, getHostname(result.url).toLowerCase()))
    .map((url) => {
      const title = titleFromUrl(url) || result.title;
      const storeName = result.source || getHostname(url);
      return {
        id: `${result.id || result._id || result.url}:${productUrlKey(url)}`,
        title,
        url,
        source: storeName,
        snippet: result.snippet,
        keyword: result.keyword,
        rank: result.rank,
        page: result.page,
        provider: result.provider,
        metadata: {
          title,
          storeName,
          sourceListingUrl: result.url,
          description: result.snippet
        }
      };
    });
}

function extractListingProductCandidates(result, html) {
  const $ = cheerio.load(html);
  const candidates = [];

  $("a[href]").each((_, anchor) => {
    const candidate = listingCandidateFromAnchor($, anchor, result);
    if (candidate) candidates.push(candidate);
  });

  candidates.push(...listingCandidatesFromEmbeddedUrls(result, html));

  const seen = new Set();
  return candidates
    .filter((candidate) => {
      const key = productUrlKey(candidate.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, env.PRODUCT_LINKS_PER_LISTING);
}


function flattenJsonLd(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flattenJsonLd);
  const graph = node["@graph"] ? flattenJsonLd(node["@graph"]) : [];
  return [node, ...graph];
}

function parseJsonLdProducts($) {
  const products = [];

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = $(element).contents().text();
    try {
      const parsed = JSON.parse(raw);
      for (const item of flattenJsonLd(parsed)) {
        const type = Array.isArray(item["@type"]) ? item["@type"].join(" ") : item["@type"];
        if (String(type || "").toLowerCase().includes("product")) {
          products.push(item);
        }
      }
    } catch {
      // Malformed JSON-LD is common on stores. HTML and regex fallbacks run next.
    }
  });

  return products;
}

function offerList(offers) {
  if (!offers) return [];
  return Array.isArray(offers) ? offers : [offers];
}

function offerPrice(offers) {
  const offer = offerList(offers)[0];
  return offer?.price || offer?.lowPrice || offer?.highPrice || offer?.priceSpecification?.price;
}

function offerPrices(offers) {
  return offerList(offers)
    .flatMap((offer) => [
      offer?.price,
      offer?.lowPrice,
      offer?.highPrice,
      offer?.priceSpecification?.price,
      offer?.priceSpecification?.minPrice,
      offer?.priceSpecification?.maxPrice
    ])
    .filter(Boolean);
}

function parseRating(product, $, pageText) {
  const rating =
    product?.aggregateRating?.ratingValue ||
    attr($, "meta[itemprop='ratingValue']", "content") ||
    attr($, "meta[property='product:rating:value']", "content");
  if (rating) return Number(rating);

  const ratingMatch = pageText.match(/([0-5](?:\.\d)?)\s*(?:\/\s*5|stars?|rating)/i);
  return ratingMatch ? Number(ratingMatch[1]) : undefined;
}

function parseReviews(product, $, pageText) {
  const count =
    product?.aggregateRating?.reviewCount ||
    product?.aggregateRating?.ratingCount ||
    attr($, "meta[itemprop='reviewCount']", "content");
  if (count) return Number(String(count).replace(/,/g, ""));

  const reviewMatch = pageText.match(/([0-9][0-9,]*)\s+(?:reviews?|ratings?)/i);
  return reviewMatch ? Number(reviewMatch[1].replace(/,/g, "")) : undefined;
}

function blockedReason(html) {
  const sample = html.slice(0, 12000).toLowerCase();
  const hasProductSignals =
    /property=["']og:type["']\s+content=["']product/i.test(html) ||
    /property=["']og:price:amount["']/i.test(html) ||
    /application\/ld\+json/i.test(html) ||
    /itemprop=["']price/i.test(html);
  if (sample.includes("captcha") && !hasProductSignals) return "Captcha or bot challenge detected";
  if (sample.includes("access denied") && !hasProductSignals) return "Access denied";
  if (sample.includes("cloudflare") && sample.includes("checking your browser") && !hasProductSignals) return "Cloudflare browser check";
  if (sample.includes("enable javascript") && sample.length < 5000) return "JavaScript gate";
  return null;
}

function failureFromResult(result, reason, stage = "fetch", attempts = 0, statusCode) {
  return {
    title: result.title,
    url: result.url,
    source: result.source || getHostname(result.url),
    keyword: result.keyword,
    page: result.page,
    reason,
    stage,
    attempts,
    statusCode
  };
}

function confidenceFor(product) {
  let score = 20;
  if (Number.isFinite(product.normalizedPrice)) score += 25;
  if (product.title) score += 10;
  if (product.image) score += 8;
  if (product.description && product.description.length > 80) score += 8;
  if (Number.isFinite(product.rating)) score += 10;
  if (Number.isFinite(product.reviewsCount)) score += 7;
  if (/in stock|available/i.test(product.availability || "")) score += 6;
  if (/delivery|ships|nationwide|mentions/i.test(product.locationSupport || "")) score += 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function displayPrice(rawPrice, normalizedPrice) {
  if (Number.isFinite(normalizedPrice) && !/rs\.?|pkr|₨/i.test(String(rawPrice || ""))) {
    return formatPkr(normalizedPrice);
  }
  return rawPrice ? String(rawPrice).trim() : formatPkr(normalizedPrice);
}

function parseProductHtml(result, html, context) {
  const $ = cheerio.load(html);
  const metadata = result.metadata || {};
  const jsonLdProduct = parseJsonLdProducts($)[0] || {};
  const firstImage = Array.isArray(jsonLdProduct.image) ? jsonLdProduct.image[0] : jsonLdProduct.image;
  const offer = offerList(jsonLdProduct.offers)[0];
  const pageText = $("body").text().replace(/\s+/g, " ").slice(0, 25000);
  const selectorPrices = priceSelectors.map((selector) => selectorValue($, selector)).filter(Boolean);
  const pricePool = [
    offerPrice(jsonLdProduct.offers),
    ...offerPrices(jsonLdProduct.offers),
    metadata.price,
    metadata.normalizedPrice,
    result.snippet,
    ...selectorPrices,
    pageText
  ]
    .filter(Boolean)
    .join(" | ");
  const priceCandidates = extractPriceCandidates(pricePool);
  const rawPrice =
    offerPrice(jsonLdProduct.offers) ||
    selectorPrices.find((value) => normalizePrice(value)) ||
    metadata.price ||
    (priceCandidates.length ? formatPkr(priceCandidates[0]) : null);
  const normalizedPrice = normalizePrice(rawPrice || result.snippet) || metadata.normalizedPrice || priceCandidates[0] || null;
  const host = getHostname(result.url);
  const title =
    jsonLdProduct.name ||
    text($, "h1") ||
    attr($, "meta[property='og:title']", "content") ||
    metadata.title ||
    result.title;

  const description =
    jsonLdProduct.description ||
    attr($, "meta[name='description']", "content") ||
    attr($, "meta[property='og:description']", "content") ||
    metadata.description ||
    result.snippet ||
    "";

  const lowerPageText = pageText.toLowerCase();
  const locationSupport = lowerPageText.includes(context.location.toLowerCase())
    ? `Mentions ${context.location}`
    : lowerPageText.includes("nationwide") || lowerPageText.includes("pakistan")
      ? "Nationwide delivery likely"
      : "Delivery support unclear";

  const product = {
    title,
    price: displayPrice(rawPrice, normalizedPrice),
    normalizedPrice,
    currency: offer?.priceCurrency || "PKR",
    image: absolutize(
      firstImage ||
        attr($, "meta[property='og:image:secure_url']", "content") ||
        attr($, "meta[property='og:image']", "content") ||
        attr($, "meta[name='twitter:image']", "content") ||
        metadata.image,
      result.url
    ),
    storeName: attr($, "meta[property='og:site_name']", "content") || metadata.storeName || result.source || host,
    productUrl: result.url,
    description,
    rating: parseRating(jsonLdProduct, $, pageText) || metadata.rating,
    reviewsCount: parseReviews(jsonLdProduct, $, pageText) || metadata.reviewsCount,
    availability: offer?.availability ? String(offer.availability).split("/").pop() : metadata.availability || "Availability unclear",
    shipping: lowerPageText.includes("free delivery") ? "Free delivery mentioned" : metadata.shipping || "Shipping charges unclear",
    locationSupport: locationSupport === "Delivery support unclear" && metadata.locationSupport ? metadata.locationSupport : locationSupport,
    sourceListingUrl: metadata.sourceListingUrl,
    sourceResultId: result.id,
    extractionStatus: normalizedPrice ? "completed" : "price-missing"
  };

  return {
    ...product,
    confidenceScore: confidenceFor(product)
  };
}

function fallbackProductFromSnippet(result, context) {
  const metadata = result.metadata || {};
  const normalizedPrice = metadata.normalizedPrice || normalizePrice(metadata.price || result.snippet);
  const product = {
    title: metadata.title || result.title,
    price: displayPrice(metadata.price, normalizedPrice),
    normalizedPrice,
    currency: "PKR",
    image: metadata.image,
    storeName: metadata.storeName || result.source || getHostname(result.url),
    productUrl: result.url,
    description: metadata.description || result.snippet || "",
    rating: metadata.rating,
    reviewsCount: metadata.reviewsCount,
    availability: metadata.availability || "Availability unclear",
    shipping: metadata.shipping || "Shipping charges unclear",
    locationSupport: metadata.locationSupport || `Check delivery to ${context.location}`,
    sourceListingUrl: metadata.sourceListingUrl,
    sourceResultId: result.id,
    extractionStatus: normalizedPrice ? "snippet-fallback" : "price-missing"
  };

  return {
    ...product,
    confidenceScore: confidenceFor(product)
  };
}

async function fetchHtmlWithHttp(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "upgrade-insecure-requests": "1",
        "user-agent": userAgent
      }
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("text/html")) {
      throw Object.assign(new Error(`HTTP extraction returned ${response.status}`), { statusCode: response.status });
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHtmlWithPlaywright(context, result) {
  const page = await context.newPage();
  let response;
  const timeoutMs = timeoutForResult(result);
  const host = getHostname(result.url).toLowerCase();
  const isDaraz = host.includes("daraz.pk");
  const usefulSelector = !isDirectProductUrl(result.url) && isLikelyListingUrl(result.url)
    ? "a[href*='/products/'],a[href*='/product/'],a[href*='/item/']"
    : priceSelectors.join(",");

  try {
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);
    try {
      response = await page.goto(result.url, {
        waitUntil: isDaraz ? "commit" : "domcontentloaded",
        timeout: timeoutMs
      });
    } catch (error) {
      const partialHtml = await page.content().catch(() => "");
      if (!hasUsefulPartialHtml(result, partialHtml)) throw error;
      logger.warn({ url: result.url, error }, "Using partial HTML after navigation timeout");
      return { html: partialHtml, statusCode: response?.status?.() };
    }

    await page
      .waitForSelector(usefulSelector, { timeout: Math.min(isDaraz ? 8000 : 2500, timeoutMs) })
      .catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: Math.min(isDaraz ? 1000 : 2500, timeoutMs) }).catch(() => undefined);
    const html = await page.content();
    const block = blockedReason(html);
    if (block) throw Object.assign(new Error(block), { stage: "blocked", statusCode: response?.status?.() });
    return { html, statusCode: response?.status?.() };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function fetchHtmlWithRetry(context, result) {
  let lastError;
  const attempts = env.SCRAPER_RETRIES + 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (env.ENABLE_PLAYWRIGHT && context) {
        return { ...(await fetchHtmlWithPlaywright(context, result)), attempts: attempt };
      }

      return {
        html: await fetchHtmlWithHttp(result.url),
        attempts: attempt
      };
    } catch (error) {
      lastError = error;
      logger.warn({ error, url: result.url, attempt }, "Product page fetch attempt failed");
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }

  throw Object.assign(lastError || new Error("Page fetch failed"), { attempts });
}

async function createBrowserContext() {
  if (!env.ENABLE_PLAYWRIGHT) return { browser: null, context: null };

  try {
    const { chromium } = await import("playwright");
    const baseLaunchOptions = {
      headless: env.SCRAPER_HEADLESS,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-sandbox"
      ]
    };
    const fallbackExecutables = [
      env.PLAYWRIGHT_EXECUTABLE_PATH,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    ].filter(Boolean);

    let browser;
    try {
      browser = await chromium.launch(baseLaunchOptions);
    } catch (error) {
      for (const executablePath of fallbackExecutables) {
        try {
          logger.warn({ error, executablePath }, "Bundled Chromium failed; trying local Chromium-compatible browser");
          browser = await chromium.launch({
            ...baseLaunchOptions,
            executablePath
          });
          break;
        } catch (fallbackError) {
          logger.warn({ error: fallbackError, executablePath }, "Local Chromium-compatible browser failed");
        }
      }
      if (!browser) throw error;
    }

    const context = await browser.newContext({
      userAgent,
      locale: "en-US",
      timezoneId: "Asia/Karachi",
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "upgrade-insecure-requests": "1"
      }
    });

    await context.route("**/*", (route) => {
      const resourceType = route.request().resourceType();
      if (["image", "media", "font"].includes(resourceType)) {
        return route.abort();
      }
      return route.continue();
    });

    return { browser, context };
  } catch (error) {
    logger.warn({ error }, "Playwright Chromium could not start; falling back to HTTP extraction");
    return { browser: null, context: null };
  }
}

async function extractProductPage(result, context, browserContext) {
  try {
    const { html, attempts, statusCode } = await fetchHtmlWithRetry(browserContext, result);
    const product = parseProductHtml(result, html, context);
    const failures = [];

    if (!product.normalizedPrice) {
      failures.push(failureFromResult(result, "Price could not be extracted", "price", attempts, statusCode));
    }

    return { products: [product], failures };
  } catch (error) {
    logger.warn({ error, url: result.url }, "Product extraction failed");
    const fallback = fallbackProductFromSnippet(result, context);
    const failures = [
      failureFromResult(
        result,
        error.message || "Product extraction failed",
        error.stage || (String(error.message || "").toLowerCase().includes("timeout") ? "timeout" : "fetch"),
        error.attempts || env.SCRAPER_RETRIES + 1,
        error.statusCode
      )
    ];

    if (!fallback.normalizedPrice) {
      failures.push(failureFromResult(result, "Price could not be extracted", "price", error.attempts || 0));
    }

    return { products: [fallback], failures };
  }
}

async function extractCandidateProducts(candidates, context, browserContext, claimProductPage) {
  const candidateLimit = pLimit(Math.min(3, env.EXTRACTION_CONCURRENCY));
  const extracted = await Promise.all(
    candidates.map((candidate) =>
      candidateLimit(async () => {
        if (!claimProductPage(candidate.url)) return { products: [], failures: [] };
        return extractProductPage(candidate, context, browserContext);
      })
    )
  );

  return {
    products: extracted.flatMap((item) => item.products),
    failures: extracted.flatMap((item) => item.failures)
  };
}

async function extractListing(result, html, context, browserContext, claimProductPage, attempts, statusCode, candidates = extractListingProductCandidates(result, html)) {

  if (!candidates.length) {
    return {
      products: [],
      failures: [failureFromResult(result, "Listing page did not expose direct product links", "parse", attempts, statusCode)]
    };
  }

  const { products, failures } = await extractCandidateProducts(candidates, context, browserContext, claimProductPage);

  if (!products.length) {
    failures.push(failureFromResult(result, "Product page cap reached before this listing could be extracted", "parse", attempts, statusCode));
  }

  return { products, failures };
}

async function extractOne(result, context, browserContext, claimProductPage) {
  const shouldExpandListing = !isDirectProductUrl(result.url) && isLikelyListingUrl(result.url);

  try {
    const { html, attempts, statusCode } = await fetchHtmlWithRetry(browserContext, result);
    const candidates = !isDirectProductUrl(result.url) ? extractListingProductCandidates(result, html) : [];

    if (shouldExpandListing || candidates.length) {
      if (candidates.length) {
        const { products, failures } = await extractCandidateProducts(candidates, context, browserContext, claimProductPage);

        if (products.length) return { products, failures };
      }

      return extractListing(result, html, context, browserContext, claimProductPage, attempts, statusCode, candidates);
    }

    if (!claimProductPage(result.url)) {
      return { products: [], failures: [] };
    }

    const product = parseProductHtml(result, html, context);
    const failures = [];

    if (!product.normalizedPrice) {
      failures.push(failureFromResult(result, "Price could not be extracted", "price", attempts, statusCode));
    }

    return { products: [product], failures };
  } catch (error) {
    logger.warn({ error, url: result.url }, "Product extraction failed");

    if (shouldExpandListing) {
      return {
        products: [],
        failures: [
          failureFromResult(
            result,
            error.message || "Listing extraction failed",
            error.stage || (String(error.message || "").toLowerCase().includes("timeout") ? "timeout" : "fetch"),
            error.attempts || env.SCRAPER_RETRIES + 1,
            error.statusCode
          )
        ]
      };
    }

    if (!claimProductPage(result.url)) {
      return { products: [], failures: [] };
    }

    const fallback = fallbackProductFromSnippet(result, context);
    const failures = [
      failureFromResult(
        result,
        error.message || "Product extraction failed",
        error.stage || (String(error.message || "").toLowerCase().includes("timeout") ? "timeout" : "fetch"),
        error.attempts || env.SCRAPER_RETRIES + 1,
        error.statusCode
      )
    ];

    if (!fallback.normalizedPrice) {
      failures.push(failureFromResult(result, "Price could not be extracted", "price", error.attempts || 0));
    }

    return { products: [fallback], failures };
  }
}

function dedupeProducts(products) {
  const seen = new Set();
  return products.filter((product) => {
    if (!product) return false;
    const normalizedUrl = (product.productUrl || "").split("?")[0].replace(/\/$/, "");
    const key = `${normalizedUrl || product.title}-${product.normalizedPrice || product.price}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function extractProductsFromWebsites(websites, context, onProgress) {
  const limit = pLimit(env.EXTRACTION_CONCURRENCY);
  const { browser, context: browserContext } = await createBrowserContext();
  let completed = 0;
  let productsExtracted = 0;
  let failuresExtracted = 0;
  const total = websites.length;
  const claimedProductUrls = new Set();

  function claimProductPage(url) {
    const key = productUrlKey(url);
    if (!key || claimedProductUrls.has(key)) return false;
    if (claimedProductUrls.size >= env.MAX_PRODUCT_PAGES) return false;
    claimedProductUrls.add(key);
    return true;
  }

  try {
    const extracted = await Promise.all(
      websites.map((result) =>
        limit(async () => {
          const item = await extractOne(result, context, browserContext, claimProductPage);
          completed += 1;
          productsExtracted += item.products.length;
          failuresExtracted += item.failures.length;
          await onProgress?.({
            completed,
            total,
            url: result.url,
            title: result.title,
            productsFound: item.products.length,
            productsExtracted,
            productPagesVisited: claimedProductUrls.size,
            failuresFound: failuresExtracted
          });
          return item;
        })
      )
    );
    const products = dedupeProducts(extracted.flatMap((item) => item.products));
    const failures = extracted.flatMap((item) => item.failures);
    return { products, failures };
  } finally {
    await browserContext?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}
