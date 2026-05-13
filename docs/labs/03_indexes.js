// Lab 03: Indexes
// Topics: single-field, compound, multikey, text, partial, sparse indexes; explain()
// Run: docker exec -it mongo1 mongosh --file /labs/03_indexes.js

db = db.getSiblingDB("mongo_labs");
print("\n=== Lab 03: Indexes ===\n");

// ─── View existing indexes ────────────────────────────────────────────────────
print("Current indexes on 'products':");
db.products.getIndexes().forEach(idx => print(" -", JSON.stringify(idx.key), "name:", idx.name));

// ─── Single-Field Index ───────────────────────────────────────────────────────
// 1 = ascending, -1 = descending (for single-field, direction rarely matters for equality)
// Speeds up: find({price: x}), sort({price:1}), range queries on price
db.products.createIndex({ price: 1 }, { name: "idx_price_asc" });
print("\nCreated single-field index on price");

// ─── Compound Index ───────────────────────────────────────────────────────────
// Index on multiple fields. Field ORDER matters:
//   - Supports queries on (category), (category + price), but NOT price alone
//   - ESR Rule: Equality fields first, Sort fields second, Range fields last
db.products.createIndex({ category: 1, price: -1 }, { name: "idx_category_price" });
print("Created compound index on (category ASC, price DESC)");

// ─── Unique Index ─────────────────────────────────────────────────────────────
// Prevents duplicate values. Automatically created on _id.
// If duplicates exist, creation fails — fix data first.
db.users.createIndex({ email: 1 }, { unique: true, name: "idx_users_email_uniq" });
print("Created unique index on users.email");

// ─── Multikey Index ───────────────────────────────────────────────────────────
// Automatically created when indexing an array field.
// MongoDB indexes each element of the array individually.
// Caveat: cannot have TWO array fields in the same compound index.
db.users.createIndex({ tags: 1 }, { name: "idx_users_tags" });
print("Created multikey index on users.tags (array field)");

// Query using multikey index — finds docs where tags array contains 'premium'
let premiumUsers = db.users.find({ tags: "premium" }).toArray();
print("Premium users (multikey query):", premiumUsers.map(u => u.name));

// ─── Text Index ───────────────────────────────────────────────────────────────
// Full-text search on string fields. Only ONE text index per collection.
// Supports: $text + $search operator
db.products.createIndex({ name: "text", category: "text" }, { name: "idx_products_text" });
print("\nCreated text index on products (name + category)");

let textResults = db.products.find(
  { $text: { $search: "keyboard" } },
  { score: { $meta: "textScore" }, name: 1, _id: 0 }
).sort({ score: { $meta: "textScore" } }).toArray();
print("Text search 'keyboard':", textResults.map(r => r.name));

// ─── Partial Index ────────────────────────────────────────────────────────────
// Index only documents matching a filter expression.
// Smaller index size, faster writes, targeted queries.
// Use case: index only active/pending orders (skip archived ones)
db.orders.createIndex(
  { userId: 1, orderedAt: -1 },
  { partialFilterExpression: { status: { $in: ["pending", "shipped"] } }, name: "idx_orders_active" }
);
print("\nCreated partial index on orders (only pending/shipped status)");

// ─── Sparse Index ─────────────────────────────────────────────────────────────
// Only indexes documents that HAVE the indexed field (skips nulls/missing).
// Useful for optional fields that are sparse in the collection.
db.products.createIndex({ onSale: 1 }, { sparse: true, name: "idx_products_onsale_sparse" });
print("Created sparse index on products.onSale (optional field)");

// ─── TTL Index ────────────────────────────────────────────────────────────────
// Automatically deletes documents after a specified number of seconds.
// The indexed field MUST be a Date. Background thread runs every ~60 seconds.
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600, name: "idx_sessions_ttl" });
print("TTL index already exists on sessions.createdAt (1 hour expiry)");

// ─── explain() — Query Execution Plan ────────────────────────────────────────
// "queryPlanner"    → shows winning plan (no execution)
// "executionStats"  → runs query + shows index usage, docs examined
// "allPlansExecution" → compares all candidate plans

print("\n--- explain() on products.find({category:'peripherals', price:{$lt:100}}) ---");
let plan = db.products.find(
  { category: "peripherals", price: { $lt: 100 } }
).explain("executionStats");

let stage = plan.executionStats;
print("Total docs examined:", stage.totalDocsExamined);
print("Total docs returned:", stage.totalDocsReturned);
print("Winning plan stage:", plan.queryPlanner.winningPlan.stage);
// IXSCAN = index scan (good), COLLSCAN = full collection scan (bad for large collections)

// ─── Covered Query ────────────────────────────────────────────────────────────
// A query is "covered" if ALL fields in filter + projection are in the index.
// MongoDB doesn't need to fetch the document from disk — just reads the index.
print("\n--- Covered query (category + price, projection matches compound index) ---");
let coveredPlan = db.products.find(
  { category: "peripherals" },
  { _id: 0, category: 1, price: 1 }
).explain("executionStats");
print("Winning plan:", coveredPlan.queryPlanner.winningPlan.stage);
// Should show PROJECTION_COVERED → IXSCAN (never touches the document store)

// ─── Drop an index ────────────────────────────────────────────────────────────
db.products.dropIndex("idx_price_asc");
print("\nDropped idx_price_asc");

print("\n=== Lab 03 Complete ===");
print("Key takeaways:");
print("  - Indexes dramatically speed up reads but slow down writes (maintain on every write)");
print("  - Compound index field order matters: ESR rule (Equality, Sort, Range)");
print("  - Multikey indexes expand array elements individually");
print("  - Use explain('executionStats') to verify IXSCAN vs COLLSCAN");
print("  - Partial indexes reduce index size by filtering which docs are indexed");
print("  - Covered queries (all fields in index) are the fastest possible reads");

