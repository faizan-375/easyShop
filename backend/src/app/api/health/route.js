import { json, options, routeHandler } from "../../../lib/apiResponse.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request) {
  return options(request);
}

export async function GET(request) {
  return routeHandler(request, async () => {
    return json(request, { ok: true, name: "easyShop API", runtime: "nextjs" });
  });
}
