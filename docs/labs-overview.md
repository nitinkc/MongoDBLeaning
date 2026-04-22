# MongoDB Labs Overview

This page maps each hands-on lab to the theory topic it reinforces.  
All labs are MongoDB shell scripts (`mongosh`) located in the `labs/` directory.

## Running Labs

```bash
# Start the cluster first
cd docker && docker compose up -d

# Run a specific lab
docker exec -it mongo1 mongosh --file /labs/01_database_basics.js

# Interactive shell
docker exec -it mongo1 mongosh
```

---

## Lab Summary

| Lab  | File                               | Description                                                        | Theory Module                                                                                  |
|:-----|:-----------------------------------|:-------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------|
| 01   | `01_database_basics.js`            | CRUD operations, projections, bulk writes                          | [NoSQL & MongoDB](theory/01-nosql-and-mongodb.md), [Core Concepts](theory/02-core-concepts.md) |
| 02   | `02_document_modeling.js`          | Embedding vs referencing, 1-to-many, many-to-many                  | [Data Modeling](theory/03-data-modeling.md)                                                    |
| 03   | `03_indexes.js`                    | Single-field, compound, multikey, text, partial, sparse; explain() | [Indexes & Aggregation](theory/04-indexes-and-aggregation.md)                                  |
| 04   | `04_aggregation_pipeline.js`       | $match, $group, $project, $unwind, $sort, $count                   | [Indexes & Aggregation](theory/04-indexes-and-aggregation.md)                                  |
| 05   | `05_transactions.js`               | Multi-document ACID transactions, retry logic                      | [Transactions & Consistency](theory/05-transactions-and-consistency.md)                        |
| 06   | `06_ttl_and_capped.js`             | TTL indexes, capped collections, change stream intro               | [TTL & Change Streams](theory/06-ttl-and-change-streams.md)                                    |
| 07   | `07_advanced_aggregation.js`       | $lookup, $facet, $bucket, $graphLookup, $setWindowFields           | [Advanced Aggregation](theory/07-aggregation-advanced.md)                                      |
| 08   | `08_schema_patterns.js`            | Bucket, Computed, Polymorphic, Outlier, Subset patterns            | [Data Modeling](theory/03-data-modeling.md)                                                    |
| 09   | `09_replica_set.js`                | rs.status(), read preferences, writeConcern, replication lag       | [Core Concepts](theory/02-core-concepts.md), [Advanced Topics](theory/08-advanced.md)          |
| 10   | `10_security_basics.js`            | createUser, built-in roles, custom roles, TLS guidance             | [Advanced Topics](theory/08-advanced.md)                                                       |
| 11   | `11_monitoring_and_performance.js` | explain(), profiler, $indexStats, serverStatus, currentOp          | [Advanced Topics](theory/08-advanced.md)                                                       |


