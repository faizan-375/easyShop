import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(dirname, "../../../.env") });
dotenv.config({ path: path.resolve(dirname, "../../.env") });
dotenv.config();

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return Boolean(value);
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  CLIENT_URLS: z.string().optional(),
  SEARCH_PROVIDER: z.enum(["auto", "serpapi", "google-cse"]).default("auto"),
  MONGODB_URI: z.string().optional(),
  SERPAPI_API_KEY: z.string().optional(),
  GOOGLE_CSE_API_KEY: z.string().optional(),
  GOOGLE_CSE_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GOOGLE_SEARCH_PAGES: z.coerce.number().int().min(1).max(10).default(2),
  MAX_TOTAL_SEARCH_PAGES: z.coerce.number().int().min(1).max(120).default(15),
  MAX_SHOPPING_RESULTS: z.coerce.number().int().min(5).max(100).default(30),
  MAX_PRODUCT_PAGES: z.coerce.number().int().min(5).max(100).default(30),
  PRODUCT_LINKS_PER_LISTING: z.coerce.number().int().min(1).max(12).default(4),
  SEARCH_KEYWORD_LIMIT: z.coerce.number().int().min(1).max(12).default(6),
  EXTRACTION_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(8),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(3000).max(45000).default(8000),
  ENABLE_PLAYWRIGHT: booleanFromEnv.default(true),
  SCRAPER_RETRIES: z.coerce.number().int().min(0).max(5).default(1),
  SCRAPER_HEADLESS: booleanFromEnv.default(true),
  PLAYWRIGHT_EXECUTABLE_PATH: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
