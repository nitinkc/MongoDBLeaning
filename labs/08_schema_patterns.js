// Lab 08: Schema Design Patterns
// Topics: Bucket, Computed, Polymorphic, Outlier, Subset patterns
// Run: docker exec -it mongo1 mongosh --file /labs/08_schema_patterns.js

db = db.getSiblingDB("mongo_labs");
print("\n=== Lab 08: Schema Design Patterns ===\n");

// ─── 1. BUCKET PATTERN ───────────────────────────────────────────────────────
// Problem: Millions of individual time-series events (one doc per event) creates
//          huge number of small documents → high index overhead, poor performance.
// Solution: Group a fixed number of events into a single "bucket" document.
// Use cases: IoT sensor data, metrics, stock ticks, server logs.

db.sensor_readings.drop();

// BAD: one document per reading (100k readings = 100k docs, 100k index entries)
// db.sensor_readings.insertOne({ sensorId: "s1", ts: new Date(), temp: 22.4 });

// GOOD: bucket 60 readings per document (1 hour of per-minute data = 1 document)
db.sensor_buckets.drop();
db.sensor_buckets.createIndex({ sensorId: 1, hour: 1 }, { unique: true });

// Simulate bucketed writes using $push and $inc
const sensorId = "sensor-001";
const hour = "2026-04-10T10:00";

db.sensor_buckets.updateOne(
  { sensorId, hour },
  {
    $push: { readings: { ts: new Date("2026-04-10T10:01:00Z"), temp: 22.4, humidity: 55 } },
    $inc:  { count: 1 },
    $min:  { minTemp: 22.4 },
    $max:  { maxTemp: 22.4 },
    $setOnInsert: { sensorId, hour, createdAt: new Date() }
  },
  { upsert: true }
);

// Add more readings to the same bucket
[22.6, 22.5, 23.1, 22.9].forEach((temp, i) => {
  db.sensor_buckets.updateOne(
    { sensorId, hour },
    {
      $push: { readings: { ts: new Date(`2026-04-10T10:0${i+2}:00Z`), temp, humidity: 54 + i } },
      $inc:  { count: 1 },
      $min:  { minTemp: temp },
      $max:  { maxTemp: temp }
    }
  );
});

let bucket = db.sensor_buckets.findOne({ sensorId });
print(`Bucket pattern: sensorId=${bucket.sensorId}, hour=${bucket.hour}, readings=${bucket.count}`);
print(`  Temp range: ${bucket.minTemp}–${bucket.maxTemp}°C`);

// ─── 2. COMPUTED PATTERN ─────────────────────────────────────────────────────
// Problem: Expensive aggregations run repeatedly on every read (e.g., average rating).
// Solution: Pre-compute and store the result on write; update it incrementally.
// Trade-off: Slightly stale data (acceptable for most use cases).
// Use cases: product ratings, view counts, inventory summaries.

db.products_computed.drop();
db.products_computed.insertOne({
  _id: "prod-001",
  name: "Mechanical Keyboard",
  // Pre-computed stats — updated on each new review write
  ratingStats: { total: 450, count: 100, avg: 4.5 }
});

// When a new review comes in, update the computed fields atomically
const newRating = 5;
db.products_computed.updateOne(
  { _id: "prod-001" },
  {
    $inc: {
      "ratingStats.total": newRating,
      "ratingStats.count": 1
    }
  }
);
// Recompute avg (or use application-side after the inc)
let prod = db.products_computed.findOne({ _id: "prod-001" });
let newAvg = prod.ratingStats.total / prod.ratingStats.count;
db.products_computed.updateOne({ _id: "prod-001" }, { $set: { "ratingStats.avg": newAvg } });
prod = db.products_computed.findOne({ _id: "prod-001" });
print(`\nComputed pattern: ${prod.name} avg rating = ${prod.ratingStats.avg.toFixed(2)} (${prod.ratingStats.count} reviews)`);

// ─── 3. POLYMORPHIC PATTERN ──────────────────────────────────────────────────
// Problem: Different entity types share common fields but have different specific fields.
// Solution: Store all types in one collection with a 'type' discriminator field.
// Use cases: product catalog (books, electronics, clothing), user activity events.

