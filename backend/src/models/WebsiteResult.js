// Mongoose removed: export a safe stub so the codebase can run with in-memory storage.
const unavailable = () => {
  throw new Error("Mongoose model unavailable because MongoDB is disabled. Set MONGODB_URI to enable MongoDB.");
};

const stub = {
  insertMany: async () => unavailable(),
  find: async () => unavailable()
};

export default stub;
