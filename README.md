# MongoDB Learning Labs

A practical MongoDB learning repo with:

- 11 `mongosh` labs in [`labs/`](labs/)
- 11 Python/Jupyter notebooks in [`notebooks/`](notebooks/)
- 8 theory modules in [`docs/theory/`](docs/theory/)
- A local 3-node MongoDB replica set in `docker/`

## Quick start

### 1) Start MongoDB (Docker)

```bash
cd docker
./start.sh
```

### 2) Verify setup

```bash
cd docker
./verify-setup.sh
```

### 3) Open first lab

```bash
cd notebooks
jupyter notebook 01_database_basics.ipynb
```

Or run the shell lab:

```bash
docker exec -it mongo1 mongosh --file /labs/01_database_basics.js
```

## Connection options

### MongoDB Compass (local)

```text
mongodb://127.0.0.1:27017/mongo_labs?directConnection=true
```

Recommended Compass settings:

- Authentication: None
- TLS/SSL: Off
- Direct connection: Enabled

### Local `mongosh`

```bash
mongosh 'mongodb://127.0.0.1:27017/mongo_labs?directConnection=true'
```

### Docker `mongosh`

```bash
docker exec -it mongo1 mongosh 'mongodb://localhost:27017/mongo_labs?replicaSet=rs0'
```

### Python (`pymongo`)

```python
from pymongo import MongoClient

client = MongoClient('mongodb://127.0.0.1:27017/?directConnection=true')
db = client['mongo_labs']
```

### Mongo Express UI

```text
http://localhost:8081
```

## Learning path

| Level | Labs | Focus | Time |
|---|---|---|---|
| Beginner | 01-03 | CRUD, modeling, indexes | 2-3h |
| Intermediate | 04-06 | Aggregation, transactions, TTL | 3-4h |
| Advanced | 07-11 | Advanced aggregation, patterns, replica sets, security, monitoring | 4-5h |

Total hands-on time: about 10 hours.

## What is pre-seeded

Database: `mongo_labs`

- `users` (3)
- `products` (3)
- `orders` (3)
- `events` (4)
- `sessions` (TTL examples)

## Most-used commands

```bash
# start / verify
cd docker
./start.sh
./verify-setup.sh

# logs and status
cd docker
docker compose ps
docker compose logs mongo-init
docker exec mongo1 mongosh --eval "rs.status()"

# stop (keep data)
cd docker
docker compose down

# clean reset (delete data)
cd docker
docker compose down -v
./start.sh --clean
```

## Troubleshooting

- Port conflicts: run `docker compose down`, then `./start.sh`
- Cannot connect: run `docker compose ps` and `./verify-setup.sh`
- `mongo-init` issues: run `docker compose logs mongo-init`
- Missing data after restart: `docker compose down -v` removes volumes

## Repo map

- [`labs/`](labs/) - `mongosh` labs
- [`notebooks/`](notebooks/) - Python/Jupyter labs
- [`docs/`](docs/) - theory and interview prep
- [`docker/`](docker/) - replica set and startup scripts
- [`scripts/`](scripts/) - helper scripts

## Next step

Start with:

- [`notebooks/01_database_basics.ipynb`](notebooks/01_database_basics.ipynb) (guided)
- or [`labs/01_database_basics.js`](labs/01_database_basics.js) (shell-first)
