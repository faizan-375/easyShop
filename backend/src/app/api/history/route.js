import { listUserSearches } from "../../../data/repository.js";
import { json, options, routeHandler } from "../../../lib/apiResponse.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request) {
  return options(request);
}

export async function GET(request) {
  return routeHandler(request, async () => {
    const history = await listUserSearches(50);
    return json(request, { history });
  });
}
