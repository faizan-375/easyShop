import { normalizePrice } from "./priceUtils.js";
import { getHostname } from "./shoppingFilter.js";

const trustedSignals = ["official", "daraz", "metro", "alfatah", "shop", "sports", "warranty", "return"];
const qualitySignals = ["original", "premium", "grade", "warranty", "authentic", "match", "pro", "official"];
const riskySignals = ["copy", "replica", "used", "refurbished", "no warranty", "damaged"];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function includesAny(text, signals) {
  return signals.some((signal) => text.includes(signal));
}

function scoreQuality(product) {
  const text = `${product.title} ${product.description} ${product.availability}`.toLowerCase();
  const ratingScore = Number.isFinite(product.rating) ? product.rating * 9 : 24;
  const reviewScore = product.reviewsCount ? Math.min(18, Math.log10(product.reviewsCount + 1) * 8) : 4;
  const imageScore = product.image ? 12 : 0;
  const stockScore = /in stock|available/i.test(product.availability || "") ? 10 : 3;
  const keywordScore = includesAny(text, qualitySignals) ? 16 : 6;
  const riskPenalty = includesAny(text, riskySignals) ? 24 : 0;
  return clamp(Math.round(ratingScore + reviewScore + imageScore + stockScore + keywordScore - riskPenalty));
}

function scoreTrust(product) {
  const text = `${product.storeName} ${product.productUrl} ${product.description}`.toLowerCase();
  const host = getHostname(product.productUrl);
  const reviewScore = product.reviewsCount ? Math.min(22, Math.log10(product.reviewsCount + 1) * 10) : 5;
  const ratingScore = product.rating ? product.rating * 8 : 18;
  const policyScore = /return|warranty|official|cash on delivery|cod/i.test(text) ? 18 : 6;
  const storeScore = includesAny(`${text} ${host}`, trustedSignals) ? 24 : 12;
  return clamp(Math.round(reviewScore + ratingScore + policyScore + storeScore));
}

function buildPros(product) {
  const pros = [];
  if (product.normalizedPrice) pros.push("Comparable price found");
  if (product.rating >= 4.4) pros.push("Strong customer rating");
  if (product.reviewsCount >= 50) pros.push("Meaningful review volume");
  if (product.image) pros.push("Product image available");
  if (/in stock|available/i.test(product.availability || "")) pros.push("Availability looks positive");
  if (/delivery|ships|nationwide/i.test(product.locationSupport || "")) pros.push("Delivery support is indicated");
  return pros.slice(0, 4);
}

function buildCons(product) {
  const cons = [];
  if (!product.normalizedPrice) cons.push("Price could not be normalized");
  if (!product.image) cons.push("No product image extracted");
  if (!product.rating) cons.push("No public rating found");
  if (!product.reviewsCount) cons.push("Review count unavailable");
  if (/unclear/i.test(`${product.availability} ${product.shipping} ${product.locationSupport}`)) {
    cons.push("Some shipping or stock details are unclear");
  }
  return cons.slice(0, 4);
}

function recommendationFor(product) {
  if (product.badges?.includes("Risky Deal")) {
    return "Avoid unless the store confirms authenticity, stock, and return policy.";
  }
  if (product.badges?.includes("Risky/Incomplete Listing")) {
    return "Incomplete listing; verify price, stock, delivery, and return policy directly with the store.";
  }
  if (product.badges?.includes("Best Overall")) {
    return "Best overall balance of price, quality signals, trust, and delivery confidence.";
  }
  if (product.badges?.includes("Lowest Price")) {
    return "Lowest normalized price found; verify warranty and seller details before checkout.";
  }
  if (product.badges?.includes("Best Quality")) {
    return "Strong quality candidate based on rating, reviews, product text, and store signals.";
  }
  return "Worth comparing with the top ranked options before buying.";
}

