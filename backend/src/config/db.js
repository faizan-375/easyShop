import { env } from "./env.js";
import { logger } from "../utils/logger.js";

let mongoose;
let databaseMode = "memory";
let connectionPromise;

export async function connectDatabase() {
  if (usingMongo()) {
    return databaseMode;
  }

  if (!env.MONGODB_URI) {
    logger.warn("MONGODB_URI is not set. Using in-memory storage for this session.");
    return databaseMode;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    // load mongoose only when we have an URI to avoid requiring the package when
    // the project is running in memory-only mode (mongoose may be uninstalled).
    // Use a runtime loader to avoid static analysis by the bundler (Turbopack)
    // which attempts to resolve dynamic imports at build time.
    try {
      const loader = new Function("return import('mongoose')");
      const m = await loader();
      mongoose = m.default || m;
    } catch (err) {
      connectionPromise = undefined;
      logger.warn({ err }, 'Failed to load mongoose; falling back to in-memory storage.');
      databaseMode = 'memory';
      return databaseMode;
    }
    mongoose.set("strictQuery", true);
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
    } catch (error) {
      connectionPromise = undefined;
      if (env.NODE_ENV === "production") {
        throw error;
      }

      logger.warn({ error }, "MongoDB is unavailable. Falling back to in-memory storage for development.");
      databaseMode = "memory";
      return databaseMode;
    }

    databaseMode = "mongo";
    logger.info("Connected to MongoDB");
    return databaseMode;
  })();

  return connectionPromise;
}

export function usingMongo() {
  return databaseMode === "mongo" && mongoose && mongoose.connection && mongoose.connection.readyState === 1;
}
