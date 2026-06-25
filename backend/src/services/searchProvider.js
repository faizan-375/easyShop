import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { dedupeByUrl, getHostname, isShoppingResult } from "./shoppingFilter.js";

function providerName() {
  if (env.SEARCH_PROVIDER !== "auto") return env.SEARCH_PROVIDER;
  if (env.SERPAPI_API_KEY) return "serpapi";
  if (env.GOOGLE_CSE_API_KEY && env.GOOGLE_CSE_ID) return "google-cse";
  return null;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "easyShopBot/1.0 (+https://local.easyshop.app)"
      }
    });

    if (!response.ok) {
      throw new Error(`Search provider returned ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function searchSerpApi(keyword, page) {
  if (!env.SERPAPI_API_KEY) {
    throw new Error("SERPAPI_API_KEY is required when SEARCH_PROVIDER=serpapi.");
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", keyword);
  url.searchParams.set("api_key", env.SERPAPI_API_KEY);
  url.searchParams.set("num", "10");
  url.searchParams.set("start", String(page * 10));

  const payload = await fetchJson(url);
  return (payload.organic_results || []).map((item, index) => ({
    title: item.title,
    url: item.link,
    source: getHostname(item.link),
    snippet: item.snippet || item.rich_snippet?.top?.detected_extensions?.price,
    keyword,
    rank: page * 10 + index + 1,
    page: page + 1,
    provider: "serpapi"
  }));
}

async function searchGoogleCse(keyword, page) {
  if (!env.GOOGLE_CSE_API_KEY || !env.GOOGLE_CSE_ID) {
    throw new Error("GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID are required when SEARCH_PROVIDER=google-cse.");
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", env.GOOGLE_CSE_API_KEY);
  url.searchParams.set("cx", env.GOOGLE_CSE_ID);
  url.searchParams.set("q", keyword);
  url.searchParams.set("num", "10");
  url.searchParams.set("start", String(page * 10 + 1));

  const payload = await fetchJson(url);
  return (payload.items || []).map((item, index) => ({
    title: item.title,
    url: item.link,
    source: getHostname(item.link),
    snippet: item.snippet,
    keyword,
    rank: page * 10 + index + 1,
    page: page + 1,
    provider: "google-cse"
  }));
}

export async function searchAcrossKeywords({ productName, location, keywords, onProgress }) {
  const provider = providerName();
  const selectedKeywords = keywords.slice(0, env.SEARCH_KEYWORD_LIMIT);
  const pagesPerKeyword = env.GOOGLE_SEARCH_PAGES;
  const totalPageBudget = Math.min(env.MAX_TOTAL_SEARCH_PAGES, selectedKeywords.length * pagesPerKeyword);

  if (!provider) {
    throw new Error(
      "A legal Google search API is required. Set SERPAPI_API_KEY or GOOGLE_CSE_API_KEY plus GOOGLE_CSE_ID."
    );
  }

  const collected = [];
  const pageFailures = [];
  let filtered = [];
  let pagesCompleted = 0;
  const totalPages = totalPageBudget;

  outer: for (let page = 0; page < pagesPerKeyword; page += 1) {
    for (const keyword of selectedKeywords) {
      if (pagesCompleted >= totalPageBudget || filtered.length >= env.MAX_SHOPPING_RESULTS) break outer;

      try {
        const pageResults =
          provider === "serpapi" ? await searchSerpApi(keyword, page) : await searchGoogleCse(keyword, page);
        collected.push(...pageResults);
        filtered = dedupeByUrl(collected).filter(isShoppingResult).slice(0, env.MAX_SHOPPING_RESULTS);
      } catch (error) {
        logger.warn({ error, keyword, page, provider }, "Search provider page failed");
        pageFailures.push({
          keyword,
          page: page + 1,
          provider,
          reason: error.message || "Search provider page failed"
        });
      }

      pagesCompleted += 1;
      await onProgress?.({
        provider,
        keyword,
        page: page + 1,
        pagesCompleted,
        totalPages,
        resultsCollected: filtered.length,
        pageFailures: pageFailures.length
      });
    }
  }

  return {
    provider,
    results: filtered.slice(0, env.MAX_SHOPPING_RESULTS),
    stats: {
      pagesRequested: totalPages,
      searchPagesCompleted: pagesCompleted,
      keywordsSearched: selectedKeywords.length,
      maxShoppingResults: env.MAX_SHOPPING_RESULTS,
      searchPageFailures: pageFailures.length
    },
    pageFailures
  };
}
