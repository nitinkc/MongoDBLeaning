# MongoDB Learning Labs

A structured, incremental learning path to master MongoDB with hands-on labs, comprehensive theory documentation, and a Docker-based environment.

## 🎯 Learning Path

1. **Theory** → Read the [MkDocs documentation](docs/) for each topic
2. **Labs** → Run the MongoDB shell lab exercises in `labs/`
3. **Interview Prep** → Review the Q&A in `docs/interview-prep.md`

## 🚀 Quick Start

### Start the MongoDB Cluster

```bash
cd docker && docker compose up -d
```

This starts:
- **mongo1** (primary) on port `27017`
- **mongo2** (secondary) on port `27018`
- **mongo3** (secondary) on port `27019`
- **mongo-express** UI on port `8081` → http://localhost:8081

### Run Labs

```bash
# Run a specific lab
docker exec -it mongo1 mongosh --file /labs/01_database_basics.js

# Interactive MongoDB shell
docker exec -it mongo1 mongosh

# Or connect from host (requires mongosh installed locally)
mongosh "mongodb://localhost:27017/mongo_labs?replicaSet=rs0"
```

### View Documentation

```bash
# Setup Python virtual environment and install dependencies (one-time)
chmod +x scripts/setup.sh
./scripts/setup.sh

# Activate the virtual environment (if not already active)
source venv/bin/activate

# Serve docs locally
mkdocs serve

# Open http://localhost:8000
```

**Alternative (manual setup)**:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
mkdocs serve
```

## 📚 Theory Modules

| Module  | Topic                                                                        |
|:--------|:-----------------------------------------------------------------------------|
| 01      | [NoSQL & MongoDB](docs/theory/01-nosql-and-mongodb.md)                       |
| 02      | [Core Concepts](docs/theory/02-core-concepts.md)                             |
| 03      | [Data Modeling](docs/theory/03-data-modeling.md)                             |
| 04      | [Indexes & Aggregation](docs/theory/04-indexes-and-aggregation.md)           |
| 05      | [Transactions & Consistency](docs/theory/05-transactions-and-consistency.md) |
| 06      | [TTL & Change Streams](docs/theory/06-ttl-and-change-streams.md)             |
| 07      | [Advanced Aggregation](docs/theory/07-aggregation-advanced.md)               |
| 08      | [Advanced Topics](docs/theory/08-advanced.md)                                |

## 🔬 Lab Exercises

| Lab  | Description                                     |
|:-----|:------------------------------------------------|
| 01   | Database Basics - CRUD operations               |
| 02   | Document Modeling - Embedding vs Referencing    |
| 03   | Indexes - Types, creation, and query plans      |
| 04   | Aggregation Pipeline - Core stages              |
| 05   | Transactions - Multi-document ACID              |
| 06   | TTL & Capped Collections                        |
| 07   | Advanced Aggregation - $lookup, $facet          |
| 08   | Schema Patterns - Bucket, polymorphic, computed |
| 09   | Replica Set - Read preferences, write concerns  |
| 10   | Security Basics - Users, roles, auth            |
| 11   | Monitoring & Performance - Profiler, explain    |

## 📖 Documentation Deployment

Documentation is automatically deployed to GitHub Pages on every commit to `main` or `master` branch via GitHub Actions.

**To enable GitHub Pages deployment:**

1. Go to your GitHub repository settings
2. Navigate to **Settings** → **Pages**
3. Under "Build and deployment":
   - Set **Source** to "GitHub Actions"
   - The workflow will automatically build and deploy your docs

The documentation will be available at: `https://<your-username>.github.io/<repo-name>/`

**Workflow details** (`.github/workflows/deploy.yml`):
- ✅ Triggers on push to `main`/`master` and pull requests
- ✅ Sets up Python 3.11 with dependency caching
- ✅ Builds MkDocs static site
- ✅ Deploys to GitHub Pages automatically

## 🛠️ Requirements

- Docker Desktop
- mongosh (optional, for local connection)
- Python 3.x + pip (for MkDocs)
- GitHub repository (for automatic deployment)

