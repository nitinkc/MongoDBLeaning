# Indexes & Aggregation

This module covers two critical topics for MongoDB performance and analytics: building effective indexes to speed up queries, and using the aggregation pipeline for complex data transformations.

## Indexes

An index is a sorted data structure that allows MongoDB to quickly locate documents without scanning the entire collection.

### Index Types

#### Single-Field Index

```javascript
// Create ascending index on price
db.products.createIndex({ price: 1 });

// Create descending index
db.products.createIndex({ createdAt: -1 });

// 1 = ascending (A→Z, 0→∞)
// -1 = descending (Z→A, ∞→0)

// For single-field equality, direction doesn't matter much for performance
// But direction matters for sorting and range queries

// This index speeds up:
db.products.find({ price: 100 });
db.products.find({ price: { $gt: 50 } });
db.products.find({}).sort({ price: 1 });
```

#### Compound Index

```javascript
// Index on multiple fields — field ORDER matters!
db.products.createIndex({ category: 1, price: -1 });

// ESR Rule: Equality, Sort, Range
// Best for: WHERE category = X AND ORDER BY price DESC AND price > Y

// Supports queries on:
// ✅ (category)
// ✅ (category, price)
// ❌ (price) alone — can't skip the first field

// BAD QUERY for this index (won't use it efficiently):
db.products.find({ price: { $gt: 50 } });  // doesn't use category index

// GOOD QUERIES:
db.products.find({ category: "electronics" });
db.products.find({ category: "electronics", price: { $gt: 50 } });
db.products.find({ category: "electronics", price: { $gt: 50 } }).sort({ price: -1 });
```

#### Unique Index

```javascript
// Prevent duplicate values — e.g., usernames, emails must be unique
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });

// Insert fails if email already exists
db.users.insertOne({ email: "alice@example.com", name: "Alice" });
db.users.insertOne({ email: "alice@example.com", name: "Alice2" }); // Error: duplicate key

// Unique indexes on fields with nulls:
// MongoDB allows multiple null values by default
// To restrict, use { unique: true, sparse: true }
```

#### Sparse Index

```javascript
// Index only documents that have the field (skip docs where field is missing/null)
db.users.createIndex({ phone: 1 }, { sparse: true });

// Useful when:
// - Many documents don't have a field (optional field)
// - Want to optimize index size
// - Querying optional fields

// This index is smaller because it skips ~50% of users without phone
db.users.find({ phone: { $exists: true } });
```

#### Multikey Index

```javascript
// MongoDB automatically creates a multikey index when indexing an array field
// Each array element gets indexed individually

db.users.createIndex({ tags: 1 });  // Automatically multikey

// Documents:
db.users.insertMany([
  { name: "Alice", tags: ["java", "python", "javascript"] },
  { name: "Bob",   tags: ["go", "rust"] },
  { name: "Charlie", tags: [] }
]);

// Index enables fast queries on any array element
db.users.find({ tags: "javascript" }); // Fast — uses index

// Caveat: Cannot have TWO array fields in same compound index
db.collection.createIndex({ tags: 1, hobbies: 1 }); // ERROR if both are arrays
```

#### Text Index

```javascript
// Full-text search on string fields
db.products.createIndex({ name: "text", description: "text" });

// Note: Only ONE text index per collection

// Query with $text operator
db.products.find({
  $text: { $search: "keyboard mechanical" }  // finds docs with these words
});

// Return relevance score
db.products.find(
  { $text: { $search: "keyboard" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } });

// Text index features:
// - Case-insensitive
// - Stemming (keyboard, keyboards → same root)
// - Stop words (the, a, is) ignored by default
// - OR by default — matches any word
// - Phrase search: "mechanical keyboard" (exact phrase)
// - Negation: -wireless (exclude)
```

#### TTL Index

```javascript
// Automatically delete documents after expiry (covered in detail in TTL module)
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }  // Delete after 1 hour
);

// Any document with createdAt date > 1 hour ago is deleted automatically
```

### Viewing & Managing Indexes

