import { after } from "next/server";
import { z } from "zod";
import { createUserSearch } from "../../../data/repository.js";
import { json, options, routeHandler } from "../../../lib/apiResponse.js";
import { generateKeywords } from "../../../services/keywordService.js";
import { startSearchPipeline } from "../../../services/searchPipeline.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const createSearchSchema = z.object({
  productName: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120)
});

export function OPTIONS(request) {
  return options(request);
}

export async function POST(request) {
  return routeHandler(request, async () => {
    const body = createSearchSchema.parse(await request.json());
    const generatedKeywords = generateKeywords(body.productName, body.location);
    const search = await createUserSearch({
      ...body,
      generatedKeywords,
      status: "queued",
      progress: 0
    });

    after(() => startSearchPipeline(search));

    return json(
      request,
      {
        searchId: search.id,
        search,
        generatedKeywords
      },
      202
    );
  });
}
