# MongoDB Learning Labs — Jupyter Notebooks (Python/pymongo)

This folder contains **Jupyter notebooks** for hands-on MongoDB learning using **Python** and the **pymongo** driver. Each notebook corresponds to a lab exercise and includes:

- 📖 Markdown theory cells with links to documentation
- 🔧 Executable Python/pymongo code cells
- 🔀 Dual connection support: **Docker** (local) or **MongoDB Atlas** (cloud)

## Quick Start

### 1. Install dependencies
```bash
pip install -r ../requirements.txt
```

### 2. Start MongoDB

**Option A: Docker (local 3-node replica set)**
```bash
cd ../docker
docker compose up -d
mongosh "mongodb://127.0.0.1:27017/mongo_labs?directConnection=true"
```

**Option B: MongoDB Atlas (cloud)**
- Get your Atlas connection string
- In the first notebook cell, set `USE_ATLAS = True` and fill in `ATLAS_URI`

### 3. Run a notebook
```bash
jupyter notebook 01_database_basics.ipynb
```

Or launch Jupyter Lab:
```bash
jupyter lab
```

## Lab Structure

| Lab | File | Topics |
|---|---|---|
| 01 | `01_database_basics.ipynb` | CRUD, projections, operators, bulk writes |
| 02 | `02_document_modeling.ipynb` | Embedding vs referencing, one-to-many, many-to-many |
| 03 | `03_indexes.ipynb` | Single-field, compound, unique, multikey, text, TTL, `explain()` |
| 04+ | *To be generated* | Aggregation, transactions, TTL/capped, advanced patterns, replica sets, security, monitoring |

## Connection Setup

Each notebook's first cell includes automatic connection logic:

```python
USE_ATLAS = False  # Toggle this

# If False: connects to Docker replica set at localhost:27017
# If True: connects to Atlas (set ATLAS_URI first)
```

## Key Differences: JS vs Python

| Concept | mongosh (JS) | pymongo (Python) |
|---|---|---|
| Insert | `db.coll.insertOne({...})` | `db.coll.insert_one({...})` |
| Find | `db.coll.findOne(...)` | `db.coll.find_one(...)` |
| Update | `db.coll.updateOne(filter, {$set:...})` | `db.coll.update_one(filter, {"$set":...})` |
| Aggregation | `db.coll.aggregate([...])` | `db.coll.aggregate([...])` |
| Transactions | `session.startTransaction()` | `session.start_transaction()` |
| Indexes | `db.coll.createIndex({field:1})` | `db.coll.create_index([("field",1)])` |

## Tips

- **Run cells in order** — each lab builds on seeded data from previous cells
- **Reset collections** — each lab starts with `db.collection.drop()` before inserting test data
- **Pretty printing** — use the `pp` object (PrettyPrinter) for readable output
- **Error handling** — cells include try/except for operations that may fail on second run
- **Connection toggle** — change `USE_ATLAS` and re-run the connection cell to switch environments

## Next Steps

1. Start with **Lab 01** (Database Basics) to learn CRUD operations
2. Progress to **Lab 02** (Document Modeling) to understand embedding vs referencing
3. Master **Lab 03** (Indexes) for query performance optimization
4. Advanced labs (04+) cover pipelines, transactions, sharding, and production patterns

---

**See also:**
- [Theory modules](../docs/theory/) — Comprehensive explanations with diagrams
- [mongosh labs](../labs/) — Original JavaScript versions
- [Docker setup](../docker/) — Replica set initialization

