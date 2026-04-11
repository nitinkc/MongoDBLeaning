// Lab 01: Database Basics
// Topics: use, createCollection, CRUD (insertOne/Many, findOne, find, updateOne, replaceOne, deleteOne)
// Run: docker exec -it mongo1 mongosh --file /labs/01_database_basics.js

// ─── Switch to working database ──────────────────────────────────────────────
// MongoDB creates the DB lazily (on first write). 'use' just sets the context.
db = db.getSiblingDB("mongo_labs");
print("\n=== Lab 01: Database Basics ===\n");

// ─── CREATE ──────────────────────────────────────────────────────────────────

// insertOne: insert a single document
// _id is auto-generated as ObjectId if not provided
let result = db.products.insertOne({
  name: "USB Hub",
  category: "peripherals",
  price: 29.99,
  stock: 80,
  createdAt: new Date()
});
print("Inserted product _id:", result.insertedId);

// insertMany: insert multiple documents in one round trip (faster than multiple insertOne)
let bulkResult = db.products.insertMany([
  { name: "Webcam HD", category: "peripherals", price: 59.99, stock: 60 },
  { name: "Standing Desk", category: "furniture", price: 499.00, stock: 20 }
]);
print("Bulk inserted IDs:", bulkResult.insertedIds);

// ─── READ ─────────────────────────────────────────────────────────────────────

// findOne: returns first matching document (or null)
let keyboard = db.products.findOne({ name: "Mechanical Keyboard" });
print("\nfindOne (Mechanical Keyboard):", JSON.stringify(keyboard));

// find: returns a cursor — iterate with .toArray() or .forEach()
print("\nAll peripherals (category = 'peripherals'):");
db.products.find({ category: "peripherals" }).forEach(doc => print(" -", doc.name, "$" + doc.price));

// Projection: include only specified fields (1 = include, 0 = exclude)
// Note: _id is included by default unless explicitly excluded
print("\nProducts with projection (name + price only, no _id):");
db.products.find({}, { _id: 0, name: 1, price: 1 }).forEach(doc => print(" -", JSON.stringify(doc)));

// Comparison operators: $gt, $gte, $lt, $lte, $ne, $in, $nin
print("\nProducts priced between $25 and $100:");
db.products.find({ price: { $gte: 25, $lte: 100 } }, { name: 1, price: 1, _id: 0 })
  .forEach(doc => print(" -", doc.name, "$" + doc.price));

// Logical operators: $and, $or, $not, $nor
print("\nPeripherals OR price > 400:");
db.products.find({ $or: [{ category: "peripherals" }, { price: { $gt: 400 } }] }, { name: 1, _id: 0 })
  .forEach(doc => print(" -", doc.name));

// Sort, limit, skip
print("\nTop 3 most expensive products:");
db.products.find({}, { name: 1, price: 1, _id: 0 })
  .sort({ price: -1 })   // -1 = descending
  .limit(3)
  .forEach(doc => print(" -", doc.name, "$" + doc.price));

// Count documents
let peripheralCount = db.products.countDocuments({ category: "peripherals" });
print("\nTotal peripherals:", peripheralCount);

// ─── UPDATE ───────────────────────────────────────────────────────────────────

// updateOne: update first matching document
// $set modifies only the specified fields (does NOT replace the whole document)
let upd = db.products.updateOne(
  { name: "USB Hub" },
  { $set: { price: 24.99, onSale: true } }
);
print("\nupdateOne matched:", upd.matchedCount, "modified:", upd.modifiedCount);

// $inc: atomically increment a numeric field
db.products.updateOne({ name: "USB Hub" }, { $inc: { stock: -5 } });
print("Decremented stock by 5 for USB Hub");

// $unset: remove a field
db.products.updateOne({ name: "USB Hub" }, { $unset: { onSale: "" } });
print("Removed onSale field from USB Hub");

// $push: add element to an array field
// $addToSet: add only if not already present (deduplicates)
db.users.updateOne(
  { email: "alice@example.com" },
  { $addToSet: { tags: "newsletter" } }
);
print("Added 'newsletter' tag to Alice (addToSet — deduplicates)");

// updateMany: update ALL matching documents
let manyUpd = db.products.updateMany(
  { category: "peripherals" },
  { $set: { updatedAt: new Date() } }
);
print("updateMany: updated", manyUpd.modifiedCount, "peripheral(s)");

// upsert: insert if not found, update if found (useful for idempotent writes)
db.products.updateOne(
  { name: "Bluetooth Speaker" },
  { $set: { name: "Bluetooth Speaker", category: "audio", price: 79.99, stock: 30 } },
  { upsert: true }
);
print("Upserted Bluetooth Speaker");

// replaceOne: replace the ENTIRE document (except _id)
db.products.replaceOne(
  { name: "Webcam HD" },
  { name: "Webcam 4K Pro", category: "peripherals", price: 89.99, stock: 40, createdAt: new Date() }
);
print("Replaced Webcam HD with Webcam 4K Pro");

// ─── DELETE ───────────────────────────────────────────────────────────────────

// deleteOne: delete first matching document
let del = db.products.deleteOne({ name: "Bluetooth Speaker" });
print("\ndeleteOne deleted:", del.deletedCount);

// deleteMany: delete all matching documents
let delMany = db.products.deleteMany({ category: "furniture" });
print("deleteMany (furniture) deleted:", delMany.deletedCount);

// ─── BULK WRITES ─────────────────────────────────────────────────────────────
// bulkWrite: batch multiple operations in one round trip (ordered or unordered)
// ordered:false continues on error; ordered:true (default) stops on first error
db.products.bulkWrite([
  { insertOne: { document: { name: "Laptop Stand", category: "accessories", price: 35.99, stock: 100 } } },
  { updateOne: { filter: { name: "USB Hub" }, update: { $set: { price: 22.99 } } } },
  { deleteOne: { filter: { name: "Standing Desk" } } }
], { ordered: false });
print("\nbulkWrite completed (3 ops: insert, update, delete)");

// ─── Summary ──────────────────────────────────────────────────────────────────
print("\n=== Lab 01 Complete ===");
print("Key takeaways:");
print("  - Documents are flexible JSON-like objects stored in collections");
print("  - _id is automatically generated as ObjectId if not provided");
print("  - $set/$inc/$push update specific fields without replacing the document");
print("  - Projections control which fields are returned (reduce network payload)");
print("  - bulkWrite reduces round-trips for multiple operations");

