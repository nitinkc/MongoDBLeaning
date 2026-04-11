# NoSQL & MongoDB

MongoDB is a document-oriented NoSQL database built for flexible schemas, horizontal scaling, and high-throughput workloads. This module introduces NoSQL concepts and explains where MongoDB fits in the data landscape.

## Definitions & Core Concepts

### NoSQL Databases
**Definition**: NoSQL (Not Only SQL) databases are non-relational data stores designed for distributed, high-volume workloads with flexible or schema-less data models.

**What it means**:
- No fixed schema — add fields without migrations
- Horizontal scaling — add more servers, not bigger ones
- Designed for high availability with replication built-in
- Trade strict ACID for performance and partition tolerance
- Many types: Document, Key-Value, Column-Family, Graph, Search

### Types of NoSQL Databases

| Type | Examples | Best For |
|------|----------|----------|
| **Document** | MongoDB, Couchbase | Flexible JSON-like records, content, catalogs |
| **Key-Value** | Redis, DynamoDB | Sessions, caching, simple lookups |
| **Column-Family** | Cassandra, HBase | Time-series, IoT, wide-row analytics |
| **Graph** | Neo4j, Amazon Neptune | Relationships, social networks, fraud detection |
| **Search** | Elasticsearch, Solr | Full-text search, log analytics |

### MongoDB: Document Database
**Definition**: MongoDB stores data as BSON (Binary JSON) documents in collections, rather than rows in tables.

**What it means**:
- **Document** ≈ a JSON object (like a row in a table, but flexible)
- **Collection** ≈ a table (but no enforced schema)
- **Database** ≈ a schema/namespace grouping collections
- Documents can contain nested objects and arrays natively
- Each document can have different fields (polymorphic)

---

## MongoDB vs Relational Database

| Aspect | Relational (PostgreSQL) | MongoDB |
|--------|------------------------|---------|
| **Data unit** | Row in a table | BSON document |
| **Schema** | Fixed (DDL required) | Flexible (optional validation) |
| **Joins** | `JOIN` across tables | Embed or `$lookup` (use sparingly) |
| **Transactions** | Full ACID always | ACID (4.0+ replica set, 4.2+ sharded) |
| **Scaling** | Vertical (bigger server) | Horizontal (sharding) |
| **Query Language** | SQL | MQL (MongoDB Query Language) |
| **Aggregation** | GROUP BY, window functions | Aggregation Pipeline |
| **Schema changes** | `ALTER TABLE` (expensive) | Add field on next write (free) |

### Key Differences in Practice

**1. No Fixed Schema**
```js
// SQL: must define schema first
// CREATE TABLE users (id INT, name VARCHAR(100), email VARCHAR(200));

// MongoDB: just insert — schema is inferred
db.users.insertOne({ name: "Alice", email: "alice@example.com", age: 30 });
db.users.insertOne({ name: "Bob", email: "bob@example.com", phone: "+1-555-0101" });
// Bob has 'phone', Alice doesn't — perfectly valid
```

**2. No Joins — Embed Instead**
```js
// SQL: store addresses in a separate table, JOIN at query time
// SELECT u.name, a.city FROM users u JOIN addresses a ON u.id = a.user_id;

// MongoDB: embed address inside the user document
db.users.insertOne({
  name: "Alice",
  address: { city: "New York", zip: "10001" }  // embedded, no join needed
});
let user = db.users.findOne({ name: "Alice" });
print(user.address.city); // "New York" — single query, no join
```

**3. Arrays are First-Class**
```js
// SQL: orders stored in separate table
// MongoDB: embed recent items directly in the order document
db.orders.insertOne({
  userId: ObjectId("..."),
  items: [
    { product: "Keyboard", qty: 1, price: 89.99 },
    { product: "Mouse",    qty: 2, price: 49.99 }
  ],
  total: 189.97
});
```

---

## The CAP Theorem

The CAP Theorem states a distributed system can guarantee **at most two** of:

### Consistency (C)
Every read returns the most recent write.  
*Example: You deposit $100; your next balance check always shows the updated amount.*

### Availability (A)
The system responds to every request, even if some nodes are down.  
*Example: Your app works even when a data center goes offline.*

### Partition Tolerance (P)
The system keeps running despite network partitions between nodes.  
*Required in any real distributed system — networks do fail.*

### MongoDB's Position
MongoDB is **CP** by default:
- Writes go to the **primary** (single source of truth)
- Reads from primary are always consistent
- If the primary fails, a brief write outage occurs during election (~10s)
- Reads from secondaries (with `readPreference: secondary`) can be stale → behaves like AP

Tunable via readConcern / writeConcern:
- `writeConcern: w:majority` + `readConcern: majority` = strong consistency
- `readPreference: secondary` + `readConcern: local` = higher availability, possible stale reads

---

## When to Use MongoDB

### ✅ Good Use Cases
- **Content management**: Articles, product catalogs, user profiles (flexible schema)
- **Real-time analytics**: Event logging, clickstreams, activity feeds
- **Mobile & IoT**: Variable device data, sensor readings
- **E-commerce**: Product catalogs with varied attributes, order management
- **Gaming**: Player state, leaderboards, session data
- **Search & recommendations**: Faceted search, personalization

### ❌ Not Suitable For
- **Complex multi-table joins**: Highly normalized relational data with many foreign keys
- **Strict ACID across many collections**: Financial ledgers where partial failures are catastrophic
- **Already-relational data**: If your data is naturally tabular and highly normalized, stay with SQL
- **Small datasets**: Under a few GB, a simple PostgreSQL or SQLite is easier to operate

---

## Real-World Examples

### Example 1: E-Commerce Product Catalog
Products vary in attributes (a book has ISBN, a TV has resolution). MongoDB's flexible schema handles this naturally without `NULL` columns:
```js
// Book
{ type: "book", name: "MongoDB Guide", isbn: "978-...", pages: 514, price: 39.99 }
// TV
{ type: "electronics", name: "OLED TV", resolution: "4K", hz: 120, price: 1299.99 }
```

### Example 2: What NOT to Do
```
❌ WRONG: Using MongoDB for a bank's double-entry ledger
   - Every debit must match a credit
   - Multi-document ACID needed for every transaction
   - Better: PostgreSQL with proper constraints

✅ RIGHT: Using MongoDB for transaction audit logs
   - Append-only event documents
   - Flexible event schema per transaction type
   - Fast writes, easy time-based querying
```

---

## Architecture Diagram

<div class="mermaid">
graph TD
  A["Application"] --> B["MongoDB Driver"]
  B --> C["mongos / Connection"]
  C --> D["Primary Node\n(Writes + Reads)"]
  D -->|"Replication\n(oplog)"| E["Secondary 1\n(Read scaling)"]
  D -->|"Replication\n(oplog)"| F["Secondary 2\n(HA failover)"]

  G["CAP Theorem"] --> H["Consistency"]
  G --> I["Availability"]
  G --> J["Partition\nTolerance"]
  D -->|"Primary = CP"| H
  D -->|"Secondary read = AP"| I
</div>

---

## Summary
- **MongoDB** stores flexible BSON documents in schema-free collections — no `ALTER TABLE` needed
- **No joins**: embed frequently-accessed related data; use `$lookup` sparingly for runtime joins
- **CAP**: MongoDB is CP by default (primary reads); tunable toward AP with secondary reads
- **Best for**: flexible schemas, high write throughput, nested/array data, horizontal scaling
- **Not for**: complex multi-table joins, small relational datasets, strict ACID everywhere

