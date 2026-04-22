# Transactions & Consistency

This module covers ACID transactions in MongoDB, consistency models, and how to ensure data integrity across distributed systems.

## ACID Properties

ACID is the foundation of data reliability. MongoDB supports full ACID transactions (with conditions).

### Atomicity

A transaction either completes fully or not at all — no partial updates.

```javascript
// Without transaction: if error occurs mid-way, partial update persists
db.accounts.updateOne({ _id: "alice" }, { $inc: { balance: -100 } });
db.accounts.updateOne({ _id: "bob" }, { $inc: { balance: 100 } });
// If 2nd update fails, Alice lost $100 but Bob didn't gain it — inconsistent

// With transaction: all-or-nothing
session = db.getMongo().startSession();
session.startTransaction();
try {
  db.accounts.updateOne({ _id: "alice" }, { $inc: { balance: -100 } }, { session });
  db.accounts.updateOne({ _id: "bob" }, { $inc: { balance: 100 } }, { session });
  session.commitTransaction();
} catch (e) {
  session.abortTransaction();
  print("Transaction rolled back:", e);
}
```

### Consistency

All reads and writes obey constraints and rules. MongoDB supports multiple consistency levels.

```javascript
// Write Concern: How many replicas must ACK before returning
// Journal Concern: Must write be persisted to disk

db.collection.insertOne(
  { data: "..." },
  { writeConcern: { w: 1 } }  // Return after primary ACKs (fast, less safe)
);

db.collection.insertOne(
  { data: "..." },
  { writeConcern: { w: "majority" } }  // Return after majority of replicas ACK
);

db.collection.insertOne(
  { data: "..." },
  { writeConcern: { w: "majority", j: true } }  // Majority + journaled (safest)
);
```

### Isolation

Concurrent transactions don't interfere — changes are invisible until committed.

```javascript
// Session 1 (Isolation)
db = db.getSiblingDB("bank");
session1 = db.getMongo().startSession();
session1.startTransaction();

let balanceBefore = db.accounts.findOne({ _id: "alice" }, { session: session1 });
print("Balance before transfer:", balanceBefore.balance);  // 1000

// Session 2 (Concurrent, starts transaction)
session2 = db.getMongo().startSession();
session2.startTransaction();

// Session 2 can't see Session 1's changes until Session 1 commits
db.accounts.updateOne(
  { _id: "alice" },
  { $inc: { balance: -100 } },
  { session: session2 }
);

// Back to Session 1: still sees original balance (isolation)
session1.commitTransaction();

// Session 2: Now sees committed change
let balanceAfter = db.accounts.findOne({ _id: "alice" }, { session: session2 });
print("Balance after session 1 committed:", balanceAfter.balance);  // 900
```

### Durability

Committed data persists even if server crashes.

```javascript
// Data written with journal enabled is durable
db.collection.insertOne(
  { data: "..." },
  { writeConcern: { w: "majority", j: true } }
);
// Written to journal on disk — survives power loss
```

---

## Multi-Document Transactions

MongoDB transactions can span multiple documents and collections (with conditions).

### Single Document (Always Atomic)

```javascript
// Even without explicit transaction, single document update is atomic
db.users.updateOne(
  { _id: ObjectId("...") },
  {
    $set: { name: "Alice" },
    $inc: { loginCount: 1 },
    $push: { lastLogin: new Date() }
  }
);
// All operations apply together — never partial update on a single document
```

### Multi-Document Transaction (Replica Set Required)

```javascript
const session = db.getMongo().startSession();
session.startTransaction();

try {
  // Remove funds from Alice
  const alice = db.accounts.findOne({ _id: "alice" }, { session });
  if (alice.balance < 100) {
    throw new Error("Insufficient balance");
  }
  
  db.accounts.updateOne(
    { _id: "alice" },
    { $inc: { balance: -100 } },
    { session }
  );
  
  // Add funds to Bob
  db.accounts.updateOne(
    { _id: "bob" },
    { $inc: { balance: 100 } },
    { session }
  );
  
  // Log transaction
  db.transactions_log.insertOne(
    { from: "alice", to: "bob", amount: 100, timestamp: new Date() },
    { session }
  );
  
  // All succeed or all rollback
  session.commitTransaction();
  print("Transfer completed");
  
} catch (error) {
  session.abortTransaction();
  print("Transfer failed and rolled back:", error);
  
} finally {
  session.endSession();
}
```

### Transaction Guarantees

```javascript
// Level 1: Snapshot Isolation (Default)
// - Your reads see committed data as of transaction start
// - Other transactions' writes are invisible until committed
// - No dirty reads, no lost updates

// Level 2: Serializable (if needed)
// readConcern: "local" (default)
// readConcern: "majority" (reads majority-committed data only)
// readConcern: "snapshot" (serializable isolation)

session.startTransaction({
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority", j: true },
  readPreference: "primary"
});
```

---

## Consistency Models & Read Concerns

MongoDB offers multiple consistency models for different use cases.

### Read Concern Levels

