// Lab 02: Document Modeling — Embedding vs. Referencing
// Topics: one-to-one, one-to-many, many-to-many, 16MB limit, data access patterns
// Run: docker exec -it mongo1 mongosh --file /labs/02_document_modeling.js

db = db.getSiblingDB("mongo_labs");
print("\n=== Lab 02: Document Modeling ===\n");

// ─── EMBEDDING (Denormalization) ──────────────────────────────────────────────
// WHEN TO EMBED:
//   - Data is always accessed together (child lives with parent)
//   - One-to-few relationship (typically < 20 sub-documents)
//   - Sub-documents don't grow unboundedly
//   - Data doesn't need to be queried independently

// Example: User with embedded address (1-to-1, always read together)
db.users_embedded.drop();
db.users_embedded.insertOne({
  name: "Alice Johnson",
  email: "alice@example.com",
  // Address is embedded — fetched in ONE query alongside user data
  address: {
    street: "123 Main St",
    city: "New York",
    state: "NY",
    zip: "10001",
    country: "US"
  },
  // Array of embedded tags — small, bounded set
  tags: ["premium", "early-adopter"],
  // Embedded order summary — only recent orders, bounded
  recentOrders: [
    { orderId: "ord-001", total: 89.99, date: new Date("2024-04-01") },
    { orderId: "ord-002", total: 49.99, date: new Date("2024-04-12") }
  ]
});
print("Created users_embedded with nested address and order summary");

// Read: single query gets user + address in one round trip (no join!)
let embeddedUser = db.users_embedded.findOne({ email: "alice@example.com" });
print("Embedded user city:", embeddedUser.address.city);
print("Recent orders count:", embeddedUser.recentOrders.length);

// Query on embedded field using dot notation
let nycUsers = db.users_embedded.find({ "address.city": "New York" }).toArray();
print("NYC users (dot notation query):", nycUsers.length);

// ─── REFERENCING (Normalization) ─────────────────────────────────────────────
// WHEN TO REFERENCE:
//   - Data grows unboundedly (e.g., all orders for a user ever)
//   - Data is shared / referenced by many documents
//   - Sub-documents need independent querying/updating
//   - One-to-many or many-to-many with large cardinality

// Example: Orders stored in separate collection, linked by userId (reference)
db.users_ref.drop();
db.orders_ref.drop();

let userRef = db.users_ref.insertOne({
  name: "Bob Smith",
  email: "bob@example.com",
  address: { city: "San Francisco", country: "US" }
});
let bobId = userRef.insertedId;

// Orders reference the user via userId field (like a foreign key)
db.orders_ref.insertMany([
  { userId: bobId, status: "delivered", total: 349.99, orderedAt: new Date("2024-04-10") },
  { userId: bobId, status: "pending",   total: 49.99,  orderedAt: new Date("2024-04-20") },
  { userId: bobId, status: "shipped",   total: 199.99, orderedAt: new Date("2024-04-25") }
]);
print("\nCreated users_ref + orders_ref (referenced pattern)");

// Querying referenced data requires TWO queries (no joins in MongoDB driver)
let userDoc = db.users_ref.findOne({ _id: bobId });
let userOrders = db.orders_ref.find({ userId: bobId }).sort({ orderedAt: -1 }).toArray();
print("User:", userDoc.name, "| Total orders:", userOrders.length);

// OR use $lookup in aggregation pipeline to "join" (see Lab 07 for deep dive)
let result = db.users_ref.aggregate([
  { $match: { _id: bobId } },
  {
    $lookup: {
      from: "orders_ref",       // collection to join
      localField: "_id",         // field in users_ref
      foreignField: "userId",    // field in orders_ref
      as: "orders"               // output array field name
    }
  }
]).toArray();
print("$lookup joined orders count:", result[0].orders.length);

// ─── HYBRID PATTERN (Partial Embedding) ──────────────────────────────────────
// Best of both: embed a summary/subset, reference full data separately
// Real-world: shopping cart stores product name+price at time of purchase,
// but the full product catalog is in its own collection

db.orders_hybrid.drop();
db.orders_hybrid.insertOne({
  userId: bobId,
  status: "delivered",
  // Embed denormalized item snapshot (price at purchase time)
  // Do NOT reference by productId alone — prices change!
  items: [
    {
      productId: ObjectId("111111111111111111111111"),
      name: "Mechanical Keyboard",  // snapshot
      price: 89.99,                 // price at purchase time (not current)
      qty: 1
    }
  ],
  total: 89.99,
  orderedAt: new Date()
});
print("\nHybrid order: embedded item snapshot + reference to product catalog");

// ─── ONE-TO-MANY: Large Array Anti-Pattern ───────────────────────────────────
// ANTI-PATTERN: storing thousands of references in a single document array
// This can hit the 16MB document limit and degrades performance

// BAD: all order IDs in user document
// db.users.updateOne({_id: userId}, { $push: { orderIds: orderId } })
// ^ After 100k orders this document bloats, and the array is expensive to maintain

// BETTER: always store the reference on the "many" side (as done above)
print("\nAnti-pattern note: avoid storing large arrays of references (see comments)");

// ─── MANY-TO-MANY ────────────────────────────────────────────────────────────
// Option 1: Embed a small list of IDs on both sides (if cardinality is low)
// Option 2: Intermediate "edge" collection (like a join table)

db.courses.drop();
db.students.drop();
db.enrollments.drop();

db.courses.insertMany([
  { _id: ObjectId("c00000000000000000000001"), title: "MongoDB Basics" },
  { _id: ObjectId("c00000000000000000000002"), title: "Aggregation Mastery" }
]);
db.students.insertMany([
  { _id: ObjectId("s00000000000000000000001"), name: "Dave" },
  { _id: ObjectId("s00000000000000000000002"), name: "Eve" }
]);
// Edge collection for many-to-many
db.enrollments.insertMany([
  { studentId: ObjectId("s00000000000000000000001"), courseId: ObjectId("c00000000000000000000001"), enrolledAt: new Date() },
  { studentId: ObjectId("s00000000000000000000001"), courseId: ObjectId("c00000000000000000000002"), enrolledAt: new Date() },
  { studentId: ObjectId("s00000000000000000000002"), courseId: ObjectId("c00000000000000000000001"), enrolledAt: new Date() }
]);
db.enrollments.createIndex({ studentId: 1 });
db.enrollments.createIndex({ courseId: 1 });

let daveCourses = db.enrollments.find({ studentId: ObjectId("s00000000000000000000001") }).toArray();
print("\nDave's enrollments:", daveCourses.length);

// ─── Summary ──────────────────────────────────────────────────────────────────
print("\n=== Lab 02 Complete ===");
print("Embedding:   single query, great for 1-to-few, co-accessed data");
print("Referencing: flexible, great for 1-to-many, shared data, large cardinality");
print("Hybrid:      embed snapshot for read performance, reference for canonical data");
print("Many-to-many: use an 'edge' (enrollment) collection with indexes on both FKs");
print("Rule of thumb: embed if you always read it together; reference if it grows unboundedly");