```javascript
// List all indexes on a collection
db.products.getIndexes();

// Output: [ { key: { _id: 1 }, name: "_id_" }, { key: { price: 1 }, name: "price_1" }, ... ]

// Get detailed index info
db.products.getIndexSpecs();

// Drop a specific index
db.products.dropIndex("price_1");        // By name
db.products.dropIndex({ price: 1 });    // By key spec

// Drop all indexes except _id (which can't be dropped)
db.products.dropIndexes();

// Rename an index
db.collection.dropIndex("oldIndexName");
db.collection.createIndex({ field: 1 }, { name: "newIndexName" });
```

### Query Explanation & Analysis

```javascript
// Explain how MongoDB executes a query
let explanation = db.products.find({ price: { $gt: 50 }, category: "electronics" })
  .explain("executionStats");

// Key fields to check:
console.log(explanation.executionStats.executionStages.stage);
// COLLSCAN = full collection scan (bad, need index)
// IXSCAN = index scan (good)
// FETCH = retrieve full document (after index found it)

console.log(explanation.executionStats.executionStages.nReturned);
// Documents returned

console.log(explanation.executionStats.executionStages.totalDocsExamined);
// Documents scanned

// RULE: totalDocsExamined should be close to nReturned
// If totalDocsExamined >> nReturned, you need a better index

// Example: If nReturned = 10 but totalDocsExamined = 100,000
// The query is scanning 100,000 docs to return 10 → consider indexing
```

### Index Best Practices

```javascript
// 1. Create indexes for frequent queries
db.orders.createIndex({ userId: 1 });       // for find({ userId: X })
db.orders.createIndex({ status: 1 });       // for find({ status: X })

// 2. Use compound indexes for multi-field filters
db.orders.createIndex({ userId: 1, status: 1 });  // for find({ userId: X, status: Y })

// 3. Order fields in compound index by ESR rule: Equality, Sort, Range
db.orders.createIndex({ userId: 1, createdAt: -1, amount: 1 });
// WHERE userId = X ORDER BY createdAt DESC AND amount > Y

// 4. Don't over-index — every index slows down inserts/updates
// Keep indexes to high-return queries

// 5. Monitor index usage
db.collection.aggregate([
  { $indexStats: {} }
]);
// Shows which indexes are used and how often

// 6. Prefer ascending for sort, but in compound indexes, put sort field in middle
db.collection.createIndex({
  status: 1,      // Equality
  createdAt: -1,  // Sort
  userId: 1       // Range
});
```

---

## Aggregation Pipeline

The aggregation pipeline is a powerful framework for transforming and analyzing data within MongoDB, similar to SQL's GROUP BY, JOIN, and window functions combined.

### Pipeline Stages

The aggregation pipeline processes documents through stages, each modifying the result for the next stage.

```
Input → [$match] → [$project] → [$group] → [$sort] → [$limit] → Output
```

#### $match

Filter documents — like SQL's WHERE clause.

```javascript
db.orders.aggregate([
  { $match: { status: "completed", amount: { $gt: 100 } } }
]);

// Returns only orders with status = "completed" AND amount > 100
// Should usually come first to reduce documents early
```

#### $project

Reshape documents — include/exclude fields, compute new fields.

```javascript
db.orders.aggregate([
  {
    $project: {
      _id: 1,           // include
      customerName: 1,  // include
      amount: 1,
      status: 0,        // exclude
      profit: { $subtract: ["$amount", "$cost"] }  // computed field
    }
  }
]);

// Result: { _id: X, customerName: "Alice", amount: 100, profit: 25 }
// Note: Use $ prefix to reference field values
```

#### $group

Group documents and compute aggregates — like SQL's GROUP BY.

```javascript
db.orders.aggregate([
  {
    $group: {
      _id: "$status",           // Group by status field
      count: { $sum: 1 },       // Count documents
      totalAmount: { $sum: "$amount" },  // Sum amounts
      avgAmount: { $avg: "$amount" },
      maxAmount: { $max: "$amount" },
      minAmount: { $min: "$amount" }
    }
  }
]);

// Result:
// { _id: "completed", count: 150, totalAmount: 15000, avgAmount: 100, ... }
// { _id: "pending", count: 50, totalAmount: 3000, avgAmount: 60, ... }
// { _id: "cancelled", count: 10, totalAmount: 500, avgAmount: 50, ... }
```

