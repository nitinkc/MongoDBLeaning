// Lab 07: Advanced Aggregation — $lookup, $facet, $bucket, $graphLookup
// Run: docker exec -it mongo1 mongosh --file /labs/07_advanced_aggregation.js

db = db.getSiblingDB("mongo_labs");
print("\n=== Lab 07: Advanced Aggregation ===\n");

// ─── $lookup — Join Two Collections ─────────────────────────────────────────
// Performs a left outer join between the input documents and another collection.
// NOT as efficient as SQL joins — use only when data modeling requires it.
// Better option: embed data at write time to avoid runtime joins.

print("--- $lookup (simple): join orders with user details ---");
db.orders.aggregate([
  { $match: { status: "delivered" } },
  {
    $lookup: {
      from: "users",         // collection to join
      localField: "userId",  // field in orders (ObjectId)
      foreignField: "_id",   // field in users
      as: "userDetails"      // array output field
    }
  },
  { $unwind: { path: "$userDetails", preserveNullAndEmpty: true } },
  {
    $project: {
      _id: 0,
      order: "$_id",
      customer: "$userDetails.name",
      email: "$userDetails.email",
      total: 1,
      status: 1
    }
  }
]).forEach(r => print(` - Order ${r.order}: ${r.customer} (${r.email}) $${r.total}`));

// $lookup with pipeline (MongoDB 3.6+): more powerful — supports conditions, sub-pipelines
print("\n--- $lookup (pipeline variant): orders with only pending items ---");
db.users.aggregate([
  { $match: { name: "Alice Johnson" } },
  {
    $lookup: {
      from: "orders",
      let: { userId: "$_id" },          // pass local fields as variables
      pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ["$userId", "$$userId"] },   // $$var references the let variable
          { $ne: ["$status", "delivered"] }
        ]}}},
        { $sort: { orderedAt: -1 } },
        { $project: { _id: 1, status: 1, total: 1 } }
      ],
      as: "activeOrders"
    }
  },
  { $project: { _id: 0, name: 1, activeOrders: 1 } }
]).forEach(r => print(` - ${r.name} active orders:`, JSON.stringify(r.activeOrders)));

// ─── $facet — Multi-Faceted Aggregation ──────────────────────────────────────
// Runs multiple aggregation pipelines on the SAME input documents simultaneously.
// Returns a single document with one field per sub-pipeline.
// Use case: e-commerce "search results + filters" in a single query.

print("\n--- $facet: products summary (stats + by category + price buckets) ---");
db.products.aggregate([
  {
    $facet: {
      // Facet 1: overall statistics
      stats: [
        { $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          avgPrice: { $avg: "$price" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" }
        }}
      ],
      // Facet 2: count by category
      byCategory: [
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ],
      // Facet 3: price range distribution
      priceRanges: [
        { $bucket: {
          groupBy: "$price",
          boundaries: [0, 50, 100, 250, 500],
          default: "500+",
          output: { count: { $sum: 1 }, products: { $push: "$name" } }
        }}
      ]
    }
  }
]).forEach(r => {
  print("  Stats:", JSON.stringify(r.stats[0]));
  print("  By Category:", JSON.stringify(r.byCategory));
  print("  Price Ranges:", JSON.stringify(r.priceRanges));
});

// ─── $bucket / $bucketAuto ────────────────────────────────────────────────────
// $bucket: manually defined boundaries
// $bucketAuto: MongoDB automatically determines bucket boundaries for even distribution

print("\n--- $bucket: products grouped by price range ---");
db.products.aggregate([
  {
    $bucket: {
      groupBy: "$price",
      boundaries: [0, 50, 100, 500],
      default: "Other",
      output: {
        count: { $sum: 1 },
        avgPrice: { $avg: "$price" },
        names: { $push: "$name" }
      }
    }
  }
]).forEach(b => print(` - $${b._id}–: count=${b.count}, avg=$${b.avgPrice?.toFixed(2)}, items=${b.names}`));

print("\n--- $bucketAuto: auto 3 equal-distribution buckets ---");
db.products.aggregate([
  { $bucketAuto: { groupBy: "$price", buckets: 3 } }
]).forEach(b => print(` - Range $${b._id.min.toFixed(2)} to $${b._id.max.toFixed(2)}: ${b.count} products`));

// ─── $graphLookup — Recursive / Graph Traversal ───────────────────────────────
// Recursively looks up documents in the same or another collection.
// Use case: org charts (who reports to whom), category hierarchies, friend networks.

db.employees.drop();
db.employees.insertMany([
  { _id: 1, name: "CEO",        reportsTo: null },
  { _id: 2, name: "VP Eng",     reportsTo: "CEO" },
  { _id: 3, name: "VP Sales",   reportsTo: "CEO" },
  { _id: 4, name: "Sr Engineer",reportsTo: "VP Eng" },
  { _id: 5, name: "Engineer",   reportsTo: "Sr Engineer" },
  { _id: 6, name: "Sales Rep",  reportsTo: "VP Sales" }
]);

print("\n--- $graphLookup: reporting chain for 'Engineer' ---");
db.employees.aggregate([
  { $match: { name: "Engineer" } },
  {
    $graphLookup: {
      from: "employees",
      startWith: "$reportsTo",      // start traversal from this field value
      connectFromField: "reportsTo", // follow this field upward
      connectToField: "name",        // match against this field
      as: "reportingChain",          // output array
      maxDepth: 5,                   // prevent infinite loops
      depthField: "depth"            // add depth level to each result
    }
  },
  { $project: { name: 1, reportingChain: { $sortArray: { input: "$reportingChain", sortBy: { depth: 1 } } } } }
]).forEach(r => {
  print(` - ${r.name} reports up through:`);
  r.reportingChain.forEach(m => print(`   depth ${m.depth}: ${m.name}`));
});

// ─── $setWindowFields — Windowed Aggregations (MongoDB 5.0+) ──────────────────
// Like SQL window functions (ROW_NUMBER, RANK, running totals, moving averages).
// Does NOT reduce the number of documents — each doc gets a computed window value.

print("\n--- $setWindowFields: running total of order revenue (sorted by date) ---");
db.orders.aggregate([
  { $sort: { orderedAt: 1 } },
  {
    $setWindowFields: {
      partitionBy: "$userName",      // reset running total per user
      sortBy: { orderedAt: 1 },
      output: {
        runningTotal: {
          $sum: "$total",
          window: { documents: ["unbounded", "current"] }  // from start to current doc
        },
        orderRank: {
          $rank: {}  // rank within partition by orderedAt
        }
      }
    }
  },
  { $project: { _id: 0, userName: 1, total: 1, runningTotal: 1, orderRank: 1 } }
]).forEach(r => print(` - ${r.userName} rank=${r.orderRank}: $${r.total} (running: $${r.runningTotal.toFixed(2)})`));

print("\n=== Lab 07 Complete ===");
print("Key takeaways:");
print("  - $lookup joins at query time — prefer embedding for performance-critical paths");
print("  - $lookup with pipeline lets you filter/shape the joined data");
print("  - $facet runs multiple sub-pipelines on the same input — great for search UIs");
print("  - $bucket/$bucketAuto create histogram-style groupings");
print("  - $graphLookup enables recursive tree/graph traversal (org charts, hierarchies)");
print("  - $setWindowFields adds running totals, ranks, and moving averages (MongoDB 5.0+)");

