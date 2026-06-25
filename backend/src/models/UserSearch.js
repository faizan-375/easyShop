// Mongoose removed: export a safe stub so the codebase can run with in-memory storage.
const unavailable = () => {
  throw new Error("Mongoose model unavailable because MongoDB is disabled. Set MONGODB_URI to enable MongoDB.");
};

const stub = {
  create: async () => unavailable(),
  findByIdAndUpdate: async () => unavailable(),
  findById: async () => unavailable(),
  find: async () => unavailable(),
  // keep generic fallbacks in case other code invokes model methods
  insertMany: async () => unavailable(),
  deleteMany: async () => unavailable()
};

export default stub;
