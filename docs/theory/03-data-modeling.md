# Data Modeling

MongoDB's flexible schema allows multiple approaches to structuring related data. This module covers embedding vs. referencing, common patterns, and how to choose the right design for your use case.

## Embedding vs. Referencing

The fundamental decision in MongoDB modeling: should related data live inside a document (embedding) or in separate documents linked by reference?

### EMBEDDING (Denormalization)

**When to embed:**
- Data is always accessed together (belongs with parent)
- One-to-few relationships (typically < 20 sub-documents)
- Sub-documents don't grow unboundedly
- Data doesn't need to be queried independently
- Write efficiency is important

**One-to-One: Embed Address in User**
```javascript
db.users_embedded.insertOne({
  _id: ObjectId("..."),
  name: "Alice Johnson",
  email: "alice@example.com",
  address: {
    street: "123 Main St",
    city: "New York",
    state: "NY",
    zip: "10001",
    country: "US"
  },
  createdAt: new Date()
});

// Single query — no join needed
let user = db.users_embedded.findOne({ email: "alice@example.com" });
print(user.address.city); // "New York"
```

**One-to-Many: Embed Tags & Recent Orders**
```javascript
db.users_embedded.insertOne({
  _id: ObjectId("..."),
  name: "Bob Smith",
  email: "bob@example.com",
  // Small bounded set of tags
  tags: ["premium", "early-adopter", "vip"],
  // Recent orders (bounded to, say, last 10)
  recentOrders: [
    { orderId: ObjectId("..."), total: 89.99, date: new Date("2024-01-15") },
    { orderId: ObjectId("..."), total: 149.99, date: new Date("2024-02-20") }
  ]
});

// Query nested arrays
let premiumUsers = db.users_embedded.find({ tags: "premium" }).toArray();

// Update array element
db.users_embedded.updateOne(
  { _id: ObjectId("..."), "recentOrders.orderId": ObjectId("...") },
  { $set: { "recentOrders.$.total": 99.99 } }  // $ = array match position
);
```

**Advantages:**
- Fewer round trips to DB — fetch parent + children in one query
- Atomic writes — update parent and children together
- No joins — simpler queries & better performance
- Self-contained document — easier to replicate/backup

**Disadvantages:**
- Unbounded growth — if children grow without limit, document size explodes
- Document size limit — MongoDB documents max out at 16MB
- Duplication — if data is accessed independently, you duplicate it
- Complex updates — updating shared child data requires updating all parents

---

### REFERENCING (Normalization)

**When to reference:**
- Data grows unboundedly (all orders ever, not just recent)
- Data is shared across documents (one address for multiple users)
- Child documents are frequently queried independently
- You need strict separation of concerns
- Update frequency of child is high

**One-to-Many: Store All Orders Separately**
```javascript
// Users collection — only reference to orders
db.users_ref.insertOne({
  _id: ObjectId("user123"),
  name: "Charlie Davis",
  email: "charlie@example.com"
});

// Orders collection — foreign key reference
db.orders.insertMany([
  { _id: ObjectId("order1"), userId: ObjectId("user123"), total: 89.99, date: new Date("2024-01-15") },
  { _id: ObjectId("order2"), userId: ObjectId("user123"), total: 149.99, date: new Date("2024-02-20") },
  { _id: ObjectId("order3"), userId: ObjectId("user123"), total: 49.99, date: new Date("2024-03-10") }
]);

// Fetch user + all their orders (2 queries or use $lookup)
let user = db.users_ref.findOne({ _id: ObjectId("user123") });
let userOrders = db.orders.find({ userId: ObjectId("user123") }).toArray();

// Or with $lookup (similar to SQL JOIN)
let userWithOrders = db.users_ref.aggregate([
  { $match: { _id: ObjectId("user123") } },
  {
    $lookup: {
      from: "orders",
      localField: "_id",
      foreignField: "userId",
      as: "orders"
    }
  }
]).toArray();
print(userWithOrders[0].orders.length); // all orders for user
```

**Many-to-Many: Users and Addresses**
```javascript
// Addresses collection (shared across multiple users)
db.addresses.insertMany([
  { _id: ObjectId("addr1"), street: "123 Main", city: "NY", zip: "10001" },
  { _id: ObjectId("addr2"), street: "456 Park", city: "LA", zip: "90001" }
]);

// Users with array of address references
db.users_ref.insertOne({
  _id: ObjectId("user1"),
  name: "David",
  addressIds: [ObjectId("addr1"), ObjectId("addr2")]  // array of references
});

// Fetch user + all their addresses
let userAddresses = db.addresses.find({
  _id: { $in: [ObjectId("addr1"), ObjectId("addr2")] }
}).toArray();
```

**Advantages:**
- No size limit — children can grow indefinitely
- No duplication — child data exists once, referenced many times
- Independent queries — efficiently query orders without fetching users
- Flexible updates — change an order without touching user document

**Disadvantages:**
- Multiple queries or joins — need $lookup (slower than embedding)
- Referential integrity — no foreign key constraint, manual consistency
- Application logic — must manage references in code
- Network overhead — multiple round trips to DB

---

## Data Modeling Patterns

### Attribute Pattern

**Use when:** A document has many similar fields that could be collapsed into an array of key-value pairs.

