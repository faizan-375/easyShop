import { ZodError } from "zod";
import { connectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import { logger } from "../utils/logger.js";

let databasePromise;

export async function ensureDatabase() {
  if (!databasePromise) {
    databasePromise = connectDatabase().catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

function allowedOrigin(request) {
  const origin = request?.headers?.get("origin");
  if (!origin) return "*";

  const allowed = [env.CLIENT_URL]
    .concat(env.CLIENT_URLS ? env.CLIENT_URLS.split(",").map((url) => url.trim()).filter(Boolean) : [])
    .concat(["chrome-extension://"])
    .filter(Boolean);

  const matches = allowed.some((allowedOrigin) => {
    if (!allowedOrigin) return false;
    return origin === allowedOrigin || origin.startsWith(allowedOrigin);
  });

  if (matches) return origin;
  if (env.NODE_ENV !== "production") return origin;
  return "";
}

export function corsHeaders(request) {
  const origin = allowedOrigin(request);
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400"
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function options(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request)
  });
}

export function json(request, payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: corsHeaders(request)
  });
}

function errorPayload(error) {
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: "Validation failed",
        details: error.flatten().fieldErrors
      }
    };
  }

  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        details: error.details
      }
    };
  }

  logger.error({ error }, "API route failed");
  return {
    status: 500,
    body: { error: "Internal server error" }
  };
}

export async function routeHandler(request, handler) {
  try {
    await ensureDatabase();
    return await handler();
  } catch (error) {
    const { status, body } = errorPayload(error);
    return json(request, body, status);
  }
}
