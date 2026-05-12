# MongoDB Labs Overview

This page maps each hands-on lab to the theory topic it reinforces.  
Labs are available in two formats: **MongoDB shell scripts** (`mongosh`) in `labs/` and **Python/Jupyter notebooks** in `notebooks/`.

## Running Labs

### MongoDB Shell (`mongosh`)

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

| Lab | Shell Script                  | Python Notebook                    | Description                                                        | Theory Module                                                                                  |
|:----|:------------------------------|:-----------------------------------|:-------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------|
| 01  | `01_database_basics.js`       | `01_database_basics.ipynb`         | CRUD operations, projections, bulk writes                          | [NoSQL & MongoDB](theory/01-nosql-and-mongodb.md), [Core Concepts](theory/02-core-concepts.md) |
| 02  | `02_document_modeling.js`     | `02_document_modeling.ipynb`       | Embedding vs referencing, 1-to-many, many-to-many                  | [Data Modeling](theory/03-data-modeling.md)                                                    |
| 03  | `03_indexes.js`               | `03_indexes.ipynb`                 | Single-field, compound, multikey, text, partial, sparse; explain() | [Indexes & Aggregation](theory/04-indexes-and-aggregation.md)                                  |
| 04  | `04_aggregation_pipeline.js`  | `04_aggregation_pipeline.ipynb`    | $match, $group, $project, $unwind, $sort, $count                   | [Indexes & Aggregation](theory/04-indexes-and-aggregation.md)                                  |
| 05  | `05_transactions.js`          | `05_transactions.ipynb`            | Multi-document ACID transactions, retry logic                      | [Transactions & Consistency](theory/05-transactions-and-consistency.md)                        |
| 06  | `06_ttl_and_capped.js`        | `06_ttl_and_capped.ipynb`          | TTL indexes, capped collections, change stream intro               | [TTL & Change Streams](theory/06-ttl-and-change-streams.md)                                    |
| 07  | `07_advanced_aggregation.js`  | `07_advanced_aggregation.ipynb`    | $lookup, $facet, $bucket, $graphLookup, $setWindowFields           | [Advanced Aggregation](theory/07-aggregation-advanced.md)                                      |
| 08  | `08_schema_patterns.js`       | `08_schema_patterns.ipynb`         | Bucket, Computed, Polymorphic, Outlier, Subset patterns            | [Data Modeling](theory/03-data-modeling.md)                                                    |
| 09  | `09_replica_set.js`           | `09_replica_set.ipynb`             | rs.status(), read preferences, writeConcern, replication lag       | [Core Concepts](theory/02-core-concepts.md), [Advanced Topics](theory/08-advanced.md)          |
| 10  | `10_security_basics.js`       | `10_security_basics.ipynb`         | createUser, built-in roles, custom roles, TLS guidance             | [Advanced Topics](theory/08-advanced.md)                                                       | 
| 11  | `11_monitoring_and_performance.js` | `11_monitoring_and_performance.ipynb` | explain(), profiler, $indexStats, serverStatus, currentOp          | [Advanced Topics](theory/08-advanced.md)                                                       |

### Python / Jupyter Notebooks

```bash
cd notebooks
jupyter notebook 01_database_basics.ipynb
```

**Python notebooks are located in the `notebooks/` folder in the repository.** Open any notebook file with `jupyter notebook <filename>.ipynb` after starting your environment.
