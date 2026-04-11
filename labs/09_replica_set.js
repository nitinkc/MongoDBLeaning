// Lab 09: Replica Set — Read Preferences & Write Concerns
// Topics: rs.status(), read preferences, readConcern, writeConcern, stepdown simulation
// Run: docker exec -it mongo1 mongosh --file /labs/09_replica_set.js

db = db.getSiblingDB("mongo_labs");
print("\n=== Lab 09: Replica Set ===\n");

// ─── Check Replica Set Status ─────────────────────────────────────────────────
print("--- rs.status() summary ---");
let status = rs.status();
print("Replica set name:", status.set);
status.members.forEach(m => {
  print(` - ${m.name} | state: ${m.stateStr} | health: ${m.health} | uptime: ${m.uptime}s`);
});

// ─── Who is the Primary? ──────────────────────────────────────────────────────
let primary = rs.isMaster();  // or rs.hello() in newer drivers
print("\nPrimary host:", primary.primary);
print("All hosts:", primary.hosts);
print("Is this node primary?", primary.ismaster);

// ─── Write Concerns ───────────────────────────────────────────────────────────
// writeConcern controls how many nodes must acknowledge a write before returning.
//
// w:1 (default) → acknowledged by primary only (fastest, least durable)
// w:"majority"  → acknowledged by majority of voting members (recommended for important data)
// w:0           → fire-and-forget (no acknowledgement — fastest but risky)
// j:true        → write must be written to the on-disk journal before ack

print("\n--- Write with w:majority (recommended for important writes) ---");
let writeResult = db.orders.insertOne(
  {
    userId: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),
    userName: "Alice Johnson",
    status: "pending",
    items: [{ name: "Test Product", qty: 1, price: 9.99 }],
    total: 9.99,
    orderedAt: new Date()
  },
  { writeConcern: { w: "majority", j: true } }  // durable on majority + journaled
);
print("Inserted with w:majority — _id:", writeResult.insertedId);

// w:1 is faster but risks data loss if primary fails before replication
db.events.insertOne(
  { type: "TEST_EVENT", ts: new Date() },
  { writeConcern: { w: 1 } }
);
print("Inserted with w:1 (primary-only ack — faster, less durable)");

// ─── Read Preferences ─────────────────────────────────────────────────────────
// Controls which replica set member reads are routed to.
//
// primary         → always read from primary (strong consistency, default)
// primaryPreferred → primary if available, else secondary
// secondary        → always read from a secondary (may be slightly stale)
// secondaryPreferred → secondary if available, else primary (read scaling)
// nearest          → lowest network latency (regardless of role)

print("\n--- Read preferences (using connection-level setting) ---");

// primaryPreferred: useful when primary is temporarily unavailable
let conn = db.getMongo();

// Read from secondary for analytics (eventual consistency acceptable)
// In mongosh, set readPreference on the connection or per-query
conn.setReadPref("secondaryPreferred");
let analyticsResult = db.orders.find({ status: "delivered" }).toArray();
print("Read with secondaryPreferred — delivered orders:", analyticsResult.length);

// Switch back to primary for transactional reads
conn.setReadPref("primary");
print("Switched back to primary read preference");

// ─── Read Concerns ────────────────────────────────────────────────────────────
// Controls the consistency of data read from the replica set.
//
// "local"        → return data from the local node (default; may include uncommitted writes)
// "available"    → like local but for sharded clusters (may return orphaned docs)
// "majority"     → return only data acknowledged by majority (no rollback risk)
// "linearizable" → strongest — ensures read reflects all prior majority-acknowledged writes
// "snapshot"     → consistent point-in-time snapshot (used in transactions)

print("\n--- Read with readConcern majority (no rollback risk) ---");
// readConcern must be set via aggregate or find with explicit cursor options
let majorityRead = db.orders.aggregate(
  [{ $match: { status: "delivered" } }],
  { readConcern: { level: "majority" } }
).toArray();
print("Delivered orders (readConcern majority):", majorityRead.length);

// ─── Replica Set Configuration ────────────────────────────────────────────────
print("\n--- Replica set configuration ---");
let config = rs.conf();
print("Config version:", config.version);
config.members.forEach(m => {
  print(` - member ${m._id}: ${m.host} | priority: ${m.priority} | votes: ${m.votes}`);
});

// ─── Check Replication Lag ────────────────────────────────────────────────────
// Replication lag = how far behind a secondary is from the primary
// High lag → stale reads from secondaries, slow failover recovery
print("\n--- Replication lag check ---");
let rsStatus2 = rs.status();
rsStatus2.members
  .filter(m => m.stateStr === "SECONDARY")
  .forEach(m => {
    let lagSecs = m.optimeDate ? Math.abs((new Date() - m.optimeDate) / 1000) : "N/A";
    print(` - ${m.name} lag: ~${typeof lagSecs === 'number' ? lagSecs.toFixed(1) : lagSecs}s`);
  });

// ─── Stepdown (Simulate Failover) ────────────────────────────────────────────
// In production, you would test failover by stepping down the primary.
// This forces an election and a new primary is chosen within seconds.
//
// WARNING: Only run this in a test environment — it causes a brief write outage.
print("\n--- Stepdown / Failover (informational — not executed automatically) ---");
print("To simulate failover, run on the primary:");
print("  rs.stepDown(30)   // step down for 30 seconds, triggers new election");
print("Then check: rs.status() to see which member became the new primary");
print("Clients with retryableWrites:true will auto-retry and connect to new primary");

print("\n=== Lab 09 Complete ===");
print("Key takeaways:");
print("  - Replica set has ONE primary (writes) and 1+ secondaries (replicas)");
print("  - writeConcern w:majority ensures data survives primary failure");
print("  - Read preferences route reads to primary or secondaries based on your consistency needs");
print("  - readConcern majority prevents reading data that could be rolled back");
print("  - Monitor replication lag — high lag means secondaries are stale");
print("  - Retryable writes (retryWrites:true in URI) handle transient failures transparently");

