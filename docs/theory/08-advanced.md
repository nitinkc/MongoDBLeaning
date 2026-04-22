# Advanced Topics

This module covers advanced MongoDB features including replica sets for high availability, security best practices, monitoring and performance optimization.

## Replica Sets

A replica set is a group of MongoDB instances that maintain the same data for redundancy and high availability.

### Replica Set Architecture

```
┌─────────────────────────────────────────────────┐
│            MongoDB Replica Set                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  PRIMARY         SECONDARY 1     SECONDARY 2    │
│  (Read+Write)    (Read Only)      (Read Only)    │
│                                                  │
│  Sync → Replication Lag (usually < 1sec)        │
│                                                  │
│  Elections: If primary fails, secondaries elect │
│  new primary automatically (failover)            │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Setting Up a Replica Set

```javascript
// Initialize replica set with 3 members (primary + 2 secondaries)
// In each mongod config:
// replication:
//   replSetName: "rs0"

// Connect to primary and initiate:
rs.initiate({
  _id: "rs0",  // Replica set name
  members: [
    { _id: 0, host: "mongo1:27017", priority: 1 },  // Primary (highest priority)
    { _id: 1, host: "mongo2:27017", priority: 0.5 }, // Secondary
    { _id: 2, host: "mongo3:27017", priority: 0.5 }  // Arbiter (no data, votes only)
  ]
});

// Check replica set status
rs.status();

// Current primary:
db.hello();
// Returns: { primary: "mongo1:27017", ... }
```

### Replication & Write Concern

```javascript
// Data is written to primary, then replicated to secondaries

// Write Concern: How many replicas must ACK
db.collection.insertOne(
  { data: "..." },
  { writeConcern: { w: 1 } }  // Return after primary ACKs (fast)
);

db.collection.insertOne(
  { data: "..." },
  { writeConcern: { w: "majority" } }  // Return after majority ACKs (safe)
);

// With write concern "majority":
// 1. Client sends write to primary
// 2. Primary writes to memory + journal
// 3. Primary replicates to secondaries
// 4. Secondaries ACK
// 5. Primary returns ACK to client once majority ACKs received

// If primary crashes before majority ACKs, write is rolled back on primary recovery
// If write has "majority" confirmation, it survives any failure
```

### Failover & Elections

```javascript
// Secondaries continuously monitor primary
// If primary is down/unresponsive for electionTimeoutMillis (default 10s):
// Secondaries hold an election to choose new primary

// Votes:
// - Each member votes
// - Highest priority wins (if reachable)
// - Ties broken by oldest data

// After election: existing connections to old primary fail
// Applications must retry (drivers auto-retry usually)

rs.stepDown();  // Force primary to step down (for maintenance)

// After stepDown, primary becomes secondary and triggers election
// No writes possible during election (usually < 10 seconds)
```

---

## Security

MongoDB security layers from network isolation to encryption and access control.

### Authentication & Authorization

```javascript
// Create user with password
db.createUser({
  user: "alice",
  pwd: "securePassword123",
  roles: [
    { role: "read", db: "myapp" },
    { role: "readWrite", db: "myapp" },
    { role: "admin", db: "admin" }  // Admin on admin DB
  ]
});

// Update user password
db.changeUserPassword("alice", "newPassword456");

// Grant additional role
db.grantRolesToUser(
  "alice",
  [{ role: "backup", db: "admin" }]
);

// Revoke role
db.revokeRolesFromUser(
  "alice",
  [{ role: "admin", db: "admin" }]
);

// Create custom role
db.createRole({
  role: "dataAnalyst",
  privileges: [
    {
      resource: { db: "analytics", collection: "reports" },
      actions: ["find", "aggregate"]
    }
  ],
  roles: []
});
```

### Built-in Roles

```javascript
// Database Roles (per DB):
// - read: Read data (find, aggregate, listIndexes, etc.)
// - readWrite: Read + insert/update/delete
// - dbAdmin: Administrative tasks (index management, profiling, etc.)
// - userAdmin: User/role management

