// Lab 11: Monitoring & Performance
// Topics: explain(), serverStatus, currentOp, profiler, $indexStats, collStats
// Run: docker exec -it mongo1 mongosh --file /labs/11_monitoring_and_performance.js

db = db.getSiblingDB("mongo_labs");
print("\n=== Lab 11: Monitoring & Performance ===\n");

// ─── explain() — Understand Query Execution ───────────────────────────────────
// Always use explain() when queries are slow or you're not sure an index is used.
// Three verbosity levels:
//   "queryPlanner"    → plan selection only (fast, no execution)
//   "executionStats"  → runs query, shows index usage and docs examined
//   "allPlansExecution" → compares ALL candidate plans

print("--- explain('executionStats'): orders by userId ---");
let plan = db.orders.find(
  { userId: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa") }
).explain("executionStats");

let exec = plan.executionStats;
print("Stage:", plan.queryPlanner.winningPlan.stage);
print("Docs examined:", exec.totalDocsExamined);
print("Docs returned:", exec.totalDocsReturned);
print("Execution time (ms):", exec.executionTimeMillis);
// IXSCAN = good (index used), COLLSCAN = full scan (bad for large collections)

// ─── $indexStats — Index Usage Statistics ────────────────────────────────────
// Shows how many times each index has been used since the server started.
// Use to identify unused indexes (consume write overhead but never read).
print("\n--- $indexStats: usage stats for orders collection ---");
db.orders.aggregate([{ $indexStats: {} }]).forEach(stat => {
  print(` - ${stat.name}: accesses=${stat.accesses.ops}, since=${stat.accesses.since}`);
});

// ─── collStats — Collection Statistics ───────────────────────────────────────
print("\n--- Collection stats for orders ---");
let stats = db.runCommand({ collStats: "orders" });
print("Document count:", stats.count);
print("Storage size (bytes):", stats.storageSize);
print("Total index size (bytes):", stats.totalIndexSize);
print("Avg doc size (bytes):", Math.round(stats.avgObjSize || 0));
print("Indexes:", Object.keys(stats.indexSizes || {}).length);

// ─── dbStats — Database-Level Statistics ──────────────────────────────────────
print("\n--- DB stats for mongo_labs ---");
let dbStats = db.stats();
print("Collections:", dbStats.collections);
print("DB data size (bytes):", dbStats.dataSize);
print("DB storage size (bytes):", dbStats.storageSize);
print("Objects:", dbStats.objects);

// ─── serverStatus — Server-Wide Metrics ───────────────────────────────────────
print("\n--- serverStatus (key metrics) ---");
let svr = db.getMongo().getDB("admin").runCommand({ serverStatus: 1 });

// Connections
print("Connections current:", svr.connections.current);
print("Connections available:", svr.connections.available);

// Opcounters (since server start)
print("Opcounters — insert:", svr.opcounters.insert,
  "| query:", svr.opcounters.query,
  "| update:", svr.opcounters.update,
  "| delete:", svr.opcounters.delete);

// Memory
print("WiredTiger cache size (MB):", Math.round(svr.wiredTiger?.cache?.["maximum bytes configured"] / 1024 / 1024 || 0));
print("WiredTiger cache used (MB):", Math.round(svr.wiredTiger?.cache?.["bytes currently in the cache"] / 1024 / 1024 || 0));

// Replication lag (via replSetGetStatus)
let rsStatus = db.getMongo().getDB("admin").runCommand({ replSetGetStatus: 1 });
if (rsStatus.ok) {
  rsStatus.members.filter(m => m.stateStr !== "PRIMARY").forEach(m => {
    let lagMs = m.optimeDate ? Math.abs(new Date() - m.optimeDate) : "N/A";
    print(`Secondary ${m.name} replication lag: ~${typeof lagMs === 'number' ? (lagMs/1000).toFixed(1) : lagMs}s`);
  });
}

// ─── currentOp — Running Operations ──────────────────────────────────────────
// Shows operations currently executing on the server.
// Essential for diagnosing slow queries, locks, and long-running aggregations.
print("\n--- currentOp: long-running operations (> 1 second) ---");
let ops = db.getMongo().getDB("admin").currentOp({
  active: true,
  secs_running: { $gt: 1 }
});
if (ops.inprog.length === 0) {
  print("No long-running operations (good!)");
} else {
  ops.inprog.forEach(op => {
    print(` - opId: ${op.opid}, type: ${op.type}, secs_running: ${op.secs_running}`);
    print(`   ns: ${op.ns}, op: ${op.op}`);
  });
}

// Kill a specific operation (use the opid from currentOp):
// db.getMongo().getDB("admin").killOp(opid);

// ─── Query Profiler ───────────────────────────────────────────────────────────
// Logs slow queries to the system.profile collection.
// Level 0 = off, 1 = slow queries only, 2 = all queries (high overhead)
print("\n--- Setting up slow query profiler (level 1, threshold 100ms) ---");
db.setProfilingLevel(1, { slowms: 100 });
let profilingStatus = db.getProfilingStatus();
print("Profiling level:", profilingStatus.was, "| slowms:", profilingStatus.slowms);

// Run some queries to potentially capture in profiler
db.orders.find({ status: "delivered" }).sort({ orderedAt: -1 }).toArray();
db.products.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]).toArray();

