# TTL & Change Streams

This module covers two MongoDB features for managing data lifecycle and reacting to changes: TTL (Time-To-Live) indexes that automatically expire documents, and Change Streams for real-time data change notifications.

## TTL (Time-To-Live) Indexes

MongoDB can automatically delete documents after a certain time, useful for temporary data like sessions, logs, and cache.

### TTL Index Basics

```javascript
// Create a TTL index on a Date field
// Documents are deleted after the specified seconds have elapsed

db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 3600 }  // Delete after 1 hour
);

// Insert session data
db.sessions.insertOne({
  _id: ObjectId("..."),
  userId: "alice",
  token: "abc123xyz",
  createdAt: new Date()  // Document created now
});

// After 3600 seconds (1 hour), MongoDB automatically deletes this document
// No action needed — completely automated
```

### TTL Index Rules

```javascript
// 1. TTL field must be a Date type
db.logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 86400 });  // ✅ Date field

// 2. Cannot be _id field
db.sessions.createIndex({ _id: 1 }, { expireAfterSeconds: 3600 });  // ❌ Error

// 3. Can combine with other index properties
db.cache.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, unique: true, sparse: true }
);

// 4. expireAfterSeconds: 0 means expire immediately on creation
db.tempData.createIndex({ createdAt: 1 }, { expireAfterSeconds: 0 });
// Useful for one-time use documents
```

### Practical TTL Examples

#### Sessions (Auto-expire after 24 hours)

```javascript
// Create index: sessions older than 24h are deleted
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 }  // 24 hours
);

// Insert session
db.sessions.insertOne({
  _id: ObjectId("..."),
  userId: "alice",
  token: generateToken(),
  createdAt: new Date(),
  lastActivity: new Date()
});

// Automatic cleanup — no cron job needed
// Perfect for temporary authentication tokens
```

#### Cache (Auto-expire after custom duration)

```javascript
// Cache entries older than 30 minutes
db.cache.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 1800 }
);

db.cache.insertOne({
  key: "user:alice:profile",
  value: { name: "Alice", email: "alice@example.com" },
  expiresAt: new Date()  // Now + 30 min by TTL
});
```

#### Application Logs (Auto-expire after 7 days)

```javascript
db.logs.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 604800 }  // 7 days
);

db.logs.insertOne({
  level: "info",
  message: "User alice logged in",
  timestamp: new Date()
});

// Logs older than 7 days are automatically removed
// No need for manual cleanup scripts
```

#### One-Time Use Data (Expire immediately)

```javascript
db.otp_tokens.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 0 }  // Expire immediately after insert time
);

// Better: Set custom expiration
db.otp_tokens.insertOne({
  _id: generateUUID(),
  userId: "alice",
  code: "123456",
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 5 * 60 * 1000)  // 5 minutes from now
});

// Use expiresAt field instead:
db.otp_tokens.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);
```

### TTL Behavior Details

```javascript
// Background thread checks TTL indexes every 60 seconds
// Deletion is not instantaneous — allow ~1 minute delay

// Delayed example:
db.sessions.insertOne({
  userId: "alice",
  createdAt: new Date(Date.now() - 3700000)  // 3700 seconds ago (> 3600)
});

print(db.sessions.countDocuments({}));  // Still exists initially
// Wait ~1 minute...
print(db.sessions.countDocuments({}));  // Now deleted

// Notes:
// - Deletion happens on secondary replicas at same time as primary
// - TTL index on secondary doesn't delete until primary deletes
// - Sharded clusters: each shard runs TTL cleanup independently
```

---

## Capped Collections

Fixed-size collections that automatically remove oldest documents when full.

```javascript
// Create a capped collection of 10MB max size
db.createCollection(
  "logs",
  { capped: true, size: 10485760 }  // 10MB
);

// Or capped by document count
db.createCollection(
  "events",
  { capped: true, max: 1000 }  // Max 1000 documents
);

// Inserts work normally
db.logs.insertMany([
  { level: "info", message: "Application started" },
  { level: "error", message: "Connection timeout" }
]);

// When collection reaches 10MB, oldest documents are automatically removed
// FIFO (First-In-First-Out) behavior

// Queries on capped collections return insertion order by default
db.logs.find().sort({ $natural: 1 });   // Oldest first
db.logs.find().sort({ $natural: -1 });  // Newest first (reverse)
```

### Capped vs. TTL

| Feature | Capped Collection | TTL Index |
|---------|-------------------|-----------|
| **Removal Trigger** | Size limit reached | Time elapsed |
| **Order** | FIFO (oldest first) | Time-based |
| **Best For** | Fixed-size logs, activity feeds | Sessions, transient data, cache |
| **Overhead** | Lower (simple deletion) | Higher (background check) |
| **Flexibility** | Less (all docs same age) | More (selective based on time) |
| **Practical Use** | System logs, event streams | Auth tokens, temporary data |

