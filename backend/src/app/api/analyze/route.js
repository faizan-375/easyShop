import { z } from "zod";
import { getUserSearch } from "../../../data/repository.js";
import { json, options, routeHandler } from "../../../lib/apiResponse.js";
import { restartAnalysis } from "../../../services/searchPipeline.js";
import { HttpError } from "../../../utils/httpError.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const analyzeSchema = z.object({
  searchId: z.string().min(1)
});

export function OPTIONS(request) {
  return options(request);
}

export async function POST(request) {
  return routeHandler(request, async () => {
    const { searchId } = analyzeSchema.parse(await request.json());
    const search = await getUserSearch(searchId);
    if (!search) throw new HttpError(404, "Search not found");

    const products = await restartAnalysis(searchId);
    return json(request, { products });
  });
}
