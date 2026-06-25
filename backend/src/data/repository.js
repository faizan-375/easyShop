import { randomUUID } from "node:crypto";
import { usingMongo } from "../config/db.js";
import UserSearch from "../models/UserSearch.js";
import WebsiteResult from "../models/WebsiteResult.js";
import Product from "../models/Product.js";
import ExtractionFailure from "../models/ExtractionFailure.js";

const memory = {
  searches: new Map(),
  websites: new Map(),
  products: new Map(),
  failures: new Map()
};

function normalizeId(value) {
  return value?._id?.toString?.() || value?.id?.toString?.() || value?.toString?.();
}

function plain(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const id = normalizeId(raw);
  return {
    ...raw,
    id,
    _id: id,
    searchId: normalizeId(raw.searchId) || raw.searchId
  };
}

function sortByCreatedDesc(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export async function createUserSearch(payload) {
  if (usingMongo()) {
    return plain(await UserSearch.create(payload));
  }

  const now = new Date().toISOString();
  const search = {
    id: randomUUID(),
    _id: undefined,
    status: "queued",
    progress: 0,
    stats: {
      websitesFound: 0,
      websitesExtracted: 0,
      productsExtracted: 0,
      pricedProducts: 0,
      websitesWithPrice: 0,
      failedSites: 0,
      searchPageFailures: 0,
      searchPagesCompleted: 0,
      pagesRequested: 0,
      keywordsSearched: 0,
      provider: "unconfigured"
    },
    createdAt: now,
    updatedAt: now,
    ...payload
  };
  memory.searches.set(search.id, search);
  return plain(search);
}

export async function updateUserSearch(searchId, patch) {
  if (usingMongo()) {
    return plain(
      await UserSearch.findByIdAndUpdate(searchId, patch, {
        new: true,
        runValidators: true
      })
    );
  }

  const existing = memory.searches.get(searchId);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...patch,
    stats: { ...existing.stats, ...patch.stats },
    updatedAt: new Date().toISOString()
  };
  memory.searches.set(searchId, updated);
  return plain(updated);
}

export async function getUserSearch(searchId) {
  if (usingMongo()) {
    return plain(await UserSearch.findById(searchId));
  }
  return plain(memory.searches.get(searchId));
}

export async function listUserSearches(limit = 25) {
  if (usingMongo()) {
    const searches = await UserSearch.find().sort({ createdAt: -1 }).limit(limit);
    return searches.map(plain);
  }

  return Array.from(memory.searches.values()).sort(sortByCreatedDesc).slice(0, limit).map(plain);
}

export async function addWebsiteResults(searchId, results) {
  if (usingMongo()) {
    const docs = await WebsiteResult.insertMany(
      results.map((result) => ({ ...result, searchId })),
      { ordered: false }
    ).catch(async () => WebsiteResult.find({ searchId }));
    return docs.map(plain);
  }

  const docs = results.map((result) => ({
    id: randomUUID(),
    searchId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...result
  }));
  docs.forEach((doc) => memory.websites.set(doc.id, doc));
  return docs.map(plain);
}

export async function getWebsiteResults(searchId) {
  if (usingMongo()) {
    const results = await WebsiteResult.find({ searchId }).sort({ rank: 1, createdAt: 1 });
    return results.map(plain);
  }

  return Array.from(memory.websites.values())
    .filter((result) => result.searchId === searchId)
    .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    .map(plain);
}

export async function replaceProductsForSearch(searchId, products) {
  if (usingMongo()) {
    await Product.deleteMany({ searchId });
    if (!products.length) return [];
    const docs = await Product.insertMany(products.map((product) => ({ ...product, searchId })));
    return docs.map(plain);
  }

  for (const [id, product] of memory.products.entries()) {
    if (product.searchId === searchId) {
      memory.products.delete(id);
    }
  }

  const docs = products.map((product) => ({
    id: randomUUID(),
    searchId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...product
  }));
  docs.forEach((doc) => memory.products.set(doc.id, doc));
  return docs.map(plain);
}

export async function addExtractionFailures(searchId, failures) {
  if (!failures.length) return [];

  if (usingMongo()) {
    const docs = await ExtractionFailure.insertMany(failures.map((failure) => ({ ...failure, searchId })));
    return docs.map(plain);
  }

  const docs = failures.map((failure) => ({
    id: randomUUID(),
    searchId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...failure
  }));
  docs.forEach((doc) => memory.failures.set(doc.id, doc));
  return docs.map(plain);
}

export async function replaceExtractionFailures(searchId, failures) {
  if (usingMongo()) {
    await ExtractionFailure.deleteMany({ searchId });
    return addExtractionFailures(searchId, failures);
  }

  for (const [id, failure] of memory.failures.entries()) {
    if (failure.searchId === searchId) {
      memory.failures.delete(id);
    }
  }
  return addExtractionFailures(searchId, failures);
}

export async function getExtractionFailures(searchId) {
  if (usingMongo()) {
    const failures = await ExtractionFailure.find({ searchId }).sort({ createdAt: 1 });
    return failures.map(plain);
  }

  return Array.from(memory.failures.values())
    .filter((failure) => failure.searchId === searchId)
    .map(plain);
}

export async function getProductsBySearch(searchId) {
  if (usingMongo()) {
    const products = await Product.find({ searchId }).sort({ overallScore: -1, normalizedPrice: 1 });
    return products.map(plain);
  }

  return Array.from(memory.products.values())
    .filter((product) => product.searchId === searchId)
    .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
    .map(plain);
}

export async function getProduct(productId) {
  if (usingMongo()) {
    return plain(await Product.findById(productId));
  }
  return plain(memory.products.get(productId));
}
