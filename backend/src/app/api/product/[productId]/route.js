import { getProduct } from "../../../../data/repository.js";
import { json, options, routeHandler } from "../../../../lib/apiResponse.js";
import { HttpError } from "../../../../utils/httpError.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request) {
  return options(request);
}

export async function GET(request, context) {
  return routeHandler(request, async () => {
    const { productId } = await context.params;
    const product = await getProduct(productId);
    if (!product) throw new HttpError(404, "Product not found");
    return json(request, { product });
  });
}