// Admin Roles (admin DB only):
// - root: Full admin access to all databases
// - admin: Full admin on admin DB
// - backup: Backup/restore
// - clusterAdmin: Cluster administration (replica sets, sharding)
// - dbAdminAnyDatabase: dbAdmin on all databases
// - readAnyDatabase: read on all databases
// - readWriteAnyDatabase: readWrite on all databases
// - userAdminAnyDatabase: User management on all databases
```

### Network Security: TLS/SSL

```javascript
// mongod.conf with TLS enabled:
// net:
//   tls:
//     mode: requireTLS
//     certificateKeyFile: /etc/mongodb/certs/server.pem
//     CAFile: /etc/mongodb/certs/ca.pem

// Connection with TLS from client:
mongosh "mongodb://alice:password@mongo1:27017/?ssl=true&sslCAFile=/path/to/ca.pem"

// Encrypt data in transit and at rest
// Also enables certificate-based authentication (mTLS)
```

### Field-Level Encryption (Automatic)

```javascript
// MongoDB Automatic Client-Side Encryption (ACSE)
// Encrypts fields before sending to server

const client = new MongoClient(uri, {
  schemaMap: {
    "myapp.users": {
      "bsonType": "object",
      "properties": {
        "ssn": {
          "encrypt": {
            "keyId": [keyId],
            "algorithm": "AEAD_AES_256_CBC_HMAC_SHA_512"
          }
        }
      }
    }
  }
});

// When you write:
db.users.insertOne({
  name: "Alice",
  ssn: "123-45-6789"  // Automatically encrypted before sending
});

// Encrypted data in MongoDB:
// { name: "Alice", ssn: BinData(...) }

// When you read:
let user = db.users.findOne({ name: "Alice" });
// SSN automatically decrypted by client
print(user.ssn);  // "123-45-6789"
```

---

## Monitoring & Performance

Monitor MongoDB health and optimize query performance.

### Server Metrics

```javascript
// Get server stats
db.serverStatus();
// Returns: {
//   host: "mongo1:27017",
//   version: "7.0.0",
//   opcounters: { insert: 1000, query: 5000, update: 2000, delete: 100 },
//   connections: { current: 50, totalCreated: 200 },
//   memory: { resident: 512, virtual: 2048 },
//   locks: { Global: { acquireCount: { r: 10000, w: 5000 } } },
//   ...
// }

// Replica set status
rs.status();
// Shows each member: state (PRIMARY, SECONDARY, ARBITER), 
// health, lastHeartbeat, syncSourceHost, replication lag

// Current operations
db.currentOp();
// Shows all running operations with details on duration, lock waiting, etc.

// Slow queries (profiling)
// Enable profiling:
db.setProfilingLevel(1, { slowms: 100 });  // Log ops > 100ms

// Query profiling data:
db.system.profile.find({ millis: { $gt: 100 } }).limit(10);
```

### Explain for Query Performance

```javascript
// Detailed query execution plan
let plan = db.users.find({ email: "alice@example.com" })
  .explain("executionStats");

// Key metrics:
// - executionStages.stage: "IXSCAN" (good) vs "COLLSCAN" (bad)
// - executionStages.nReturned: Documents matched
// - executionStages.totalDocsExamined: Documents scanned
// - executionStats.totalKeysExamined: Index entries scanned
// - executionStats.executionTimeMillis: Time taken

// Rule of thumb:
// totalDocsExamined ≈ nReturned  (efficient)
// totalDocsExamined >> nReturned (inefficient, need index)

if (plan.executionStats.executionStages.stage === "COLLSCAN") {
  print("WARNING: Full collection scan! Create an index.");
}
```

### Index Usage & Optimization

```javascript
// Find which indexes are being used
db.collection.aggregate([
  { $indexStats: {} }
]);

// Returns: { name: "idx_email_1", accesses: { ops: 50000, since: Date } }

// Unused indexes:
db.collection.aggregate([
  {
    $indexStats: {
      $match: { "accesses.ops": 0 }
    }
  }
]);

// Drop unused indexes:
db.users.dropIndex("idx_unused_1");

// Find slow queries and add indexes:
db.system.profile.find({ millis: { $gt: 100 } })
  .sort({ millis: -1 })
  .limit(10);

