# Advanced Aggregation

This module covers advanced techniques for the MongoDB aggregation pipeline, enabling complex transformations, analytics, and data manipulation.

## Advanced Pipeline Stages

### $facet — Multiple Aggregations in One Query

Run multiple aggregation paths on the same data in parallel:

```javascript
// Get product stats AND top categories in single aggregation
db.products.aggregate([
  { $match: { status: "active" } },
  {
    $facet: {
      "price_stats": [
        {
          $group: {
            _id: null,
            avgPrice: { $avg: "$price" },
            minPrice: { $min: "$price" },
            maxPrice: { $max: "$price" },
            totalProducts: { $sum: 1 }
          }
        }
      ],
      "top_categories": [
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ],
      "new_arrivals": [
        { $sort: { createdAt: -1 } },
        { $limit: 10 }
      ]
    }
  }
]);

// Result:
// {
//   price_stats: [{ avgPrice: 45.50, minPrice: 10, maxPrice: 299, totalProducts: 1000 }],
//   top_categories: [{ _id: "electronics", count: 400 }, ...],
//   new_arrivals: [{ _id: ObjectId, name: "...", ... }, ...]
// }
```

### $bucket — Group by Ranges

Organize documents into bucketed ranges:

```javascript
// Group products by price ranges
db.products.aggregate([
  {
    $bucket: {
      groupBy: "$price",
      boundaries: [0, 50, 100, 200, 500, 1000],
      default: "other",  // Documents outside boundaries
      output: {
        count: { $sum: 1 },
        products: { $push: "$name" },
        avg_price: { $avg: "$price" }
      }
    }
  }
]);

// Result:
// { _id: 0, count: 150, products: ["USB Hub", ...], avg_price: 25.50 }
// { _id: 50, count: 200, products: ["Monitor", ...], avg_price: 75.00 }
// { _id: 100, count: 100, products: ["Laptop", ...], avg_price: 150.00 }
// { _id: "other", count: 50, products: [...], avg_price: 750.00 }
```

### $bucketAuto — Automatic Bucketing

MongoDB automatically determines bucket boundaries:

```javascript
// Automatically create 5 buckets for ages
db.users.aggregate([
  {
    $bucketAuto: {
      groupBy: "$age",
      buckets: 5,  // Number of buckets to create
      output: {
        count: { $sum: 1 },
        avg_age: { $avg: "$age" }
      }
    }
  }
]);

// MongoDB determines boundaries to evenly distribute documents
// Result might be: [0-20], [20-40], [40-60], [60-80], [80-100]
```

### $redact — Dynamic Field Inclusion

Include or exclude fields based on field values (useful for multi-tenant data):

```javascript
// Hide departments with security level > user's clearance
db.documents.aggregate([
  {
    $match: { owner: "alice" }
  },
  {
    $redact: {
      $cond: [
        { $lte: ["$accessLevel", 3] },  // User has clearance 3
        "$$KEEP",                        // Include this field
        "$$PRUNE"                        // Exclude this field
      ]
    }
  }
]);

// Documents:
// { name: "Public Doc", accessLevel: 1 }   → KEPT
// { name: "Secret Doc", accessLevel: 5 }   → PRUNED
```

### $out — Write Results to Collection

Save aggregation results to a new collection:

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  {
    $group: {
      _id: "$customerId",
      totalSpent: { $sum: "$amount" },
      orderCount: { $sum: 1 }
    }
  },
  { $sort: { totalSpent: -1 } },
  { $out: "customer_analytics" }  // Write results here
]);

// New collection 'customer_analytics' now contains results
// Useful for pre-computed summaries, reporting
let analytics = db.customer_analytics.findOne({ _id: "customer123" });
print("Total spent:", analytics.totalSpent);
```

### $merge — Upsert Results

Merge aggregation results into a collection (insert or update):

```javascript
db.sales.aggregate([
  { $group: { _id: "$month", total: { $sum: "$amount" } } },
  {
    $merge: {
      into: "monthly_totals",
      whenMatched: "replace",   // Update if _id exists
      whenNotMatched: "insert"   // Insert if new
    }
  }
]);

