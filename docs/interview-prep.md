# MongoDB Interview Prep Guide (Q&A)

Concise, high-yield Q&A for quick revision. For deeper reading, follow the linked theory topics.

---

## 1. NoSQL & MongoDB Basics

**Q: What is MongoDB?**  
A: A document-oriented NoSQL database that stores data as flexible BSON (Binary JSON) documents in collections. Designed for horizontal scaling and flexible schema. [Read more](theory/01-nosql-and-mongodb.md)

**Q: How does MongoDB differ from a relational database?**  
A: No fixed schema, no joins (embed or reference instead), no multi-row transactions by default, horizontal scaling via sharding vs vertical scaling in RDBMS. [Read more](theory/01-nosql-and-mongodb.md)

**Q: What is the CAP theorem and where does MongoDB sit?**  
A: Distributed systems can guarantee only 2 of: Consistency, Availability, Partition tolerance. MongoDB is CP by default (strong consistency on primary), but can behave like AP with lower read/write concerns. [Read more](theory/01-nosql-and-mongodb.md)

**Q: When should you NOT use MongoDB?**  
A: When you need complex multi-table joins, strict ACID across many collections, highly normalized relational data, or complex reporting with ad-hoc SQL queries. [Read more](theory/01-nosql-and-mongodb.md)

---

## 2. Core Concepts

**Q: What is BSON?**  
A: Binary JSON — MongoDB's wire format. Extends JSON with additional types: Date, ObjectId, Int32/Int64, Binary, Decimal128. More compact and faster to parse than text JSON. [Read more](theory/02-core-concepts.md)

**Q: What is an ObjectId?**  
A: A 12-byte unique identifier auto-generated for `_id`. Contains: 4-byte timestamp + 5-byte random + 3-byte incrementing counter. Roughly monotonically increasing — useful for sorting by insertion time. [Read more](theory/02-core-concepts.md)

**Q: What is a replica set?**  
A: A group of MongoDB nodes that maintain the same data. One PRIMARY (accepts writes), one or more SECONDARies (replicate via oplog), optional ARBITERs (vote only, no data). [Read more](theory/02-core-concepts.md)

**Q: What is the oplog?**  
A: The operations log — a capped collection on each replica set member that records all write operations. Secondaries replay the oplog to stay in sync with the primary. [Read more](theory/02-core-concepts.md)

---

## 3. Data Modeling

**Q: When do you embed vs reference?**  
A: **Embed** when data is always accessed together, the relationship is 1-to-few, and the subdocument doesn't grow unboundedly. **Reference** when data is shared, grows large, or needs independent querying/updating. [Read more](theory/03-data-modeling.md)

**Q: What is the 16MB document size limit and how do you handle outliers?**  
A: MongoDB documents cannot exceed 16MB BSON. For outlier documents (e.g., viral posts with millions of likes), use the Outlier Pattern: store the first batch in the main doc + `hasOverflow: true`, and put the rest in an overflow collection. [Read more](theory/03-data-modeling.md)

**Q: What is the Bucket Pattern?**  
A: Group time-series events into fixed-size bucket documents (e.g., 60 readings per doc). Reduces document count and index overhead dramatically for IoT/metrics data. [Read more](theory/03-data-modeling.md)

**Q: What is the Computed Pattern?**  
A: Pre-calculate and store expensive aggregations (e.g., average rating) at write time rather than computing them at read time. Trades slightly stale data for fast reads. [Read more](theory/03-data-modeling.md)

---

## 4. Indexes & Aggregation

**Q: What index types does MongoDB support?**  
A: Single-field, Compound, Multikey (arrays), Text, Geospatial (2d/2dsphere), Hashed (for sharding), Wildcard, Partial, Sparse, TTL. [Read more](theory/04-indexes-and-aggregation.md)

**Q: What is the ESR rule for compound indexes?**  
A: **E**quality fields first, **S**ort fields second, **R**ange fields last. Ensures the index is used for both filtering and sorting efficiently. [Read more](theory/04-indexes-and-aggregation.md)

**Q: What is a covered query?**  
A: A query where ALL fields in the filter AND projection are in the index. MongoDB reads only the index and never fetches the document from disk — the fastest possible query. [Read more](theory/04-indexes-and-aggregation.md)