// For each slow query, explain it and add appropriate index
```

### Connection Pooling & Concurrency

```javascript
// Connection pool settings in driver:
// maxPoolSize: 100         // Max connections to maintain
// minPoolSize: 10          // Min connections to maintain
// maxIdleTimeMS: 45000     // Close idle connections after this
// waitQueueTimeoutMS: 5000 // Fail if can't get connection in 5s

// High concurrency best practices:
// 1. Use appropriate pool size (typically 50-100)
// 2. Use write/read preferences correctly
// 3. Avoid blocking operations (use async/await)
// 4. Monitor serverStatus.connections

// Example with Node.js driver:
const client = new MongoClient(uri, {
  maxPoolSize: 100,
  minPoolSize: 10
});
```

### Schema Validation

```javascript
// Create collection with JSON schema validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        },
        name: {
          bsonType: "string",
          minLength: 1
        },
        age: {
          bsonType: "int",
          minimum: 18,
          maximum: 150
        },
        createdAt: {
          bsonType: "date"
        }
      },
      additionalProperties: false
    }
  }
});

// Insert must match schema:
db.users.insertOne({ email: "alice@example.com", name: "Alice", age: 30 });
// OK

db.users.insertOne({ email: "invalid", name: "Bob" });
// Error: Document failed validation
```

---

## Sharding (Horizontal Scaling)

Distribute data across multiple servers for massive scale.

```
┌──────────────────────────────────────────────────────────┐
│            Sharded MongoDB Cluster                       │
├─────────────────────────────────────────────────────────-┤
│                                                          │
│  Config Servers                Router (mongos)           │
│  (Shard balance, metadata)     (Route queries)           │
│         │                            │                   │
│         └────────────┬───────────────┘                   │
│                      │                                   │
│       ┌──────────────┼──────────────┐                    │
│       │              │              │                    │
│    SHARD 1        SHARD 2        SHARD 3                 │
│ (Keys A-H)     (Keys I-P)    (Keys Q-Z)                  │
│                                                          │
│ Each shard is a replica set                              │
│ Data distributed by shard key                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Sharding Setup

```javascript
// 1. Enable sharding on database
sh.enableSharding("myapp");

// 2. Create index on shard key (required)
db.users.createIndex({ email: 1 });

// 3. Shard collection
sh.shardCollection("myapp.users", { email: 1 });
// Ranges of email values go to different shards

// 4. Check shard distribution
db.users.getShardDistribution();
// Shows which shard holds what ranges of data
```

### Shard Key Considerations

```javascript
// Good shard key:
// - High cardinality (many unique values)
// - Good distribution (no hotspots)
// - Commonly queried (avoid queries that hit all shards)

// Bad shard key:
// - Low cardinality (few unique values) → imbalanced shards
// - Status field (e.g., "active", "inactive") → most data in 1 shard
// - Ascending date → new data always writes to 1 shard
// - Random UUID → every write hits different shard (inefficient)

// Example: Choose wisely
db.orders.createIndex({ customerId: 1 });
sh.shardCollection("myapp.orders", { customerId: 1 });  // ✅ Good: many customers, distributes well

db.orders.createIndex({ status: 1 });
sh.shardCollection("myapp.orders", { status: 1 });  // ❌ Bad: few statuses, data imbalanced
```

---

## Summary

**Replica Sets:**

- High availability via automatic failover
- Replication lag: data eventually consistent across secondaries
- Write concern controls how many replicas must ACK
- Elections: secondaries elect new primary if primary fails

**Security:**

- Authentication: Username/password + role-based authorization
- Network: TLS/SSL for encryption in transit
- Field encryption: Automatic client-side encryption for sensitive data
- Audit: Monitor access with profiling and audit logs

**Monitoring:**

- `db.serverStatus()`: CPU, memory, connections, operations
- `db.currentOp()`: Active operations
- `explain()`: Query execution plan
- `$indexStats`: Index usage metrics

**Performance:**

- Use explain() to verify index usage
- Drop unused indexes
- Create indexes for frequent queries (ESR rule)
- Connection pooling for high concurrency
- Schema validation to prevent invalid data

**Sharding:**

- Horizontal scaling by distributing data across shards
- Shard key determines data distribution
- Good shard key: high cardinality, even distribution, commonly queried
- Router (mongos) transparently routes queries to shards
