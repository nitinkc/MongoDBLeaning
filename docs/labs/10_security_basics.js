// Lab 10: Security Basics — Users, Roles, Authentication
// Topics: createUser, built-in roles, custom roles, db.auth(), connection strings
// Run: docker exec -it mongo1 mongosh --file /labs/10_security_basics.js
// Note: This lab assumes the cluster was started WITHOUT --auth (default for dev).
//       In production, always enable authentication in mongod.conf.

db = db.getSiblingDB("admin");
print("\n=== Lab 10: Security Basics ===\n");

// ─── Built-in Roles Overview ─────────��───────────────────────────────────────
// Database-level roles (scoped to a specific DB):
//   read           → read all non-system collections
//   readWrite      → read + write all non-system collections
//   dbAdmin        → administrative tasks (indexes, stats, collMod) — no data read
//   dbOwner        → readWrite + dbAdmin + userAdmin (full control of one DB)
//   userAdmin      → create/modify users and roles within the DB
//
// Cluster-level roles (scoped to admin DB):
//   clusterMonitor → read-only access to monitoring commands
//   clusterManager → monitoring + management (rs.reconfig, sharding)
//   clusterAdmin   → full cluster management (includes shutdown, replSetReconfig)
//   root           → superuser — all privileges on all resources

// ─── Create an Admin Superuser (one-time setup) ───────────────────────────────
// In production: create this BEFORE enabling --auth, then restart with auth.
try {
  db.createUser({
    user: "admin",
    pwd:  "AdminPass123!",   // use a strong password in production
    roles: [{ role: "root", db: "admin" }]
  });
  print("Created admin superuser");
} catch (e) {
  print("Admin user may already exist:", e.message);
}

// ─── Create Application-Specific Users ───────────────────────────────────────
// Best practice: least-privilege — give each app only the permissions it needs.

// App user: read/write on mongo_labs only
try {
  db.createUser({
    user: "app_user",
    pwd:  "AppPass456!",
    roles: [
      { role: "readWrite", db: "mongo_labs" }
    ],
    // Optional: password hashing (default is SCRAM-SHA-256 in MongoDB 4.0+)
    mechanisms: ["SCRAM-SHA-256"]
  });
  print("Created app_user (readWrite on mongo_labs)");
} catch (e) {
  print("app_user may already exist:", e.message);
}

// Read-only reporting user
try {
  db.createUser({
    user: "reporter",
    pwd:  "ReportPass789!",
    roles: [
      { role: "read", db: "mongo_labs" }
    ]
  });
  print("Created reporter (read-only on mongo_labs)");
} catch (e) {
  print("reporter may already exist:", e.message);
}

// DBA user: admin tasks (no data read) + monitoring
try {
  db.createUser({
    user: "dba",
    pwd:  "DbaPass!23",
    roles: [
      { role: "dbAdmin",        db: "mongo_labs" },
      { role: "clusterMonitor", db: "admin" }
    ]
  });
  print("Created dba (dbAdmin on mongo_labs + clusterMonitor)");
} catch (e) {
  print("dba may already exist:", e.message);
}

// ─── Create a Custom Role ─────────────────────────────────────────────────────
// Custom roles allow fine-grained permission control.
// Example: allow reading orders but NOT users (sensitive PII).

const mongoLabsDb = db.getSiblingDB("mongo_labs");
try {
  mongoLabsDb.createRole({
    role: "ordersReader",
    privileges: [
      {
        resource: { db: "mongo_labs", collection: "orders" },
        actions: ["find"]
      },
      {
        resource: { db: "mongo_labs", collection: "products" },
        actions: ["find"]
      }
    ],
    roles: []  // no inherited roles
  });
  print("\nCreated custom role 'ordersReader' (find on orders + products only)");
} catch (e) {
  print("ordersReader role may already exist:", e.message);
}

// Assign custom role to a user
try {
  db.createUser({
    user: "orders_service",
    pwd: "OrdersPass!1",
    roles: [
      { role: "ordersReader", db: "mongo_labs" }
    ]
  });
  print("Created orders_service user with custom ordersReader role");
} catch (e) {
  print("orders_service may already exist:", e.message);
}

// ─── List Users and Roles ─────────────────────────────────────────────────────
print("\n--- Users in admin DB ---");
db.getUsers().users.forEach(u => {
  print(` - ${u.user}: ${JSON.stringify(u.roles.map(r => r.role + "@" + r.db))}`);
});

print("\n--- Custom roles in mongo_labs DB ---");
mongoLabsDb.getRoles({ showPrivileges: true }).forEach(r => {
  print(` - Role: ${r.role}`);
  r.privileges.forEach(p => print(`   can ${p.actions} on ${p.resource.collection}`));
});

// ─── Update a User ────────────────────────────────────────────────────────────
// Grant additional role
db.grantRolesToUser("reporter", [{ role: "readWrite", db: "mongo_labs" }]);
print("\nGranted readWrite to reporter");

// Revoke a role
db.revokeRolesFromUser("reporter", [{ role: "readWrite", db: "mongo_labs" }]);
print("Revoked readWrite from reporter (back to read-only)");

// Change password
db.updateUser("app_user", { pwd: "NewAppPass789!" });
print("Updated app_user password");

// ─── Delete a User ────────────────────────────────────────────────────────────
// db.dropUser("temp_user");  // commented out — would fail if user doesn't exist

// ─── Authentication Connection Strings ───────────────────────────────────────
print("\n--- Connection string examples ---");
print("App user:     mongosh 'mongodb://app_user:AppPass456!@localhost:27017/mongo_labs'");
print("Admin:        mongosh 'mongodb://admin:AdminPass123!@localhost:27017/admin'");
print("Replica set:  mongosh 'mongodb://app_user:AppPass456!@localhost:27017,localhost:27018,localhost:27019/mongo_labs?replicaSet=rs0&authSource=admin'");

// ─── TLS/SSL (production reminder) ────────────────────────────────────────────
print("\n--- TLS encryption (for production) ---");
print("Enable in mongod.conf:");
print("  net:");
print("    tls:");
print("      mode: requireTLS");
print("      certificateKeyFile: /etc/ssl/mongodb.pem");
print("      CAFile: /etc/ssl/ca.pem");
print("Connect with TLS:");
print("  mongosh --tls --tlsCAFile ca.pem 'mongodb://user:pass@host:27017/db'");

print("\n=== Lab 10 Complete ===");
print("Key takeaways:");
print("  - Enable authentication in production (--auth / security.authorization: enabled)");
print("  - Use least-privilege: give each service only the roles it needs");
print("  - Prefer SCRAM-SHA-256 (default in 4.0+) over SCRAM-SHA-1");
print("  - Custom roles allow fine-grained collection-level access control");
print("  - Always enable TLS in production to encrypt data in transit");
print("  - Never use root role for application users — only for admin operations");