```javascript
// 1. LOCAL (Default)
// Read uncommitted or committed data from primary
// FAST, but might see data that gets rolled back (if primary crashes)
db.collection.find({}).readConcern("local");

// 2. AVAILABLE
// Reads any data (including from secondaries before majority confirmation)
// Used in sharded clusters, with eventual consistency
db.collection.find({}).readConcern("available");

// 3. MAJORITY
// Read only data written to majority of replicas (confirmed durable)
// Slightly slower, but ensures data is truly committed
db.collection.find({}).readConcern("majority");

// 4. LINEARIZABLE
// Strongest consistency: read most recent write + include all writes before your read
// Serialized reads/writes for this document
// SLOWEST but most consistent (for critical operations)
db.collection.find({ _id: "critical" }).readConcern("linearizable");

// 5. SNAPSHOT
// Read all data as of a specific snapshot (in transactions)
session.startTransaction({
  readConcern: { level: "snapshot" }
});
```

### Write Concern Levels

```javascript
// Write concern: How many replicas must ACK before returning success

// w: 0 (Fire and Forget)
// Return immediately, no confirmation — UNSAFE
// db.collection.insertOne({}, { writeConcern: { w: 0 } });

// w: 1 (Primary Only)
// Return after primary writes to memory — FAST, but risky if primary crashes
db.collection.insertOne({}, { writeConcern: { w: 1 } });

// w: 2 (Primary + 1 Secondary)
// Return after primary and 1 secondary ACK — balanced
db.collection.insertOne({}, { writeConcern: { w: 2 } });

// w: "majority"
// Return after majority of replicas ACK — SAFE
// Even if primary crashes, majority commit persists
db.collection.insertOne({}, { writeConcern: { w: "majority" } });

// j: true (Journaled)
// Combine with any write concern to require disk journal write
db.collection.insertOne({}, { writeConcern: { w: "majority", j: true } });
//SAFEST: data written to disk on majority of nodes

// Examples:
// - Social media likes: w: 1 (speed > safety)
// - Bank transfers: w: "majority", j: true (safety > speed)
// - Logs: w: 0 (speed critical, loss acceptable)
// - Financial records: w: "majority" (strong consistency)
```

---

## Handling Transactions in Code

### Transaction Retry Logic

```javascript
function transferMoney(fromId, toId, amount) {
  let maxRetries = 5;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = db.getMongo().startSession();
    session.startTransaction({
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary"
    });
    
    try {
      db.accounts.updateOne(
        { _id: fromId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { session }
      );
      
      if (db.getLastErrorObj().modifiedCount === 0) {
        throw new Error("Insufficient balance");
      }
      
      db.accounts.updateOne(
        { _id: toId },
        { $inc: { balance: amount } },
        { session }
      );
      
      session.commitTransaction();
      return { success: true };
      
    } catch (error) {
      session.abortTransaction();
      
      if (error.message.includes("TransientTransactionError") && attempt < maxRetries) {
        print("Transient error, retrying...");
        continue;  // Retry
      }
      
      print("Transaction failed after", attempt, "attempts:", error);
      return { success: false, error: error.message };
      
    } finally {
      session.endSession();
    }
  }
}

let result = transferMoney("alice", "bob", 100);
print(result);
```

### Idempotent Operations

Design transactions to be safely retryable — if you retry the same transaction, the result is identical.

```javascript
// IDEMPOTENT: Safe to retry
db.orders.insertOne(
  {
    _id: "order-12345",  // Fixed ID ensures idempotence
    customerId: "alice",
    amount: 100,
    status: "pending",
    createdAt: new Date()
  },
  { session }
);
// If this inserts twice, 2nd insert fails with duplicate key — idempotent result

// NON-IDEMPOTENT: Dangerous to retry
db.accounts.updateOne(
  { _id: "alice" },
  { $inc: { balance: 100 } },
  { session }
);
// If you retry, you increment twice — $200 instead of $100!

// FIX: Use $set with conditional field
db.accounts.updateOne(
  {
    _id: "alice",
    "transfers.txnId": { $ne: "txn-67890" }  // Ensure not already applied
  },
  {
    $inc: { balance: 100 },
    $push: { transfers: { txnId: "txn-67890", amount: 100 } }
  },
  { session }
);
```

---

## Summary

**ACID Transactions:**

- **Atomicity:** All-or-nothing — no partial updates
- **Consistency:** Rules and constraints enforced
- **Isolation:** Concurrent transactions don't interfere
- **Durability:** Committed data persists through crashes

**when to use transactions:**

- Multi-document updates that must succeed together
- Financial operations (transfers, payments)
- Inventory management (deduct stock + create order in one transaction)
- Complex workflows needing rollback capability

**Read/Write Concern:**

- Read: local (fast), majority (safe), linearizable (strictest)
- Write: w: 1 (fast), w: "majority" (safe), j: true (durable)
- Choose based on your consistency vs. performance needs

**Best Practices:**

- Keep transactions short (reduces lock contention)
- Use sessions properly — always endSession()
- Implement retry logic for transient errors
- Design operations to be idempotent where possible
