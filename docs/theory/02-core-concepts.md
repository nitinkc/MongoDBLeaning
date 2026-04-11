# Core Concepts

This module covers the fundamental concepts required to work effectively with MongoDB, including CRUD operations, document structure, and MongoDB-specific terminology.

## CRUD Operations

### CREATE

**insertOne()** - Insert a single document
```javascript
let result = db.products.insertOne({
  name: "USB Hub",
  price: 29.99,
  stock: 80,
  createdAt: new Date()
});
// Returns { insertedId: ObjectId(...) }
// Note: _id is auto-generated as ObjectId if not provided
```

**insertMany()** - Insert multiple documents in one batch
```javascript
let result = db.products.insertMany([
  { name: "Webcam", price: 59.99, stock: 60 },
  { name: "Desk",   price: 499.00, stock: 20 }
]);
// Returns { insertedIds: [ObjectId(...), ObjectId(...)] }
// More efficient than multiple insertOne calls
```

### READ

**findOne()** - Returns the first matching document
```javascript
let product = db.products.findOne({ name: "USB Hub" });
// Returns: { _id: ObjectId(...), name: "USB Hub", price: 29.99, ... }
// Returns null if no match found
```

**find()** - Returns a cursor that can be iterated
```javascript
// Get all products in 'peripherals' category
db.products.find({ category: "peripherals" }).forEach(doc => {
  print(doc.name, "$" + doc.price);
});

// Convert to array
let peripherals = db.products.find({ category: "peripherals" }).toArray();
```

**Projection** - Select only specific fields
```javascript
// Include only name and price, exclude _id
db.products.find({}, { _id: 0, name: 1, price: 1 }).toArray();

// Result: [{ name: "USB Hub", price: 29.99 }, ...]
// 1 = include, 0 = exclude (except _id, always included unless explicit 0)
```

### UPDATE

**updateOne()** - Update the first matching document
```javascript
db.products.updateOne(
  { name: "USB Hub" },              // filter
  { $set: { stock: 75 } }           // update operator
);
// Modifies only the first matching document
```

**replaceOne()** - Replace the entire document
```javascript
db.products.replaceOne(
  { name: "USB Hub" },
  { name: "USB Hub 3.0", price: 34.99, stock: 100 }  // entire new document
);
// The old document is completely replaced (except _id)
```

**updateMany()** - Update all matching documents
```javascript
db.products.updateMany(
  { category: "peripherals" },
  { $set: { onSale: true } }
);
// All peripherals are now marked as onSale
```

### DELETE

**deleteOne()** - Delete the first matching document
```javascript
db.products.deleteOne({ name: "USB Hub" });
// Deletes only the first match
```

**deleteMany()** - Delete all matching documents
```javascript
db.products.deleteMany({ category: "discontinued" });
// Deletes all discontinued products
```

---

## Query Operators

### Comparison Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `$gt` | Greater than | `{ price: { $gt: 50 } }` |
| `$gte` | Greater than or equal | `{ price: { $gte: 25 } }` |
| `$lt` | Less than | `{ price: { $lt: 100 } }` |
| `$lte` | Less than or equal | `{ price: { $lte: 200 } }` |
| `$eq` | Equal | `{ category: { $eq: "peripherals" } }` |
| `$ne` | Not equal | `{ status: { $ne: "inactive" } }` |
| `$in` | In array | `{ category: { $in: ["peripherals", "storage"] } }` |
| `$nin` | Not in array | `{ category: { $nin: ["discontinued"] } }` |

### Logical Operators

```javascript
// $and: both conditions must be true (default with multiple fields)
db.products.find({ category: "peripherals", price: { $lt: 100 } });
// Or explicitly:
db.products.find({ $and: [{ category: "peripherals" }, { price: { $lt: 100 } }] });

// $or: at least one condition must be true
db.products.find({ $or: [{ category: "peripherals" }, { price: { $gt: 500 } }] });

// $not: negates the operator
db.products.find({ price: { $not: { $gt: 100 } } });
// Equivalent to: price <= 100

// $nor: none of the conditions are true
db.products.find({ $nor: [{ category: "discontinued" }, { stock: 0 }] });
// Products that are NOT discontinued AND have stock > 0
```

---

## Array Operations

### Query Array Fields

```javascript
// Find documents where tags array contains "premium"
db.users.find({ tags: "premium" });

// Find documents where hobbies array has exactly ["reading", "gaming"]
db.users.find({ hobbies: ["reading", "gaming"] });

// Find documents where tags array has at least 2 elements
db.users.find({ tags: { $size: 2 } });

// Find documents where any tag starts with 's'
db.users.find({ tags: { $regex: "^s" } });
```

