import {
  addWebsiteResults,
  replaceExtractionFailures,
  getProductsBySearch,
  getUserSearch,
  replaceProductsForSearch,
  updateUserSearch
} from "../data/repository.js";
import { logger } from "../utils/logger.js";
import { analyzeProducts } from "./aiAnalysisService.js";
import { extractProductsFromWebsites } from "./scraperService.js";
import { searchAcrossKeywords } from "./searchProvider.js";

const running = new Map();

async function mark(searchId, patch) {
  return updateUserSearch(searchId, patch);
}

function productPriceStats(products) {
  const pricedProducts = products.filter((product) => Number.isFinite(product.normalizedPrice));
  const websitesWithPrice = new Set(
    pricedProducts.map((product) => product.storeName || product.productUrl).filter(Boolean)
  ).size;
  const cheapestPrice = pricedProducts.length
    ? Math.min(...pricedProducts.map((product) => product.normalizedPrice))
    : undefined;

  return {
    pricedProducts: pricedProducts.length,
    websitesWithPrice,
    cheapestPrice
  };
}

async function runPipeline(search) {
  const searchId = search.id;

  try {
    await mark(searchId, { status: "searching", progress: 12, error: undefined });

    const { provider, results, stats: searchStats = {}, pageFailures = [] } = await searchAcrossKeywords({
      productName: search.productName,
      location: search.location,
      keywords: search.generatedKeywords,
      onProgress: async (progress) => {
        const percent = progress.totalPages ? progress.pagesCompleted / progress.totalPages : 0;
        await mark(searchId, {
          status: "searching",
          progress: Math.min(40, 12 + Math.round(percent * 28)),
          stats: {
            provider: progress.provider,
            pagesRequested: progress.totalPages,
            searchPagesCompleted: progress.pagesCompleted,
            websitesFound: progress.resultsCollected,
            searchPageFailures: progress.pageFailures,
            keywordsSearched: search.generatedKeywords.length
          }
        });
      }
    });

    const websites = await addWebsiteResults(searchId, results);
    await mark(searchId, {
      status: "extracting",
      progress: 45,
      stats: { websitesFound: websites.length, provider, ...searchStats }
    });

    const { products: extractedProducts, failures: extractionFailures } = await extractProductsFromWebsites(websites, {
      productName: search.productName,
      location: search.location
    }, async (progress) => {
      const percent = progress.total ? progress.completed / progress.total : 0;
      await mark(searchId, {
        status: "extracting",
        progress: Math.min(74, 45 + Math.round(percent * 29)),
        stats: {
          websitesFound: websites.length,
          websitesExtracted: progress.completed,
          productsExtracted: progress.productsExtracted,
          failedSites: progress.failuresFound,
          provider,
          ...searchStats
        }
      });
    });
    const failures = [
      ...pageFailures.map((failure) => ({
        url: `search://${failure.provider}/${encodeURIComponent(failure.keyword)}/page/${failure.page}`,
        title: `${failure.provider} page ${failure.page}`,
        source: failure.provider,
        keyword: failure.keyword,
        page: failure.page,
        stage: "search",
        reason: failure.reason,
        attempts: 1
      })),
      ...extractionFailures
    ];
    await replaceExtractionFailures(searchId, failures);

    await mark(searchId, {
      status: "analyzing",
      progress: 76,
      stats: {
        websitesFound: websites.length,
        productsExtracted: extractedProducts.length,
        provider,
        ...searchStats,
        failedSites: failures.length,
        ...productPriceStats(extractedProducts)
      }
    });

    const analyzedProducts = await analyzeProducts(extractedProducts, {
      productName: search.productName,
      location: search.location
    });

    const savedProducts = await replaceProductsForSearch(searchId, analyzedProducts);
    await mark(searchId, {
      status: "completed",
      progress: 100,
      completedAt: new Date(),
      stats: {
        websitesFound: websites.length,
        productsExtracted: savedProducts.length,
        provider,
        ...searchStats,
        failedSites: failures.length,
        ...productPriceStats(savedProducts)
      }
    });
  } catch (error) {
    logger.error({ error, searchId }, "Search pipeline failed");
    await mark(searchId, {
      status: "failed",
      progress: 100,
      error: error.message || "Search pipeline failed"
    });
  }
}

export function startSearchPipeline(search) {
  const searchId = search.id;
  if (running.has(searchId)) return running.get(searchId);

  const task = runPipeline(search).finally(() => running.delete(searchId));
  running.set(searchId, task);
  return task;
}

export async function restartAnalysis(searchId) {
  const search = await getUserSearch(searchId);
  const products = await getProductsBySearch(searchId);
  const analyzed = await analyzeProducts(products, {
    productName: search.productName,
    location: search.location
  });
  return replaceProductsForSearch(searchId, analyzed);
}
