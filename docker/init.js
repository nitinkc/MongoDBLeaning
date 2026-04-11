// MongoDB Initialization Script
// Run via: mongosh --host mongo1:27017 /init/init.js
// This bootstraps the mongo_labs database with sample collections and seed data.

// ─── Create / switch to database ────────────────────────────────────────────
db = db.getSiblingDB("mongo_labs");

print("=== Initializing mongo_labs database ===");

// ─── Drop existing collections (idempotent re-run) ──────────────────────────
["users", "orders", "products", "events", "sessions"].forEach(c => {
  db[c].drop();
  print("Dropped collection: " + c);
});

// ─── users ───────────────────────────────────────────────────────────────────
db.createCollection("users");
db.users.insertMany([
  {
    _id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),
    name: "Alice Johnson",
    email: "alice@example.com",
    age: 30,
    address: {
      city: "New York",
      country: "US",
      zip: "10001"
    },
    tags: ["premium", "early-adopter"],
    createdAt: new Date("2024-01-15")
  },
  {
    _id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb"),
    name: "Bob Smith",
    email: "bob@example.com",
    age: 25,
    address: {
      city: "San Francisco",
      country: "US",
      zip: "94102"
    },
    tags: ["standard"],
    createdAt: new Date("2024-02-20")
  },
  {
    _id: ObjectId("cccccccccccccccccccccccc"),
    name: "Carol White",
    email: "carol@example.com",
    age: 35,
    address: {
      city: "London",
      country: "UK",
      zip: "EC1A 1BB"
    },
    tags: ["premium"],
    createdAt: new Date("2024-03-10")
  }
]);
print("Inserted 3 users");

// ─── products ────────────────────────────────────────────────────────────────
db.createCollection("products");
db.products.insertMany([
  {
    _id: ObjectId("111111111111111111111111"),
    name: "Mechanical Keyboard",
    category: "peripherals",
    price: 89.99,
    stock: 150,
    specs: { brand: "DasKeyboard", switches: "Cherry MX Blue", layout: "TKL" },
    createdAt: new Date()
  },
  {
    _id: ObjectId("222222222222222222222222"),
    name: "Curved Monitor",
    category: "displays",
    price: 349.99,
    stock: 45,
    specs: { brand: "LG", size_inches: 34, resolution: "3440x1440" },
    createdAt: new Date()
  },
  {
    _id: ObjectId("333333333333333333333333"),
    name: "Wireless Mouse",
    category: "peripherals",
    price: 49.99,
    stock: 200,
    specs: { brand: "Logitech", dpi: 4000, battery_days: 70 },
    createdAt: new Date()
  }
]);
print("Inserted 3 products");

// ─── orders ──────────────────────────────────────────────────────────────────
db.createCollection("orders");
db.orders.insertMany([
  {
    userId: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),
    userName: "Alice Johnson",
    status: "delivered",
    items: [
      { productId: ObjectId("111111111111111111111111"), name: "Mechanical Keyboard", qty: 1, price: 89.99 }
    ],
    total: 89.99,
    orderedAt: new Date("2024-04-01"),
    deliveredAt: new Date("2024-04-05")
  },
  {
    userId: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb"),
    userName: "Bob Smith",
    status: "pending",
    items: [
      { productId: ObjectId("222222222222222222222222"), name: "Curved Monitor", qty: 1, price: 349.99 },
      { productId: ObjectId("333333333333333333333333"), name: "Wireless Mouse", qty: 2, price: 49.99 }
    ],
    total: 449.97,
    orderedAt: new Date("2024-04-10")
  },
  {
    userId: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),
    userName: "Alice Johnson",
    status: "shipped",
    items: [
      { productId: ObjectId("333333333333333333333333"), name: "Wireless Mouse", qty: 1, price: 49.99 }
    ],
    total: 49.99,
    orderedAt: new Date("2024-04-12")
  }
]);
print("Inserted 3 orders");

// ─── events (time-series style) ──────────────────────────────────────────────
db.createCollection("events");
db.events.insertMany([
  { userId: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"), type: "LOGIN",   ip: "1.2.3.4",   ts: new Date("2024-04-15T08:00:00Z") },
  { userId: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"), type: "VIEW",    page: "/home",   ts: new Date("2024-04-15T08:01:00Z") },
  { userId: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb"), type: "LOGIN",   ip: "5.6.7.8",   ts: new Date("2024-04-15T09:00:00Z") },
  { userId: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb"), type: "PURCHASE", orderId: "o1", ts: new Date("2024-04-15T09:05:00Z") }
]);
print("Inserted 4 events");

// ─── sessions (for TTL demo) ─────────────────────────────────────────────────
db.createCollection("sessions");
// TTL index: documents auto-deleted 1 hour after createdAt
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });
db.sessions.insertOne({
  sessionId: "sess-abc-123",
  userId: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),
  data: { theme: "dark", lang: "en" },
  createdAt: new Date()
});
print("Inserted 1 session with TTL index");

// ─── Indexes ─────────────────────────────────────────────────────────────────
db.users.createIndex({ email: 1 }, { unique: true, name: "idx_users_email_unique" });
db.users.createIndex({ "address.city": 1 }, { name: "idx_users_city" });
db.orders.createIndex({ userId: 1, orderedAt: -1 }, { name: "idx_orders_user_date" });
db.orders.createIndex({ status: 1 }, { name: "idx_orders_status" });
db.products.createIndex({ category: 1, price: 1 }, { name: "idx_products_category_price" });
db.events.createIndex({ userId: 1, ts: -1 }, { name: "idx_events_user_time" });
print("Created indexes on all collections");

print("=== Initialization complete! ===");
print("Collections: users, orders, products, events, sessions");
print("Connect: mongosh 'mongodb://localhost:27017/mongo_labs?replicaSet=rs0'");