// Result goes to 'monthly_totals'; existing docs are replaced
```

---

## Advanced Expressions

### Conditional Operators

```javascript
// $cond: if-then-else for computed fields
db.products.aggregate([
  {
    $project: {
      name: 1,
      price: 1,
      discount: {
        $cond: [
          { $gte: ["$price", 100] },  // If price >= 100
          { $multiply: ["$price", 0.1] },  // Then 10% discount
          { $multiply: ["$price", 0.05] }   // Else 5% discount
        ]
      }
    }
  }
]);

// $switch: multi-way conditional (like switch-case)
db.orders.aggregate([
  {
    $project: {
      amount: 1,
      shipCost: {
        $switch: {
          branches: [
            { case: { $lt: ["$amount", 25] }, then: 5.99 },
            { case: { $lt: ["$amount", 100] }, then: 2.99 },
            { case: { $lt: ["$amount", 500] }, then: 0 }
          ],
          default: -10  // Free shipping + discount
        }
      }
    }
  }
]);
```

### Array Expressions

```javascript
// $arrayElemAt: Get element at index
db.users.aggregate([
  {
    $project: {
      name: 1,
      firstHobby: { $arrayElemAt: ["$hobbies", 0] },
      lastHobby: { $arrayElemAt: ["$hobbies", -1] }  // Last element
    }
  }
]);

// $slice: Get portion of array
db.products.aggregate([
  {
    $project: {
      name: 1,
      topReviews: { $slice: ["$reviews", 5] }  // First 5 reviews
    }
  }
]);

// $map: Transform each element in array
db.orders.aggregate([
  {
    $project: {
      customerId: 1,
      originalItems: 1,
      itemNames: {
        $map: {
          input: "$items",
          as: "item",
          in: "$$item.productName"  // Extract product name from each item
        }
      }
    }
  }
]);

// $filter: Include only matching elements
db.students.aggregate([
  {
    $project: {
      name: 1,
      grades: 1,
      passingGrades: {
        $filter: {
          input: "$grades",
          as: "grade",
          cond: { $gte: ["$$grade", 70] }  // Only grades >= 70
        }
      }
    }
  }
]);

// $size: Count elements in array
db.posts.aggregate([
  {
    $project: {
      title: 1,
      commentCount: { $size: "$comments" }
    }
  }
]);

// $concatArrays: Combine arrays
db.inventory.aggregate([
  {
    $project: {
      name: 1,
      allVariants: { $concatArrays: ["$colors", "$sizes", "$materials"] }
    }
  }
]);
```

### String Expressions

```javascript
// $concat: Combine strings
db.users.aggregate([
  {
    $project: {
      _id: 0,
      firstName: 1,
      lastName: 1,
      fullName: { $concat: ["$firstName", " ", "$lastName"] }
    }
  }
]);

// $substr: Extract substring
db.products.aggregate([
  {
    $project: {
      code: 1,
      prefix: { $substr: ["$code", 0, 3] }  // First 3 chars
    }
  }
]);

// $toUpper / $toLower: Case conversion
db.users.aggregate([
  {
    $project: {
      email: { $toLower: "$email" }  // Normalize to lowercase
    }
  }
]);

// $split: Split string by delimiter
db.logs.aggregate([
  {
    $project: {
      log: 1,
      parts: { $split: ["$log", " "] }  // Split by spaces
    }
  }
]);

// $regexMatch: Match regex
db.users.aggregate([
  {
    $project: {
      email: 1,
      isValidEmail: {
        $regexMatch: {
          input: "$email",
          regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        }
      }
    }
  }
]);
```

### Math Expressions

```javascript
// $add, $subtract, $multiply, $divide
db.orders.aggregate([
  {
    $project: {
      items: 1,
      subtotal: { $sum: "$items.price" },
      tax: { $multiply: [{ $sum: "$items.price" }, 0.08] },
      total: {
        $add: [
          { $sum: "$items.price" },
          { $multiply: [{ $sum: "$items.price" }, 0.08] }
        ]
      }
    }
  }
]);

// $round, $ceil, $floor
db.products.aggregate([
  {
    $project: {
      name: 1,
      price: 1,
      roundedPrice: { $round: ["$price", 2] },
      ceilingPrice: { $ceil: "$price" },
      floorPrice: { $floor: "$price" }
    }
  }
]);

