// Lab 04: Aggregation Pipeline — Core Stages
// Topics: $match, $group, $project, $sort, $limit, $unwind, $addFields, $count
// Run: docker exec -it mongo1 mongosh --file /labs/04_aggregation_pipeline.js

db = db.getSiblingDB("mongo_labs");
print("\n=== Lab 04: Aggregation Pipeline ===\n");

// The aggregation pipeline is a sequence of stages.
// Each stage transforms the documents flowing through it.
// Stages are processed in order — output of one is input to next.

// ─── $match — Filter documents (like find's query filter) ────────────────────
// Always put $match as EARLY as possible to reduce documents in later stages.
// If $match is the first stage and uses an indexed field, it uses the index.
print("--- $match: orders with status 'delivered' ---");
db.orders.aggregate([
  { $match: { status: "delivered" } }
]).forEach(o => print(" -", o.userName, o.total));

// ─── $group — Group and accumulate ───────────────────────────────────────────
// _id defines the grouping key (null = group all docs into one)
// Accumulators: $sum, $avg, $min, $max, $count, $push, $addToSet, $first, $last
print("\n--- $group: total revenue and order count per status ---");
db.orders.aggregate([
  {
    $group: {
      _id: "$status",                          // group by status field
      totalRevenue: { $sum: "$total" },         // sum the 'total' field
      orderCount:   { $sum: 1 },               // count documents in each group
      avgOrderValue: { $avg: "$total" }         // average order value
    }
  },
  { $sort: { totalRevenue: -1 } }              // sort by revenue descending
]).forEach(r => print(` - ${r._id}: count=${r.orderCount}, revenue=$${r.totalRevenue.toFixed(2)}, avg=$${r.avgOrderValue.toFixed(2)}`));

// ─── $project — Reshape documents ────────────────────────────────────────────
// 1 = include field, 0 = exclude field
// Can add computed fields using expressions
print("\n--- $project: reshape orders with computed discount field ---");
db.orders.aggregate([
  { $match: { status: { $in: ["delivered", "shipped"] } } },
  {
    $project: {
      _id: 0,
      customer: "$userName",              // rename field
      orderTotal: "$total",
      tax: { $multiply: ["$total", 0.1] }, // computed: 10% tax
      status: 1
    }
  }
]).forEach(o => print(` - ${o.customer}: $${o.orderTotal} + tax $${o.tax.toFixed(2)}`));

// ─── $addFields — Add new fields without removing existing ones ───────────────
// Unlike $project, keeps all existing fields and just adds/overrides specified ones
print("\n--- $addFields: add discountedTotal field ---");
db.orders.aggregate([
  { $match: { total: { $gt: 50 } } },
  { $addFields: { discountedTotal: { $multiply: ["$total", 0.9] } } },  // 10% off
  { $project: { _id: 0, userName: 1, total: 1, discountedTotal: 1 } }
]).forEach(o => print(` - ${o.userName}: original=$${o.total}, discounted=$${o.discountedTotal.toFixed(2)}`));

// ─── $unwind — Deconstruct an array field ────────────────────────────────────
// Produces one document per array element.
// Use with $group afterward to aggregate across array elements.
print("\n--- $unwind: deconstruct order items array ---");
db.orders.aggregate([
  { $unwind: "$items" },               // one doc per item in the items array
  { $project: { _id: 0, userName: 1, "items.name": 1, "items.price": 1, "items.qty": 1 } }
]).forEach(o => print(` - ${o.userName}: ${o.items.name} x${o.items.qty} @ $${o.items.price}`));

// $unwind + $group: total quantity sold per product across all orders
print("\n--- $unwind + $group: total qty sold per product ---");
db.orders.aggregate([
  { $unwind: "$items" },
  {
    $group: {
      _id: "$items.name",
      totalQty:     { $sum: "$items.qty" },
      totalRevenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } }
    }
  },
  { $sort: { totalRevenue: -1 } }
]).forEach(r => print(` - ${r._id}: qty=${r.totalQty}, revenue=$${r.totalRevenue.toFixed(2)}`));

// ─── $sort + $limit + $skip ───────────────────────────────────────────────────
// Pagination pattern
print("\n--- $sort + $limit + $skip: paginate orders (page 1, size 2) ---");
const PAGE = 0, SIZE = 2;
db.orders.aggregate([
  { $sort: { orderedAt: -1 } },
  { $skip: PAGE * SIZE },
  { $limit: SIZE },
  { $project: { _id: 0, userName: 1, total: 1, status: 1, orderedAt: 1 } }
]).forEach(o => print(` - ${o.userName}: $${o.total} [${o.status}]`));

// ─── $count — Count documents in pipeline ────────────────────────────────────
print("\n--- $count: number of orders over $100 ---");
db.orders.aggregate([
  { $match: { total: { $gt: 100 } } },
  { $count: "ordersOver100" }
]).forEach(r => print(" - Orders over $100:", r.ordersOver100));

// ─── $sortByCount — Shorthand for $group + $sort by count ────────────────────
print("\n--- $sortByCount: orders per user ---");
db.orders.aggregate([
  { $sortByCount: "$userName" }
]).forEach(r => print(` - ${r._id}: ${r.count} orders`));

// ─── Real pipeline: revenue summary per user ─────────────────────────────────
print("\n--- Full pipeline: revenue summary per user ---");
db.orders.aggregate([
  { $match: { status: { $ne: "cancelled" } } },
  { $group: {
      _id: "$userName",
      totalSpent:  { $sum: "$total" },
      orderCount:  { $sum: 1 },
      avgOrder:    { $avg: "$total" },
      latestOrder: { $max: "$orderedAt" }
  }},
  { $sort: { totalSpent: -1 } },
  { $project: {
      _id: 0,
      customer:    "$_id",
      totalSpent:  { $round: ["$totalSpent", 2] },
      orderCount:  1,
      avgOrder:    { $round: ["$avgOrder", 2] }
  }}
]).forEach(r => print(` - ${r.customer}: spent=$${r.totalSpent}, orders=${r.orderCount}, avg=$${r.avgOrder}`));

print("\n=== Lab 04 Complete ===");
print("Key takeaways:");
print("  - Pipeline stages process docs sequentially — order matters");
print("  - $match early to reduce data volume before expensive stages");
print("  - $group + accumulators ($sum, $avg, $max) are the core of aggregation");
print("  - $unwind expands arrays so you can aggregate across array elements");
print("  - $project reshapes; $addFields adds without removing existing fields");