**Common $group accumulators:**

| Operator | Description |
|----------|-------------|
| `$sum` | Sum of values or count of documents (`$sum: 1`) |
| `$avg` | Average of values |
| `$min` | Minimum value |
| `$max` | Maximum value |
| `$first` | First value (usually with $sort) |
| `$last` | Last value (usually with $sort) |
| `$push` | Collect values into array |
| `$addToSet` | Collect unique values into array |
| `$count` | Count of documents in group |

#### $sort

Sort documents by field(s).

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $sort: { amount: -1 } }  // -1 = descending (high to low)
]);

// For compound sort:
db.orders.aggregate([
  { $sort: { status: 1, amount: -1 } }  // By status ASC, then amount DESC
]);
```

#### $limit & $skip

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $sort: { amount: -1 } },
  { $skip: 10 },        // Skip first 10
  { $limit: 5 }         // Return next 5
]);

// For pagination: skip = (page - 1) * pageSize, limit = pageSize
```

#### $lookup

Join with another collection — like SQL's JOIN.

```javascript
// Orders with customer details (many-to-one)
db.orders.aggregate([
  {
    $lookup: {
      from: "customers",        // Collection to join
      localField: "customerId", // Field in orders
      foreignField: "_id",      // Field in customers
      as: "customer"            // Output array field
    }
  }
]);

// Result: { _id: X, customerId: Y, amount: 100, customer: [{ _id: Y, name: "Alice", ... }] }
// Note: customer is always an array (even if 1 document)
```

#### $unwind

Deconstruct arrays — create separate document for each array element.

```javascript
// Order with items array:
// { _id: 1, customerId: 1, items: [{ product: "A", qty: 2 }, { product: "B", qty: 1 }] }

db.orders.aggregate([
  { $unwind: "$items" }
]);

// Result:
// { _id: 1, customerId: 1, items: { product: "A", qty: 2 } }
// { _id: 1, customerId: 1, items: { product: "B", qty: 1 } }

// Now you can group by product:
db.orders.aggregate([
  { $unwind: "$items" },
  { $group: { _id: "$items.product", totalQty: { $sum: "$items.qty" } } }
]);
```

### Aggregation Examples

#### Example 1: Sales by Category

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $unwind: "$items" },
  {
    $group: {
      _id: "$items.category",
      totalSales: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
      itemCount: { $sum: "$items.qty" },
      orderCount: { $sum: 1 }
    }
  },
  { $sort: { totalSales: -1 } }
]);
```

#### Example 2: Customer Spending Analysis

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  {
    $group: {
      _id: "$customerId",
      totalSpent: { $sum: "$amount" },
      orderCount: { $sum: 1 },
      avgOrder: { $avg: "$amount" },
      firstOrder: { $min: "$createdAt" },
      lastOrder: { $max: "$createdAt" }
    }
  },
  {
    $lookup: {
      from: "customers",
      localField: "_id",
      foreignField: "_id",
      as: "customer"
    }
  },
  { $unwind: "$customer" },
  {
    $project: {
      _id: 0,
      customerName: "$customer.name",
      totalSpent: 1,
      orderCount: 1,
      avgOrder: { $round: ["$avgOrder", 2] }
    }
  },
  { $sort: { totalSpent: -1 } },
  { $limit: 10 }
]);
```

---

## Summary

**Indexes:**
- Use single-field indexes for frequent equality/range queries
- Use compound indexes with ESR rule: Equality, Sort, Range
- Unique indexes prevent duplicates; sparse indexes skip null/missing values
- Text indexes enable full-text search
- Always explain() queries to verify index usage

**Aggregation:**
- Pipeline stages transform data: $match → $group → $sort → $project
- Group with accumulators ($sum, $avg, $min, $max, $push)
- $lookup for joins, $unwind to expand arrays
- Combine with $sort and $limit for top-N queries
- Aggregation is powerful for analytics, but can be slower than indexed finds
