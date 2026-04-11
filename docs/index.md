# MongoDB Learning Labs Documentation

A structured, incremental learning path to master MongoDB — from document model fundamentals to sharding and security.

## 📌 Quick Links

- **[GitHub Repository](https://github.com/your-org/MongoDBLearning)** — Source code, Docker setup, and lab files
- **[Labs Overview](labs-overview.md)** — All 11 hands-on lab exercises
- **[Interview Prep](interview-prep.md)** — Q&A and revision guide

## 🚀 Getting Started

### 1. Start the MongoDB Cluster
```bash
cd docker && docker compose up -d
```
Starts a **3-node replica set** (`mongo1`, `mongo2`, `mongo3`) + **Mongo Express UI** at [http://localhost:8081](http://localhost:8081).

### 2. Run a Lab
```bash
docker exec -it mongo1 mongosh --file /labs/01_database_basics.js
```

### 3. Interactive Shell
```bash
docker exec -it mongo1 mongosh
# or from host (requires mongosh installed):
mongosh "mongodb://localhost:27017/mongo_labs?replicaSet=rs0"
```

### 4. View These Docs Locally
```bash
pip install -r requirements.txt
mkdocs serve
# open http://localhost:8000
```

---

## 📚 Learning Path

| Step | Resource | Description |
|------|----------|-------------|
| 1 | [NoSQL & MongoDB](theory/01-nosql-and-mongodb.md) | Document model, CAP theorem, when to use MongoDB |
| 2 | [Core Concepts](theory/02-core-concepts.md) | BSON, replica sets, ObjectId, collections |
| 3 | [Data Modeling](theory/03-data-modeling.md) | Embedding vs referencing, schema patterns |
| 4 | [Indexes & Aggregation](theory/04-indexes-and-aggregation.md) | Index types, pipeline stages |
| 5 | [Transactions & Consistency](theory/05-transactions-and-consistency.md) | ACID, read/write concerns |
| 6 | [TTL & Change Streams](theory/06-ttl-and-change-streams.md) | Data expiry, real-time events |
| 7 | [Advanced Aggregation](theory/07-aggregation-advanced.md) | $lookup, $facet, $graphLookup |
| 8 | [Advanced Topics](theory/08-advanced.md) | Sharding, security, monitoring |

---

## 🔬 Lab Exercises

Hands-on MongoDB shell (mongosh) scripts in the `labs/` directory.  
See **[Labs Overview](labs-overview.md)** for the full list with descriptions.