**Q: What is COLLSCAN vs IXSCAN in explain()?**  
A: COLLSCAN = full collection scan (scans every document — slow at scale). IXSCAN = index scan (reads only matching index entries — fast). Always aim for IXSCAN on frequently run queries. [Read more](theory/04-indexes-and-aggregation.md)

**Q: What is the aggregation pipeline?**  
A: A sequence of stages that transform documents. Each stage's output is the next stage's input. Common stages: `$match`, `$group`, `$project`, `$sort`, `$lookup`, `$unwind`, `$facet`. [Read more](theory/04-indexes-and-aggregation.md)

---

## 5. Transactions & Consistency

**Q: Does MongoDB support ACID transactions?**  
A: Yes, since v4.0 (single replica set) and v4.2 (sharded clusters). Multi-document transactions are available but have overhead (~3-5x) — use embedding to avoid them where possible. [Read more](theory/05-transactions-and-consistency.md)

**Q: What is writeConcern w:majority?**  
A: The write is acknowledged only after a majority of voting replica set members have applied it. Ensures the write survives a primary failure without rollback. Recommended for important data. [Read more](theory/05-transactions-and-consistency.md)

**Q: What is readConcern majority?**  
A: Only returns data that has been acknowledged by a majority of nodes — data that cannot be rolled back. Prevents reading "dirty" writes that might be lost in a failover. [Read more](theory/05-transactions-and-consistency.md)

**Q: What are retryable writes?**  
A: With `retryWrites: true` in the connection URI (default in drivers), the driver automatically retries certain write operations once on network errors — prevents duplicate inserts during transient failures. [Read more](theory/05-transactions-and-consistency.md)

---

## 6. TTL & Change Streams

**Q: How does a TTL index work?**  
A: A background thread runs every ~60 seconds and deletes documents where the indexed Date field is older than `expireAfterSeconds`. Only works on Date fields; compound TTL indexes are not supported. [Read more](theory/06-ttl-and-change-streams.md)

**Q: What is a capped collection?**  
A: A fixed-size collection that acts as a circular buffer — oldest documents are automatically overwritten when the size limit is reached. Insertion order preserved. No delete, no arbitrary update, no sharding. [Read more](theory/06-ttl-and-change-streams.md)

**Q: What are change streams?**  
A: Real-time notification stream of data changes (insert, update, delete, replace) on a collection, database, or deployment. Resumable via resume tokens. Requires replica set or sharded cluster. [Read more](theory/06-ttl-and-change-streams.md)

---

## 7. Advanced Aggregation

**Q: How does $lookup work and when should you avoid it?**  
A: `$lookup` performs a left outer join between two collections at query time. Avoid for high-throughput, low-latency paths — the join happens in memory and is expensive. Prefer embedding frequently co-accessed data. [Read more](theory/07-aggregation-advanced.md)

**Q: What is $facet used for?**  
A: Runs multiple sub-pipelines on the same input documents simultaneously, returning all results in one response. Ideal for e-commerce search pages that need results + category counts + price ranges in one query. [Read more](theory/07-aggregation-advanced.md)

**Q: What is $graphLookup?**  
A: Recursive lookup that traverses a graph or tree structure within a collection. Use cases: org charts (who reports to whom), product category hierarchies, social network friend-of-friend queries. [Read more](theory/07-aggregation-advanced.md)

---

## 8. Advanced Topics

**Q: What is sharding?**  
A: Horizontal partitioning of data across multiple shards (servers). A shard key determines which shard each document lives on. Enables linear scaling beyond a single server. [Read more](theory/08-advanced.md)

**Q: What is a good shard key?**  
A: High cardinality (many distinct values), even distribution (no hot shards), and matches common query patterns. Avoid: low cardinality fields, monotonically increasing fields alone (e.g., ObjectId — all writes go to one shard). [Read more](theory/08-advanced.md)

**Q: What is a hot shard / jumbo chunk?**  
A: A shard that receives disproportionate traffic (hot shard) or a chunk that grows beyond the max chunk size and can't be split (jumbo chunk, often due to low-cardinality shard key). [Read more](theory/08-advanced.md)

**Q: How do you monitor MongoDB performance?**  
A: `explain('executionStats')` for individual queries, `db.setProfilingLevel(1)` for slow query logging, `$indexStats` for index usage, `db.serverStatus()` for metrics, `mongostat`/`mongotop` for real-time ops. [Read more](theory/08-advanced.md)

---

For deeper explanations, diagrams, and code examples, follow the linked theory modules.

