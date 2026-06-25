import { getExtractionFailures, getProductsBySearch, getUserSearch, getWebsiteResults } from "../../../../data/repository.js";
import { json, options, routeHandler } from "../../../../lib/apiResponse.js";
import { buildResultSummary } from "../../../../services/rankingService.js";
import { HttpError } from "../../../../utils/httpError.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sortCheapestFirst(products) {
  return [...products].sort((a, b) => {
    const aPrice = Number.isFinite(a.normalizedPrice) ? a.normalizedPrice : Number.POSITIVE_INFINITY;
    const bPrice = Number.isFinite(b.normalizedPrice) ? b.normalizedPrice : Number.POSITIVE_INFINITY;
    return aPrice - bPrice || (b.overallScore || 0) - (a.overallScore || 0);
  });
}

export function OPTIONS(request) {
  return options(request);
}

export async function GET(request, context) {
  return routeHandler(request, async () => {
    const { searchId } = await context.params;
    const search = await getUserSearch(searchId);
    if (!search) throw new HttpError(404, "Search not found");

    const [websites, products, failures] = await Promise.all([
      getWebsiteResults(searchId),
      getProductsBySearch(searchId),
      getExtractionFailures(searchId)
    ]);

    const sortedProducts = sortCheapestFirst(products);

    return json(request, {
      search,
      websites,
      products: sortedProducts,
      failures,
      summary: buildResultSummary(sortedProducts)
    });
  });
}
