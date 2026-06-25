import OpenAI from "openai";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { safeJsonParse } from "./jsonUtils.js";
import { rankProducts } from "./rankingService.js";

function responseText(response) {
  if (response.output_text) return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n")
    .trim();
}

function mergeAiOutput(products, output) {
  const recommendations = Array.isArray(output?.recommendations) ? output.recommendations : [];
  const byUrl = new Map(recommendations.map((item) => [item.productUrl, item]));

  return products.map((product) => {
    const ai = byUrl.get(product.productUrl);
    if (!ai) return product;

    return {
      ...product,
      aiRecommendation: ai.aiRecommendation || product.aiRecommendation,
      pros: Array.isArray(ai.pros) && ai.pros.length ? ai.pros.slice(0, 4) : product.pros,
      cons: Array.isArray(ai.cons) && ai.cons.length ? ai.cons.slice(0, 4) : product.cons,
      badges: Array.from(new Set([...(product.badges || []), ...(ai.badges || [])])).slice(0, 6)
    };
  });
}

export async function analyzeProducts(products, context) {
  const ranked = rankProducts(products, context);

  if (!env.OPENAI_API_KEY || ranked.length === 0) {
    return ranked;
  }

  try {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const compactProducts = ranked.slice(0, 20).map((product) => ({
      title: product.title,
      price: product.price,
      normalizedPrice: product.normalizedPrice,
      storeName: product.storeName,
      productUrl: product.productUrl,
      description: product.description?.slice(0, 500),
      rating: product.rating,
      reviewsCount: product.reviewsCount,
      availability: product.availability,
      shipping: product.shipping,
      locationSupport: product.locationSupport,
      qualityScore: product.qualityScore,
      trustScore: product.trustScore,
      badges: product.badges
    }));

    const response = await client.responses.create({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are easyShop's shopping analysis engine. Return concise JSON only. Improve recommendations without inventing facts."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Analyze these products for best value, lowest price, quality, risky deals, store trust, and final recommendation. Keep pros and cons grounded in provided fields.",
            productName: context.productName,
            location: context.location,
            outputShape:
              "{ recommendations: [{ productUrl, aiRecommendation, pros: string[], cons: string[], badges: string[] }] }",
            products: compactProducts
          })
        }
      ]
    });

    const output = safeJsonParse(responseText(response));
    return rankProducts(mergeAiOutput(ranked, output), context);
  } catch (error) {
    logger.warn({ error }, "OpenAI analysis failed; falling back to deterministic ranking");
    return ranked;
  }
}