// Read the profiler output
print("\n--- Recent slow queries from system.profile ---");
let profiledOps = db.system.profile.find({}).sort({ ts: -1 }).limit(5).toArray();
if (profiledOps.length === 0) {
  print("No queries exceeded 100ms threshold (all fast — good!)");
} else {
  profiledOps.forEach(op => {
    print(` - ${op.op} on ${op.ns}: ${op.millis}ms | keysExamined: ${op.keysExamined} | docsExamined: ${op.docsExamined}`);
  });
}

// Turn profiler off when not needed (has performance overhead)
db.setProfilingLevel(0);
print("Profiler turned off");

// ─── mongostat & mongotop (command-line tools) ────────────────────────────────
print("\n--- mongostat & mongotop (run from host terminal) ---");
print("Real-time operations per second:");
print("  mongostat --host localhost:27017");
print("");
print("Per-collection read/write time:");
print("  mongotop --host localhost:27017");
print("");
print("Monitor all replica set members:");
print("  mongostat --host 'localhost:27017,localhost:27018,localhost:27019'");

// ─── nodetool equivalent: rs.printReplicationInfo() ──────────────────────────
print("\n--- Replication info ---");
try {
  rs.printReplicationInfo();
} catch(e) {
  print("(Replication info not available on secondary — connect to primary)");
}

// ─── Performance Tips Summary ─────────────────────────────────────────────────
print("\n--- Key performance indicators to monitor ---");
print("  ✓ Connections current vs. available (watch for connection pool exhaustion)");
print("  ✓ Opcounters trend (sudden spike in getmore/command may signal a problem)");
print("  ✓ WiredTiger cache hit ratio (should be > 95%)");
print("  ✓ Replication lag < 1s (high lag = stale reads, slow failover)");
print("  ✓ Index usage via $indexStats (drop unused indexes)");
print("  ✓ Slow queries via profiler (optimize with indexes or schema changes)");
print("  ✓ COLLSCAN in explain() = missing index");

print("\n=== Lab 11 Complete ===");
print("Key takeaways:");
print("  - explain('executionStats') is your #1 tool for diagnosing query performance");
print("  - $indexStats shows which indexes are unused (safe to drop, reduces write overhead)");
print("  - currentOp identifies long-running operations; use killOp() to terminate them");
print("  - Query profiler (level 1, slowms threshold) captures slow queries to system.profile");
print("  - Monitor WiredTiger cache usage — cache < 60% utilized may mean over-provisioned");
print("  - Always turn off the profiler (level 0) in production after debugging");

