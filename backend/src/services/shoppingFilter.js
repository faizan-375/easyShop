const blockedHosts = [
  "wikipedia.org",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "pinterest.com",
  "reddit.com",
  "medium.com",
  "quora.com",
  "linkedin.com",
  "blogspot",
  "forum",
  "pdf"
];

const blockedContentSignals = ["news article", "blog post", "buying guide", "how to choose", "top 10"];

const shoppingSignals = [
  "buy",
  "price",
  "shop",
  "store",
  "cart",
  "delivery",
  "daraz",
  "product",
  "sale",
  "checkout",
  "sku",
  "stock",
  "cash on delivery"
];

const storeSignals = [
  "daraz",
  "amazon",
  "ebay",
  "aliexpress",
  "walmart",
  "shopify",
  "woocommerce",
  "shop",
  "store",
  "mart",
  "sports",
  "gear",
  "outfitters"
];

export function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function isShoppingResult(result) {
  const haystack = `${result.title || ""} ${result.url || ""} ${result.snippet || ""}`.toLowerCase();
  const host = getHostname(result.url).toLowerCase();

  if (blockedHosts.some((blocked) => host.includes(blocked))) {
    return false;
  }

  if (blockedContentSignals.some((blocked) => haystack.includes(blocked))) {
    return false;
  }

  const hasShoppingSignal = shoppingSignals.some((signal) => haystack.includes(signal));
  const hasStoreSignal = storeSignals.some((signal) => host.includes(signal) || haystack.includes(signal));
  const hasPriceSignal = /\b(?:rs\.?|pkr|price|sale|buy|cart|checkout)\b/i.test(haystack);

  return hasShoppingSignal || (hasStoreSignal && hasPriceSignal);
}

export function dedupeByUrl(results) {
  const seen = new Set();
  return results.filter((result) => {
    const key = (result.url || "").split("?")[0].replace(/\/$/, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