db.catalog.drop();
db.catalog.insertMany([
  {
    type: "book",
    name: "MongoDB: The Definitive Guide",
    price: 39.99,
    // Book-specific fields
    author: "Shannon Bradshaw",
    isbn: "978-1-491-95402-9",
    pages: 514
  },
  {
    type: "electronics",
    name: "Wireless Headphones",
    price: 149.99,
    // Electronics-specific fields
    brand: "Sony",
    batteryHours: 30,
    bluetoothVersion: "5.2"
  },
  {
    type: "clothing",
    name: "Dev Hoodie",
    price: 49.99,
    // Clothing-specific fields
    sizes: ["S", "M", "L", "XL"],
    material: "80% cotton, 20% polyester",
    color: "charcoal"
  }
]);

print("\nPolymorphic pattern — all items in one collection:");
db.catalog.find({}, { _id: 0, type: 1, name: 1, price: 1 }).forEach(item =>
  print(` - [${item.type}] ${item.name} $${item.price}`)
);

// Query only electronics
db.catalog.find({ type: "electronics" }, { name: 1, brand: 1, batteryHours: 1, _id: 0 })
  .forEach(e => print(`   Electronics: ${e.name} by ${e.brand}, ${e.batteryHours}h battery`));

// ─── 4. OUTLIER PATTERN ───────────────────────────────────────────────────────
// Problem: Most documents have a small array, but a few "outlier" docs have huge arrays
//          that bloat those documents and hit the 16MB BSON limit.
// Solution: Store main data normally. For outliers, use an overflow collection.
// Use cases: celebrity social media posts (millions of likes), viral content.

db.posts.drop();
db.post_followers_overflow.drop();

// Normal post — small audience
db.posts.insertOne({
  _id: "post-normal",
  author: "alice",
  content: "Learning MongoDB!",
  likes: [ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"), ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb")],
  hasOverflow: false
});

// Viral post — too many likes to fit in one document (outlier)
// Store first 1000 in the main doc, rest in overflow
db.posts.insertOne({
  _id: "post-viral",
  author: "celebrity",
  content: "Big announcement!",
  likes: [ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa")],  // first batch
  hasOverflow: true   // flag to check overflow collection
});
db.post_followers_overflow.insertOne({
  postId: "post-viral",
  page: 2,
  likes: [ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb"), ObjectId("cccccccccccccccccccccccc")]
});

print("\nOutlier pattern — viral post has overflow flag:");
let viralPost = db.posts.findOne({ _id: "post-viral" });
print(`  Post: "${viralPost.content}", hasOverflow: ${viralPost.hasOverflow}`);
if (viralPost.hasOverflow) {
  let overflow = db.post_followers_overflow.find({ postId: "post-viral" }).toArray();
  print(`  Overflow pages: ${overflow.length}, extra likes: ${overflow.reduce((s,p) => s + p.likes.length, 0)}`);
}

// ─── 5. SUBSET PATTERN ───────────────────────────────────────────────────────
// Problem: Document has large arrays (e.g., all reviews) but you only need the
//          most recent N on the main page. Full document bloats working set in RAM.
// Solution: Store only a subset (e.g., last 5 reviews) in the main document;
//           keep full history in a separate collection.

db.products_subset.drop();
db.reviews.drop();

db.products_subset.insertOne({
  _id: "prod-sub-001",
  name: "Curved Monitor",
  price: 349.99,
  // Only the 5 most recent reviews embedded for fast display
  recentReviews: [
    { user: "alice", rating: 5, comment: "Excellent!", date: new Date("2026-04-01") },
    { user: "bob",   rating: 4, comment: "Great value", date: new Date("2026-04-05") }
  ],
  reviewCount: 2,
  avgRating: 4.5
});
// Full review history in separate collection
db.reviews.insertMany([
  { productId: "prod-sub-001", user: "alice", rating: 5, comment: "Excellent!", date: new Date("2026-04-01") },
  { productId: "prod-sub-001", user: "bob",   rating: 4, comment: "Great value", date: new Date("2026-04-05") }
]);

print("\nSubset pattern — product with embedded recent reviews:");
let subsetProd = db.products_subset.findOne({ _id: "prod-sub-001" }, { name: 1, recentReviews: 1, reviewCount: 1, _id: 0 });
print(`  ${subsetProd.name}: ${subsetProd.reviewCount} total reviews, ${subsetProd.recentReviews.length} embedded`);

print("\n=== Lab 08 Complete ===");
print("Key takeaways:");
print("  - Bucket: group time-series events into fixed buckets → fewer docs, better performance");
print("  - Computed: pre-calculate expensive aggregations at write time → fast reads");
print("  - Polymorphic: use a 'type' discriminator to store different shapes in one collection");
print("  - Outlier: handle rare large documents with an overflow collection + flag");
print("  - Subset: embed only the most-used subset of an array, keep full data separately");

