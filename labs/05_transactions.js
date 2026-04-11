// Lab 05: Transactions — Multi-Document ACID
// Topics: startSession, startTransaction, commit, abort, retry logic, writeConcern majority
// Run: docker exec -it mongo1 mongosh --file /labs/05_transactions.js
// Note: Requires a replica set (rs0) — single standalone mongod does NOT support transactions.

db = db.getSiblingDB("mongo_labs");
print("\n=== Lab 05: Transactions ===\n");

// ─── Why Transactions? ───────────────────────────────────────────────────────
// MongoDB supports multi-document ACID transactions since v4.0 (replica set)
// and v4.2 (sharded clusters).
// Use for operations that MUST succeed or fail together:
//   - Transfer money between accounts
//   - Decrement stock + create order atomically
//   - Update multiple collections where partial failure is unacceptable

// ─── Setup: accounts collection for transfer demo ─────────────────────────────
db.accounts.drop();
db.accounts.insertMany([
  { _id: "acct-alice", owner: "Alice", balance: 1000.00 },
  { _id: "acct-bob",   owner: "Bob",   balance:  200.00 }
]);
print("Accounts created: Alice=$1000, Bob=$200");

// ─── Basic Transaction: Fund Transfer ────────────────────────────────────────
// Both updates must succeed or neither should apply.
const session = db.getMongo().startSession();
print("\nStarted session:", session.id.id);

try {
  session.startTransaction({
    readConcern:  { level: "snapshot" },  // reads consistent point-in-time snapshot
    writeConcern: { w: "majority" }        // wait for majority of replicas to acknowledge
  });

  const accounts = session.getDatabase("mongo_labs").accounts;

  const TRANSFER_AMOUNT = 150.00;

  // Step 1: Debit Alice
  const aliceResult = accounts.updateOne(
    { _id: "acct-alice", balance: { $gte: TRANSFER_AMOUNT } }, // check sufficient funds
    { $inc: { balance: -TRANSFER_AMOUNT } }
  );

  if (aliceResult.modifiedCount === 0) {
    throw new Error("Insufficient funds or account not found");
  }

  // Step 2: Credit Bob
  accounts.updateOne(
    { _id: "acct-bob" },
    { $inc: { balance: TRANSFER_AMOUNT } }
  );

  // Step 3: Record the transfer
  session.getDatabase("mongo_labs").transfers.insertOne({
    from: "acct-alice",
    to:   "acct-bob",
    amount: TRANSFER_AMOUNT,
    ts: new Date()
  });

  // Commit — makes all changes durable and visible
  session.commitTransaction();
  print(`Transfer of $${TRANSFER_AMOUNT} committed successfully`);

} catch (err) {
  // Abort — rolls back ALL changes in the transaction
  session.abortTransaction();
  print("Transaction aborted:", err.message);
} finally {
  session.endSession();
}

// Verify balances after transaction
let alice = db.accounts.findOne({ _id: "acct-alice" });
let bob   = db.accounts.findOne({ _id: "acct-bob" });
print(`\nAfter transfer: Alice=$${alice.balance}, Bob=$${bob.balance}`);

// ─── Abort Demo: Intentional Failure ─────────────────────────────────────────
print("\n--- Abort demo: transfer more than balance ---");
const session2 = db.getMongo().startSession();
try {
  session2.startTransaction({ writeConcern: { w: "majority" } });
  const accounts2 = session2.getDatabase("mongo_labs").accounts;

  // Try to debit $5000 from Alice (only has $850)
  const result = accounts2.updateOne(
    { _id: "acct-alice", balance: { $gte: 5000 } }, // fails — not enough
    { $inc: { balance: -5000 } }
  );

  if (result.modifiedCount === 0) {
    throw new Error("Insufficient funds — aborting transaction");
  }

  accounts2.updateOne({ _id: "acct-bob" }, { $inc: { balance: 5000 } });
  session2.commitTransaction();

} catch (err) {
  session2.abortTransaction();
  print("Aborted:", err.message);
} finally {
  session2.endSession();
}

// Balances should be unchanged after abort
alice = db.accounts.findOne({ _id: "acct-alice" });
bob   = db.accounts.findOne({ _id: "acct-bob" });
print(`After abort: Alice=$${alice.balance}, Bob=$${bob.balance} (unchanged)`);

// ─── Retry Pattern for Transient Errors ──────────────────────────────────────
// MongoDB recommends retrying transactions on transient errors
// (e.g., WriteConflict, TransientTransactionError).
print("\n--- Retry pattern (production-grade) ---");

function runTransactionWithRetry(txnFunc, session) {
  while (true) {
    try {
      txnFunc(session);
      break; // success
    } catch (err) {
      if (err.hasErrorLabel("TransientTransactionError")) {
        print("TransientTransactionError — retrying...");
        continue;
      }
      throw err; // non-transient error — rethrow
    }
  }
}

function commitWithRetry(session) {
  while (true) {
    try {
      session.commitTransaction();
      print("Transaction committed");
      break;
    } catch (err) {
      if (err.hasErrorLabel("UnknownTransactionCommitResult")) {
        print("UnknownTransactionCommitResult — retrying commit...");
        continue;
      }
      throw err;
    }
  }
}

const session3 = db.getMongo().startSession();
try {
  runTransactionWithRetry((s) => {
    s.startTransaction({ writeConcern: { w: "majority" } });
    const accts = s.getDatabase("mongo_labs").accounts;
    accts.updateOne({ _id: "acct-alice" }, { $inc: { balance: 25 } });
    accts.updateOne({ _id: "acct-bob"   }, { $inc: { balance: -25 } });
    commitWithRetry(s);
  }, session3);
} catch (err) {
  session3.abortTransaction();
  print("Final failure:", err.message);
} finally {
  session3.endSession();
}

alice = db.accounts.findOne({ _id: "acct-alice" });
bob   = db.accounts.findOne({ _id: "acct-bob" });
print(`Final balances: Alice=$${alice.balance}, Bob=$${bob.balance}`);

print("\n=== Lab 05 Complete ===");
print("Key takeaways:");
print("  - Transactions require a replica set (or sharded cluster)");
print("  - readConcern 'snapshot' gives a consistent view across the transaction");
print("  - writeConcern 'majority' ensures durability across replicas");
print("  - Always abort in the catch block and end the session in finally");
print("  - Use retry logic for TransientTransactionError and UnknownTransactionCommitResult");
print("  - Transactions have overhead (~3-5x) — use only when atomicity is truly required");