### Update Array Fields

```javascript
// Add element to array (appends if not present)
db.users.updateOne(
  { _id: ObjectId("...") },
  { $push: { tags: "vip" } }
);

// Add multiple elements
db.users.updateOne(
  { _id: ObjectId("...") },
  { $push: { tags: { $each: ["vip", "early-adopter"] } } }
);

// Remove all instances of value from array
db.users.updateOne(
  { _id: ObjectId("...") },
  { $pull: { tags: "deprecated" } }
);

// Access array element by index
db.users.updateOne(
  { _id: ObjectId("...") },
  { $set: { "hobbies.0": "hiking" } }  // set 1st element
);
```

---

## Dot Notation

Access nested fields using dot notation:

```javascript
// Insert document with nested address
db.users.insertOne({
  name: "Alice",
  address: {
    street: "123 Main St",
    city: "New York",
    zip: "10001"
  }
});

// Query using dot notation
db.users.find({ "address.city": "New York" });

// Update nested field
db.users.updateOne(
  { _id: ObjectId("...") },
  { $set: { "address.zip": "10002" } }
);

// Array element access
db.users.find({ "hobbies.0": "reading" });  // 1st element
```

---

## Data Types in MongoDB

MongoDB documents support a rich set of data types:

| Type | Example | Use Case |
|------|---------|----------|
| **String** | `"Hello"` | Text fields |
| **Number** | `42`, `3.14` | Integer or Decimal |
| **Boolean** | `true`, `false` | Flags |
| **Date** | `new Date()` | Timestamps |
| **Array** | `["a", "b", "c"]` | Lists |
| **Object/Document** | `{ city: "NY" }` | Nested structure |
| **ObjectId** | `ObjectId("...")` | Unique identifiers |
| **null** | `null` | Absence of value |
| **Binary Data** | `BinData(...)` | Images, files |
| **Regex** | `/pattern/i` | Pattern matching |

---

## Database & Collection Structure

```javascript
// MongoDB hierarchy:
// Server
//  ├─ Database (db)
//  │  ├─ Collection (products, users, orders, etc.)
//  │  │  ├─ Document { _id, field1, field2, ... }
//  │  │  ├─ Document { _id, field1, field2, ... }
//  │  │  └─ ...

// Switch to (or create) a database
db = db.getSiblingDB("my_app");

// Create a collection explicitly (optional — collections auto-create on first insert)
db.createCollection("products", { validator: {...} });

// Show all collections in current database
show collections;

// Get collection info
db.getCollectionInfos();

// Drop a collection
db.products.drop();

// Drop entire database
db.dropDatabase();
```

---

## Indexes

Indexes speed up queries dramatically. Every collection has a default `_id` index.

```javascript
// Create a single-field index
db.products.createIndex({ price: 1 });

// Create a compound index (multiple fields)
db.users.createIndex({ email: 1, status: 1 });

// Create a unique index (prevents duplicates)
db.users.createIndex({ email: 1 }, { unique: true });

// View indexes on a collection
db.products.getIndexes();

// Drop an index
db.products.dropIndex("idx_price_1");

// Drop all indexes except _id
db.products.dropIndexes();
```

---

## Explanation & Query Planning

Use `explain()` to understand how MongoDB executes a query:

```javascript
let explanation = db.products.find({ price: { $gt: 50 } }).explain("executionStats");

// Key info:
// - executionStages.stage: COLLSCAN (full table scan) or IXSCAN (index scan)
// - executionStages.nReturned: documents returned
// - executionStages.totalDocsExamined: documents scanned
// - executionStats.executionStages.executionStages: nested stages in pipeline

// Rule of thumb: totalDocsExamined should be close to nReturned
// If much higher, you may need an index
if (explanation.executionStats.executionStages.stage === "COLLSCAN") {
  print("WARNING: Full collection scan — consider adding an index");
}
```

---

## Summary

- **CRUD**: insertOne/Many, findOne/find, updateOne/Many/replaceOne, deleteOne/Many
- **Operators**: Comparison ($gt, $lt, $in), Logical ($and, $or, $not, $nor), Array ($push, $pull, $size)
- **Dot Notation**: Query/update nested fields with `"parent.child"`
- **Indexes**: Create single-field, compound, or unique indexes for performance
- **Data Types**: String, Number, Boolean, Date, Array, Object, ObjectId, null, Binary, Regex