// $abs: Absolute value
db.transactions.aggregate([
  {
    $project: {
      amount: 1,
      absoluteAmount: { $abs: "$amount" }
    }
  }
]);

// $mod: Modulo
db.numbers.aggregate([
  {
    $project: {
      num: 1,
      isEven: { $eq: [{ $mod: ["$num", 2] }, 0] }
    }
  }
]);
```

---

## Window Functions

Window functions compute values over a range of related documents:

```javascript
// $setWindowFields: Compute values within a window

// Running total of sales by date
db.sales.aggregate([
  { $sort: { date: 1 } },
  {
    $setWindowFields: {
      partitionBy: null,          // Across entire collection
      sortBy: { date: 1 },
      output: {
        runningTotal: {
          $sum: "$amount",
          window: { range: ["unbounded", "current"] }  // From start to current doc
        },
        movingAvg: {
          $avg: "$amount",
          window: { range: [-7, 0] }  // Previous 7 + current
        },
        rank: { $rank: {} }  // Rank documents
      }
    }
  }
]);

// Result: { date: "2024-01-01", amount: 100, runningTotal: 100, rank: 1 }
//         { date: "2024-01-02", amount: 200, runningTotal: 300, rank: 2 }
//         { date: "2024-01-03", amount: 150, runningTotal: 450, rank: 3 }

// Partition by customer: running total per customer
db.orders.aggregate([
  { $sort: { customerId: 1, date: 1 } },
  {
    $setWindowFields: {
      partitionBy: "$customerId",  // Separate window per customer
      sortBy: { date: 1 },
      output: {
        customerRunningTotal: {
          $sum: "$amount",
          window: { range: ["unbounded", "current"] }
        }
      }
    }
  }
]);
```

---

## Complex Pipeline Examples

### Customer Lifetime Value Analysis

```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  {
    $group: {
      _id: "$customerId",
      totalSpent: { $sum: "$amount" },
      orderCount: { $sum: 1 },
      avgOrder: { $avg: "$amount" },
      firstOrder: { $min: "$date" },
      lastOrder: { $max: "$date" }
    }
  },
  {
    $project: {
      totalSpent: 1,
      orderCount: 1,
      avgOrder: { $round: ["$avgOrder", 2] },
      customerAge: {
        $divide: [
          { $subtract: [new Date(), "$firstOrder"] },
          86400000  // Convert to days (ms per day)
        ]
      },
      value_tier: {
        $switch: {
          branches: [
            { case: { $gte: ["$totalSpent", 10000] }, then: "platinum" },
            { case: { $gte: ["$totalSpent", 5000] }, then: "gold" },
            { case: { $gte: ["$totalSpent", 1000] }, then: "silver" }
          ],
          default: "bronze"
        }
      }
    }
  },
  { $sort: { totalSpent: -1 } },
  { $limit: 100 }
]);
```

### Product Performance Dashboard

```javascript
db.orders.aggregate([
  { $unwind: "$items" },
  { $match: { "items.productId": { $exists: true } } },
  {
    $facet: {
      "by_product": [
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            unitsSold: { $sum: "$items.quantity" },
            revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
            avgPrice: { $avg: "$items.price" },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } }
      ],
      "by_category": [
        {
          $group: {
            _id: "$items.category",
            totalSales: { $sum: "$items.quantity" },
            totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
          }
        }
      ]
    }
  }
]);
```

---

## Summary

**Advanced Stages:**
- `$facet`: Multiple aggregations in parallel
- `$bucket/$bucketAuto`: Group into ranges
- `$redact`: Conditional field inclusion
- `$out/$merge`: Write results to collections

**Advanced Expressions:**
- Conditional: `$cond`, `$switch`
- Arrays: `$arrayElemAt`, `$slice`, `$map`, `$filter`, `$size`
- Strings: `$concat`, `$substr`, `$split`, `$regexMatch`
- Math: `$round`, `$abs`, `$mod`, `$divide`

**Window Functions:**
- `$setWindowFields` for running totals, moving averages, ranking
- Partition windows by field or across entire collection
- Range-based windows: `["unbounded", "current"]` or `[-7, 0]`

**Best Practices:**
- Use `$facet` to avoid multiple passes over data
- Move `$match` early to reduce documents processed
- Use `$out` for pre-computed reports
- Combine window functions with partitioning for per-group analysis