**Before (many fields):**
```javascript
db.products.insertOne({
  name: "Laptop",
  size_xs: false,
  size_s: false,
  size_m: true,
  size_l: true,
  size_xl: false,
  size_xxl: false,
  size_checked_date: new Date()
});
```

**After (attribute pattern):**
```javascript
db.products.insertOne({
  name: "Laptop",
  sizes: [
    { size: "xs", available: false },
    { size: "s", available: false },
    { size: "m", available: true },
    { size: "l", available: true },
    { size: "xl", available: false },
    { size: "xxl", available: false }
  ],
  sizes_checked_date: new Date()
});

// Query and update more flexibly
db.products.find({ "sizes.size": "m", "sizes.available": true });
db.products.updateOne(
  { _id: ObjectId("...") },
  { $set: { "sizes.$[elem].available": false }, $[elem]: { size: "m" } }
);
```

### Document Versioning

**Use when:** You need to track changes to a document over time.

```javascript
db.blog_posts.insertOne({
  _id: ObjectId("post1"),
  title: "MongoDB Tips",
  content: "...",
  version: 1,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01")
});

// When updating, increment version
db.blog_posts.updateOne(
  { _id: ObjectId("post1") },
  {
    $set: { content: "Updated content", version: 2, updatedAt: new Date() }
  }
);

// Keep history in a separate collection
db.blog_posts_history.insertOne({
  postId: ObjectId("post1"),
  version: 1,
  title: "MongoDB Tips",
  content: "...",
  timestamp: new Date("2024-01-01")
});
```

### Polymorphic Collections

**Use when:** A collection stores documents of slightly different shapes.

```javascript
// One collection for different content types
db.content.insertMany([
  {
    _id: ObjectId("blog1"),
    type: "blog",
    title: "MongoDB Basics",
    body: "...",
    author: "Alice"
  },
  {
    _id: ObjectId("video1"),
    type: "video",
    title: "MongoDB Tutorial",
    url: "https://...",
    duration: 1200,
    author: "Bob"
  },
  {
    _id: ObjectId("image1"),
    type: "image",
    title: "Architecture Diagram",
    src: "https://...",
    alt: "MongoDB architecture",
    author: "Charlie"
  }
]);

// Query by type
db.content.find({ type: "blog" });

// All content by author (polymorphic)
db.content.find({ author: "Alice" });
```

---

## Common Pitfalls

### ❌ Unbounded Arrays

Embedding an array that grows without limit will eventually hit the 16MB document size limit.

```javascript
// BAD: Unbounded embedding
db.users.insertOne({
  _id: ObjectId("user1"),
  name: "Alice",
  allOrdersEver: [ /* 100,000s of orders */ ]  // Will grow forever
});

// GOOD: Reference to separate collection + maybe cache recent
db.users.insertOne({
  _id: ObjectId("user1"),
  name: "Alice",
  recentOrders: [ /* last 10 orders */ ],
  totalOrders: 150000  // Aggregate separately
});

db.orders.find({ userId: ObjectId("user1") });
```

### ❌ Deeply Nested Documents

Queries become hard to write and indexes are difficult to create.

```javascript
// BAD: Too deeply nested
db.companies.insertOne({
  name: "TechCorp",
  divisions: [{
    name: "Engineering",
    departments: [{
      name: "Backend",
      teams: [{
        name: "API Team",
        members: [{...}, {...}]
      }]
    }]
  }]
});

// GOOD: Flatter structure with references
db.companies.insertOne({ _id: ObjectId("company1"), name: "TechCorp" });
db.divisions.insertOne({ _id: ObjectId("div1"), companyId: ObjectId("company1"), name: "Engineering" });
db.departments.insertOne({ _id: ObjectId("dept1"), divisionId: ObjectId("div1"), name: "Backend" });
db.teams.insertOne({ _id: ObjectId("team1"), departmentId: ObjectId("dept1"), name: "API Team" });
db.members.insertOne({ _id: ObjectId("mem1"), teamId: ObjectId("team1"), name: "Alice" });
```

### ❌ Ignoring 16MB Limit

Always be aware of MongoDB's hard limit on document size.

```javascript
// Check document size
let doc = db.products.findOne({ _id: ObjectId("...") });
let docSize = Object.bsonsize(doc);
print("Document size:", docSize, "bytes");

if (docSize > 15000000) {
  print("WARNING: Document is close to 16MB limit");
}
```

---

## Choosing Embedding vs. Referencing: Decision Matrix

| Factor | Embed | Reference |
|--------|-------|-----------|
| **Data grows unboundedly** | ❌ | ✅ |
| **Data accessed together** | ✅ | ❌ |
| **Data shared across docs** | ❌ | ✅ |
| **One-to-few relationship** | ✅ | ❌ |
| **One-to-many to many relationship** | ❌ | ✅ |
| **Frequent child-only queries** | ❌ | ✅ |
| **Write performance critical** | ✅ | ❌ |
| **Read performance critical** (simple) | ✅ | ❌ |
| **Read performance critical** (complex) | ❌ | ✅ |

---

## Summary

- **Embed when:** Data belongs with parent, is bounded, and accessed together
- **Reference when:** Data grows unboundedly, is shared, or queried independently
- **Use patterns:** Attribute pattern for flexible fields, versioning for history, polymorphic for mixed types
- **Avoid pitfalls:** Unbounded arrays, deep nesting, ignoring 16MB limit
- **Remember:** MongoDB is flexible — optimize for your access patterns, not for database normalization