export function rankProducts(products) {
  const prepared = products.map((product) => ({
    ...product,
    normalizedPrice: product.normalizedPrice ?? normalizePrice(product.price)
  }));

  const prices = prepared.map((product) => product.normalizedPrice).filter(Number.isFinite);
  const minPrice = prices.length ? Math.min(...prices) : null;

  const scored = prepared.map((product) => {
    const qualityScore = product.qualityScore || scoreQuality(product);
    const trustScore = product.trustScore || scoreTrust(product);
    const priceScore =
      minPrice && product.normalizedPrice ? clamp(Math.round((minPrice / product.normalizedPrice) * 100)) : 40;
    const deliveryScore = /delivery|ships|nationwide|mentions/i.test(product.locationSupport || "") ? 80 : 35;
    const overallScore = Math.round(qualityScore * 0.32 + trustScore * 0.28 + priceScore * 0.25 + deliveryScore * 0.15);
    const text = `${product.title} ${product.description}`.toLowerCase();
    const badges = [];

    if (includesAny(text, riskySignals) || qualityScore < 38 || trustScore < 38) {
      badges.push("Risky Deal");
    }
    if (!Number.isFinite(product.normalizedPrice) || product.confidenceScore < 55 || product.extractionStatus === "price-missing") {
      badges.push("Risky/Incomplete Listing");
    }
    if (trustScore >= 76) badges.push("Trusted Store");
    if (/fast|same day|24 hour|express|local/i.test(`${product.shipping} ${product.locationSupport}`)) {
      badges.push("Fast Delivery");
    }

    return {
      ...product,
      qualityScore,
      trustScore,
      overallScore,
      badges,
      pros: product.pros?.length ? product.pros : buildPros(product),
      cons: product.cons?.length ? product.cons : buildCons(product)
    };
  });

  const sorted = scored.sort((a, b) => b.overallScore - a.overallScore || (a.normalizedPrice || 9999999) - (b.normalizedPrice || 9999999));
  const lowest = sorted.filter((product) => Number.isFinite(product.normalizedPrice)).sort((a, b) => a.normalizedPrice - b.normalizedPrice)[0];
  const bestQuality = [...sorted].sort((a, b) => b.qualityScore - a.qualityScore)[0];

  return sorted.map((product, index) => {
    const badges = new Set(product.badges || []);
    if (index === 0) badges.add("Best Overall");
    if (lowest && product.productUrl === lowest.productUrl) badges.add("Lowest Price");
    if (bestQuality && product.productUrl === bestQuality.productUrl) badges.add("Best Quality");

    const withBadges = { ...product, badges: Array.from(badges) };
    return {
      ...withBadges,
      aiRecommendation: product.aiRecommendation || recommendationFor(withBadges)
    };
  });
}

export function buildResultSummary(products) {
  const prices = products.map((product) => product.normalizedPrice).filter(Number.isFinite);
  const findBadge = (badge) => products.find((product) => product.badges?.includes(badge));
  const pricedProducts = products.filter((product) => Number.isFinite(product.normalizedPrice));
  const unpricedProducts = products.length - pricedProducts.length;
  const cheapestProducts = [...pricedProducts]
    .sort((a, b) => a.normalizedPrice - b.normalizedPrice || b.overallScore - a.overallScore)
    .slice(0, 10);

  const cheapestByStore = Array.from(
    pricedProducts
      .reduce((stores, product) => {
        const key = product.storeName || getHostname(product.productUrl);
        const current = stores.get(key);
        if (!current || product.normalizedPrice < current.normalizedPrice) {
          stores.set(key, product);
        }
        return stores;
      }, new Map())
      .values()
  ).sort((a, b) => a.normalizedPrice - b.normalizedPrice);

  return {
    count: products.length,
    pricedProducts: pricedProducts.length,
    unpricedProducts,
    websitesWithPrice: cheapestByStore.length,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    averagePrice: prices.length ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null,
    bestOverall: findBadge("Best Overall"),
    lowestPrice: findBadge("Lowest Price"),
    bestQuality: findBadge("Best Quality"),
    trustedStore: findBadge("Trusted Store"),
    cheapestProducts,
    cheapestByStore
  };
}
