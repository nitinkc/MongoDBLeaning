// Lab 06: TTL Indexes & Capped Collections
// Topics: expireAfterSeconds, capped collections, tailable cursors, change stream basics
// Run: docker exec -it mongo1 mongosh --file /labs/06_ttl_and_capped.js

db = db.getSiblingDB("mongo_labs");
print("\n=== Lab 06: TTL Indexes & Capped Collections ===\n");

// ─── TTL (Time-To-Live) Index ────────────────────────────────────────────────
// Automatically deletes documents after a specified number of seconds.
// The TTL background thread runs approximately every 60 seconds.
// The indexed field MUST be a BSON Date (or array of Dates).
// Only ONE field per TTL index; compound TTL indexes are NOT supported.

db.sessions.drop();
db.sessions.createCollection("sessions");

// Create TTL index: documents expire 30 seconds after 'createdAt'
db.sessions.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 30, name: "idx_sessions_ttl_30s" }
);
print("Created sessions collection with TTL = 30 seconds");

// Insert session documents
db.sessions.insertMany([
  { sessionId: "sess-001", userId: "alice", data: { page: "/home"    }, createdAt: new Date() },
  { sessionId: "sess-002", userId: "bob",   data: { page: "/catalog" }, createdAt: new Date() },
  // This session was created in the "past" — will be deleted almost immediately
  { sessionId: "sess-old", userId: "charlie", data: {}, createdAt: new Date(Date.now() - 120_000) }
]);
print("Inserted 3 sessions (sess-old was created 2 minutes ago — will be purged soon)");
print("Current session count:", db.sessions.countDocuments());
print("Note: TTL thread runs every ~60s — run 'db.sessions.countDocuments()' after a minute");

// ─── Modify TTL expiry with collMod ──────────────────────────────────────────
// Change expireAfterSeconds on an existing TTL index without dropping it
db.runCommand({
  collMod: "sessions",
  index: {
    name: "idx_sessions_ttl_30s",
    expireAfterSeconds: 3600   // extend to 1 hour
  }
});
print("\nModified TTL to 3600 seconds (1 hour) using collMod");

// ─── Token / OTP expiry pattern ───────────────────────────────────────────────
// Use 'expiresAt' field set to a specific future time (expireAfterSeconds: 0)
db.tokens.drop();
db.tokens.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "idx_tokens_expire_at" }
);
db.tokens.insertMany([
  {
    token: "reset-abc-123",
    userId: "alice",
    type: "password_reset",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000) // expires in 15 minutes
  },
  {
    token: "otp-xyz-456",
    userId: "bob",
    type: "otp",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)  // expires in 5 minutes
  }
]);
print("\nInserted tokens with individual expiresAt timestamps (expireAfterSeconds:0 pattern)");

// ─── Capped Collections ───────────────────────────────────────────────────────
// Fixed-size collections that automatically overwrite the oldest documents
// when the size limit is reached. Insertion order is preserved.
// Use cases: rolling logs, activity feeds, recent N events.
// Limitations: no delete, no update that changes document size, no sharding.

db.activity_log.drop();
db.createCollection("activity_log", {
  capped: true,
  size: 10240,   // max size in bytes (10 KB)
  max: 10        // optional: max number of documents
});
print("\nCreated capped collection 'activity_log' (max 10 docs, 10 KB)");

// Insert log entries
for (let i = 1; i <= 15; i++) {
  db.activity_log.insertOne({
    seq: i,
    action: `event-${i}`,
    ts: new Date()
  });
}
// Only the last 10 documents are retained (oldest 5 were overwritten)
let logCount = db.activity_log.countDocuments();
print(`After inserting 15 events, capped collection has: ${logCount} documents`);

// Read — documents are returned in insertion order
print("Latest events in capped log:");
db.activity_log.find({}, { _id: 0, seq: 1, action: 1 }).forEach(d => print(" -", d.seq, d.action));

// ─── Verify capped collection metadata ───────────────────────────────────────
let stats = db.runCommand({ collStats: "activity_log" });
print("\nCapped:", stats.capped, "| Max docs:", stats.max, "| Size cap (bytes):", stats.maxSize);

// ─── Change Streams — Basics ──────────────────────────────────────────────────
// Change streams allow applications to subscribe to real-time change notifications.
// Available on: collections, databases, or entire deployment.
// Requires: replica set or sharded cluster.
// Use cases: real-time dashboards, event-driven microservices, cache invalidation.

print("\n--- Change Streams (concept demo — open in a separate shell to see live events) ---");
print("To watch changes on the orders collection, open mongosh and run:");
print("  db = db.getSiblingDB('mongo_labs')");
print("  const changeStream = db.orders.watch()");
print("  while (changeStream.hasNext()) { printjson(changeStream.next()) }");
print("");
print("Then in another shell insert/update a document — the change stream will emit events.");

// Change stream filter: only watch for insert and update operations
print("Filtered watch example (inserts + updates only):");
print("  db.orders.watch([{ \\$match: { operationType: { \\$in: ['insert','update'] } } }])");

// Resume token: change streams are resumable
print("\nResume tokens allow resuming from last processed event after a disconnect.");
print("Store the '_id' field from each change event as your resume token.");

print("\n=== Lab 06 Complete ===");
print("Key takeaways:");
print("  - TTL index auto-deletes documents after expireAfterSeconds (background thread ~60s)");
print("  - Use expiresAt field + expireAfterSeconds:0 for per-document expiry times");
print("  - Use collMod to adjust TTL without dropping and recreating the index");
print("  - Capped collections are fixed-size ring buffers — oldest docs auto-overwritten");
print("  - Change streams provide real-time, resumable event notifications on data changes");