---

## Change Streams

Change Streams allow applications to listen to real-time data changes in a collection without polling.

### Basic Change Stream

```javascript
// Watch entire collection for changes
const changeStream = db.users.watch();

// Listen for changes
changeStream.on("change", change => {
  console.log("Change detected:", change);
  // {
  //   _id: { resumeToken: "..." },
  //   operationType: "insert" | "update" | "replace" | "delete" | "invalidate",
  //   ns: { db: "mydb", coll: "users" },
  //   documentKey: { _id: ObjectId("...") },
  //   fullDocument: { _id: ObjectId("..."), name: "Alice", ... },  // For insert/replace
  //   updateDescription: { updatedFields: {...}, removedFields: [...] }  // For update
  // }
});

// When another client updates a user:
db.users.updateOne(
  { _id: ObjectId("...") },
  { $set: { status: "active" } }
);

// Change stream prints:
// Change detected: {
//   operationType: "update",
//   documentKey: { _id: ObjectId("...") },
//   updateDescription: { updatedFields: { status: "active" }, removedFields: [] }
// }
```

### Filtered Change Stream

Watch for specific changes only:

```javascript
// Watch changes where operationType is "insert" or "update"
const changeStream = db.orders.watch([
  {
    $match: {
      operationType: { $in: ["insert", "update"] },
      "fullDocument.status": "completed"
    }
  }
]);

changeStream.on("change", change => {
  console.log("Order completed:", change.fullDocument);
});
```

### Change Stream Resume Tokens

Resume a stream from where it left off (after reconnection):

```javascript
// Store resume token
let resumeToken = null;

const changeStream = db.users.watch();

changeStream.on("change", change => {
  console.log("Change:", change);
  resumeToken = change._id;  // Save resume token
});

changeStream.on("error", err => {
  console.log("Stream error:", err);
  
  // Reconnect with resume token
  if (resumeToken) {
    const newStream = db.users.watch([], { resumeAfter: resumeToken });
    console.log("Resumed from", resumeToken);
    // Continue listening from last position
  }
});
```

### Change Streams in Multi-Document Transactions

```javascript
// Change stream sees all changes from a transaction together

const changeStream = db.accounts.watch();

changeStream.on("change", change => {
  // Receives multiple changes as single transaction event
  if (change.txnNumber) {
    console.log("Transaction ID:", change.txnNumber);
    console.log("Changes in this transaction:", change);
  }
});

// In another session:
session = db.getMongo().startSession();
session.startTransaction();

db.accounts.updateOne(
  { _id: "alice" },
  { $inc: { balance: -100 } },
  { session }
);

db.accounts.updateOne(
  { _id: "bob" },
  { $inc: { balance: 100 } },
  { session }
);

session.commitTransaction();

// Change stream receives both updates with same txnNumber
```

### Practical Change Stream Examples

#### Real-Time Notifications

```javascript
// Send notification whenever order status changes
const changeStream = db.orders.watch([
  {
    $match: {
      operationType: "update",
      "updateDescription.updatedFields.status": { $exists: true }
    }
  }
]);

changeStream.on("change", change => {
  const orderId = change.documentKey._id;
  const newStatus = change.updateDescription.updatedFields.status;
  const userId = change.fullDocument.userId;
  
  // Send notification
  notify.send(userId, `Your order ${orderId} is now ${newStatus}`);
});
```

#### Cache Invalidation

```javascript
// Invalidate cache whenever product changes
const changeStream = db.products.watch();

changeStream.on("change", change => {
  const productId = change.documentKey._id;
  
  // Remove from cache
  cache.delete(`product:${productId}`);
  
  // Publish to message queue for other services
  messageQueue.publish("product-changed", { productId });
});
```

#### Activity Feed

```javascript
// Stream user activity in real-time
const changeStream = db.user_activities.watch([
  { $match: { operationType: "insert" } }
]);

changeStream.on("change", change => {
  const activity = change.fullDocument;
  
  // Add to activity feed in real-time
  emitToWebSocket(`user-${activity.userId}:activity`, activity);
});
```

---

## Summary

**TTL Indexes:**
- Automatically delete documents after specified seconds
- Perfect for sessions, temporary data, cache, logs
- Background cleanup runs every 60 seconds
- Simple and requires no application logic

**Capped Collections:**
- Fixed size, automatic FIFO deletion when full
- Good for logs and event streams with predictable size
- Simpler than TTL, but less flexible

**Change Streams:**
- Real-time listening to data changes
- Watch collections or filtered changes
- Resume from saved position using resume tokens
- Perfect for notifications, cache invalidation, activity feeds
- Works with transactions — sees all changes together

**Best Practices:**
- Use TTL for time-based expiration
- Use Change Streams for real-time applications
- Store resume tokens for fault tolerance
- Filter change streams for specific event types
- Combine TTL with other features for complete data lifecycle management
