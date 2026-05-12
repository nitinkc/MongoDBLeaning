#!/usr/bin/env python3
"""
Generate 11 Jupyter notebooks from MongoDB JS lab content, converted to Python/pymongo.
Each notebook includes connection setup (Docker + Atlas toggle), theory links, and executable cells.
"""

import json
import os

NB_DIR = "notebooks"

CONNECTION_CELL = """from pymongo import MongoClient, ReadPreference
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern
from pymongo.errors import ConnectionFailure
from bson import ObjectId
from datetime import datetime, timedelta, timezone
import pprint

USE_ATLAS = False
ATLAS_URI  = "mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
DOCKER_URI = "mongodb://127.0.0.1:27017/?directConnection=true"

uri = ATLAS_URI if USE_ATLAS else DOCKER_URI
client = MongoClient(uri, serverSelectionTimeoutMS=5000)
try:
    client.admin.command("ping")
    print("✅ Connected to", "Atlas" if USE_ATLAS else "Docker MongoDB")
except ConnectionFailure as e:
    print("❌ Connection failed:", e)

db = client["mongo_labs"]
pp = pprint.PrettyPrinter(indent=2)"""

def nb(cells):
    """Return a minimal nbformat v4 notebook dict."""
    return {
        "nbformat": 4,
        "nbformat_minor": 5,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3.11.0"}
        },
        "cells": cells
    }

def md(source):
    return {"cell_type": "markdown", "metadata": {}, "source": source}

def code(source):
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": source}

# Simple minimal versions of all 11 labs
labs = {}

labs['01_database_basics.ipynb'] = nb([
    md("# 🧪 Lab 01: Database Basics\n\n**Topics:** CRUD, projections, operators, bulk writes\n\n---"),
    code(CONNECTION_CELL),
    md("## CREATE"),
    code('db.products.drop()\nr = db.products.insert_one({"name":"USB Hub","category":"peripherals","price":29.99,"stock":80,"createdAt":datetime.now(timezone.utc)})\nprint("Inserted:", r.inserted_id)'),
    code('bulk = db.products.insert_many([{"name":"Webcam","category":"peripherals","price":59.99},{"name":"Desk","category":"furniture","price":499.0}])\nprint("IDs:", bulk.inserted_ids)'),
    md("## READ"),
    code('pp.pprint(db.products.find_one({"name":"USB Hub"}))'),
    code('for d in db.products.find({"category":"peripherals"},{"_id":0,"name":1,"price":1}):\n    print(f"{d[\'name\']}: ${d[\'price\']}")'),
    code('# Comparison operators\nfor d in db.products.find({"price":{"$gte":25,"$lte":100}},{"_id":0,"name":1}):\n    print(d["name"])'),
    code('# Logical operators\nfor d in db.products.find({"$or":[{"category":"peripherals"},{"price":{"$gt":400}}]},{"_id":0,"name":1}):\n    print(d["name"])'),
    code('# sort + limit\nfor d in db.products.find({},{"_id":0,"name":1,"price":1}).sort("price",-1).limit(3):\n    print(d)\nprint("Count:", db.products.count_documents({"category":"peripherals"}))'),
    md("## UPDATE"),
    code('r = db.products.update_one({"name":"USB Hub"},{"$set":{"price":24.99,"onSale":True}})\nprint("Matched:",r.matched_count,"Modified:",r.modified_count)'),
    code('db.products.update_one({"name":"USB Hub"},{"$inc":{"stock":-5}})\ndb.products.update_one({"name":"USB Hub"},{"$unset":{"onSale":""}})\nprint("Updated")'),
    code('db.products.update_many({"category":"peripherals"},{"$set":{"updatedAt":datetime.now(timezone.utc)}})\nprint("Update many done")'),
    code('db.products.update_one({"name":"BT Speaker"},{"$set":{"name":"BT Speaker","category":"audio","price":79.99}},upsert=True)\nprint("Upserted")'),
    code('db.products.replace_one({"name":"Webcam"},{"name":"Webcam 4K","category":"peripherals","price":89.99})\nprint("Replaced")'),
    md("## DELETE"),
    code('print("Deleted:", db.products.delete_one({"name":"BT Speaker"}).deleted_count)\nprint("Deleted many:", db.products.delete_many({"category":"furniture"}).deleted_count)'),
    md("## BULK WRITE"),
    code('from pymongo import InsertOne, UpdateOne, DeleteOne\ndb.products.bulk_write([InsertOne({"name":"Stand","price":35.99}),UpdateOne({"name":"USB Hub"},{"$set":{"price":22.99}}),DeleteOne({"name":"Desk"})],ordered=False)\nprint("Bulk write done")'),
])

labs['02_document_modeling.ipynb'] = nb([
    md("# 🧪 Lab 02: Document Modeling\n\n**Topics:** Embedding vs Referencing, one-to-many, many-to-many\n\n---"),
    code(CONNECTION_CELL),
    md("## Embedding (co-accessed data)"),
    code('db.users_embedded.drop()\nuser_id = db.users_embedded.insert_one({"name":"Alice","email":"alice@example.com","address":{"city":"NYC","state":"NY"},"tags":["premium"]}).inserted_id\nuser = db.users_embedded.find_one({"email":"alice@example.com"})\nprint("City:", user["address"]["city"])'),
    code('# Query on embedded field\nfor u in db.users_embedded.find({"address.city":"NYC"},{"_id":0,"name":1}):\n    print(u["name"])'),
    md("## Referencing (unbounded growth)"),
    code('db.users_ref.drop()\ndb.orders_ref.drop()\nbob_id = db.users_ref.insert_one({"name":"Bob","email":"bob@example.com"}).inserted_id\ndb.orders_ref.insert_many([{"userId":bob_id,"status":"delivered","total":349.99},{"userId":bob_id,"status":"pending","total":49.99}])\nuser = db.users_ref.find_one({"_id":bob_id})\norders = list(db.orders_ref.find({"userId":bob_id}))\nprint(f"{user[\'name\']}: {len(orders)} orders")'),
    md("## $lookup (runtime join)"),
    code('result = list(db.users_ref.aggregate([{"$match":{"_id":bob_id}},{"$lookup":{"from":"orders_ref","localField":"_id","foreignField":"userId","as":"orders"}}]))\nprint("Joined orders:", len(result[0]["orders"]))'),
    md("## Many-to-Many (edge collection)"),
    code('db.courses.drop()\ndb.students.drop()\ndb.enrollments.drop()\ndb.courses.insert_many([{"_id":ObjectId("c00000000000000000000001"),"title":"MongoDB"},{"_id":ObjectId("c00000000000000000000002"),"title":"Aggregation"}])\ndb.students.insert_many([{"_id":ObjectId("s00000000000000000000001"),"name":"Dave"},{"_id":ObjectId("s00000000000000000000002"),"name":"Eve"}])\ndb.enrollments.insert_many([{"studentId":ObjectId("s00000000000000000000001"),"courseId":ObjectId("c00000000000000000000001")},{"studentId":ObjectId("s00000000000000000000001"),"courseId":ObjectId("c00000000000000000000002")}])\ndb.enrollments.create_index("studentId")\ndb.enrollments.create_index("courseId")\ncourses = list(db.enrollments.find({"studentId":ObjectId("s00000000000000000000001")}))\nprint("Dave enrolled in:", len(courses), "courses")'),
])

labs['03_indexes.ipynb'] = nb([
    md("# 🧪 Lab 03: Indexes\n\n**Topics:** Single-field, compound, unique, multikey, text, partial, sparse, TTL\n\n---"),
    code(CONNECTION_CELL),
    code('print("Indexes on products:")\nfor idx in db.products.index_information().values():\n    print(f"  {idx[\'key\']}")'),
    md("## Single-field Index"),
    code('db.products.create_index([("price",1)],name="idx_price_asc")\nprint("Created single-field index on price")'),
    md("## Compound Index (ESR rule)"),
    code('db.products.create_index([("category",1),("price",-1)],name="idx_category_price")\nprint("Created compound index")'),
    md("## Unique Index"),
    code('db.users.drop()\ndb.users.insert_many([{"name":"Alice","email":"alice@example.com"},{"name":"Bob","email":"bob@example.com"}])\ndb.users.create_index([("email",1)],unique=True,name="idx_users_email")\nprint("Created unique index")'),
    md("## Multikey Index (on arrays)"),
    code('db.users.create_index([("tags",1)],name="idx_users_tags")\ndb.users.insert_one({"name":"Carol","tags":["premium","early-adopter"]})\nfor u in db.users.find({"tags":"premium"},{"_id":0,"name":1}):\n    print(u["name"])'),
    md("## Text Index"),
    code('db.products.create_index([("name","text"),("category","text")],name="idx_products_text")\nresults = list(db.products.find({"$text":{"$search":"keyboard"}},{"score":{"$meta":"textScore"},"name":1,"_id":0}))\nprint("Text search:", [r["name"] for r in results])'),
    md("## Partial Index"),
    code('db.orders.drop()\ndb.orders.insert_many([{"userId":"a","status":"pending"},{"userId":"b","status":"delivered"}])\ndb.orders.create_index([("userId",1)],partialFilterExpression={"status":{"$in":["pending","shipped"]}},name="idx_orders_active")\nprint("Created partial index")'),
    md("## Sparse Index"),
    code('db.products.create_index([("onSale",1)],sparse=True,name="idx_products_onsale")\nprint("Created sparse index")'),
    md("## TTL Index"),
    code('db.sessions.drop()\ndb.sessions.create_index([("createdAt",1)],expireAfterSeconds=3600,name="idx_sessions_ttl")\nprint("Created TTL index")'),
    md("## explain() - Check index usage"),
    code('plan = db.products.find({"category":"peripherals","price":{"$lt":100}}).explain("executionStats")\nprint("Stage:", plan["queryPlanner"]["winningPlan"]["stage"])\nprint("Docs examined:", plan["executionStats"]["totalDocsExamined"])'),
    md("## Covered Query"),
    code('covered = db.products.find({"category":"peripherals"},{"_id":0,"category":1,"price":1}).explain("executionStats")\nprint("Covered query stage:", covered["queryPlanner"]["winningPlan"]["stage"])'),
])

labs['04_aggregation_pipeline.ipynb'] = nb([
    md("# 🧪 Lab 04: Aggregation Pipeline\n\n**Topics:** $match, $group, $project, $unwind, $sort, $limit, $skip, $count\n\n---"),
    code(CONNECTION_CELL),
    md("## Setup: Seed orders"),
    code('db.orders.drop()\ndb.orders.insert_many([\n    {"userName":"Alice","status":"delivered","total":120.0,"orderedAt":datetime(2024,4,5),"items":[{"name":"Keyboard","price":89.99,"qty":1}]},\n    {"userName":"Alice","status":"pending","total":45.0,"orderedAt":datetime(2024,4,12),"items":[{"name":"USB Hub","price":22.99,"qty":2}]},\n    {"userName":"Bob","status":"delivered","total":349.99,"orderedAt":datetime(2024,4,10),"items":[{"name":"Monitor","price":349.99,"qty":1}]},\n    {"userName":"Bob","status":"shipped","total":89.99,"orderedAt":datetime(2024,4,20),"items":[{"name":"Webcam","price":89.99,"qty":1}]},\n    {"userName":"Carol","status":"delivered","total":55.0,"orderedAt":datetime(2024,4,15),"items":[{"name":"Mousepad","price":27.5,"qty":2}]},\n])\nprint("Orders seeded")'),
    md("## $match — Filter"),
    code('pipeline = [{"$match":{"status":"delivered"}}]\nfor o in db.orders.aggregate(pipeline):\n    print(f"  {o[\'userName\']}: ${o[\'total\']}")'),
    md("## $group — Aggregate"),
    code('pipeline = [{"$group":{"_id":"$status","totalRevenue":{"$sum":"$total"},"count":{"$sum":1},"avg":{"$avg":"$total"}}},{"$sort":{"totalRevenue":-1}}]\nfor r in db.orders.aggregate(pipeline):\n    print(f"  {r[\'_id\']}: count={r[\'count\']}, revenue=${r[\'totalRevenue\']:.2f}")'),
    md("## $project — Reshape"),
    code('pipeline = [{"$match":{"status":{"$in":["delivered","shipped"]}}},{"$project":{"_id":0,"customer":"$userName","total":1,"tax":{"$multiply":["$total",0.1]}}}]\nfor o in db.orders.aggregate(pipeline):\n    print(f"  {o[\'customer\']}: ${o[\'total\']:.2f} + tax ${o[\'tax\']:.2f}")'),
    md("## $addFields — Add without removing"),
    code('pipeline = [{"$match":{"total":{"$gt":50}}},{"$addFields":{"discounted":{"$multiply":["$total",0.9]}}},{"$project":{"_id":0,"userName":1,"original":"$total","discounted":1}}]\nfor o in db.orders.aggregate(pipeline):\n    print(f"  {o[\'userName\']}: ${o[\'original\']:.2f} → ${o[\'discounted\']:.2f}")'),
    md("## $unwind — Flatten arrays"),
    code('pipeline = [{"$unwind":"$items"},{"$project":{"_id":0,"userName":1,"item":"$items.name","price":"$items.price","qty":"$items qty"}}]\nfor o in db.orders.aggregate(pipeline):\n    print(f"  {o[\'userName\']}: {o[\'item\']} x{o[\'qty\']} @ ${o[\'price\']}")'),
    md("## $unwind + $group — Aggregate across items"),
    code('pipeline = [{"$unwind":"$items"},{"$group":{"_id":"$items.name","totalQty":{"$sum":"$items qty"},"totalRevenue":{"$sum":{"$multiply":["$items.price","$items qty"]}}}},{"$sort":{"totalRevenue":-1}}]\nfor r in db.orders.aggregate(pipeline):\n    print(f"  {r[\'_id\']}: qty={r[\'totalQty\']}, revenue=${r[\'totalRevenue\']:.2f}")'),
    md("## $sort + $limit + $skip — Pagination"),
    code('PAGE, SIZE = 0, 2\npipeline = [{"$sort":{"orderedAt":-1}},{"$skip":PAGE*SIZE},{"$limit":SIZE},{"$project":{"_id":0,"userName":1,"total":1,"status":1}}]\nfor o in db.orders.aggregate(pipeline):\n    print(f"  {o[\'userName\']}: ${o[\'total\']}")'),
    md("## $count"),
    code('result = list(db.orders.aggregate([{"$match":{"total":{"$gt":100}}},{"$count":"ordersOver100"}]))\nprint("Orders > $100:", result[0]["ordersOver100"] if result else 0)'),
    md("## $sortByCount"),
    code('for r in db.orders.aggregate([{"$sortByCount":"$userName"}]):\n    print(f"  {r[\'_id\']}: {r[\'count\']} orders")'),
])

labs['05_transactions.ipynb'] = nb([
    md("# 🧪 Lab 05: Transactions\n\n**Topics:** Multi-document ACID, commit, abort, retry logic\n\n---"),
    code(CONNECTION_CELL),
    md("## Setup: Accounts"),
    code('db.accounts.drop()\ndb.transfers.drop()\ndb.accounts.insert_many([{"_id":"acct-alice","owner":"Alice","balance":1000.0},{"_id":"acct-bob","owner":"Bob","balance":200.0}])\nprint("Accounts: Alice=$1000, Bob=$200")'),
    md("## Fund Transfer Transaction"),
    code('AMOUNT = 150.0\nwith client.start_session() as session:\n    try:\n        with session.start_transaction(read_concern={"level":"snapshot"},write_concern={"w":"majority"}):\n            accounts = db.get_collection("accounts", session=session)\n            result = db.accounts.update_one({"_id":"acct-alice","balance":{"$gte":AMOUNT}},{"$inc":{"balance":-AMOUNT}},session=session)\n            if result.modified_count == 0:\n                raise ValueError("Insufficient funds")\n            db.accounts.update_one({"_id":"acct-bob"},{"$inc":{"balance":AMOUNT}},session=session)\n            db.transfers.insert_one({"from":"acct-alice","to":"acct-bob","amount":AMOUNT,"ts":datetime.now(timezone.utc)},session=session)\n            print(f"✅ Transfer ${AMOUNT} committed")\n    except Exception as e:\n        print(f"❌ Aborted: {e}")\n\nalice = db.accounts.find_one({"_id":"acct-alice"})\nbob = db.accounts.find_one({"_id":"acct-bob"})\nprint(f"After: Alice=${alice[\'balance\']}, Bob=${bob[\'balance\']}")'),
    md("## Abort Demo — Insufficient Funds"),
    code('with client.start_session() as session:\n    try:\n        with session.start_transaction(write_concern={"w":"majority"}):\n            result = db.accounts.update_one({"_id":"acct-alice","balance":{"$gte":5000}},{"$inc":{"balance":-5000}},session=session)\n            if result.modified_count == 0:\n                raise ValueError("Insufficient funds")\n            db.accounts.update_one({"_id":"acct-bob"},{"$inc":{"balance":5000}},session=session)\n    except Exception as e:\n        print(f"❌ Aborted: {e}")\n\nalice = db.accounts.find_one({"_id":"acct-alice"})\nbob = db.accounts.find_one({"_id":"acct-bob"})\nprint(f"After abort: Alice=${alice[\'balance\']}, Bob=${bob[\'balance\']} (unchanged)")'),
    md("## Retry Pattern with with_transaction()"),
    code('def transfer_callback(session):\n    db.accounts.update_one({"_id":"acct-alice"},{"$inc":{"balance":25}},session=session)\n    db.accounts.update_one({"_id":"acct-bob"},{"$inc":{"balance":-25}},session=session)\n\nwith client.start_session() as session:\n    session.with_transaction(transfer_callback, write_concern={"w":"majority"})\n    print("✅ Retry-safe transfer committed")\n\nalice = db.accounts.find_one({"_id":"acct-alice"})\nprint(f"Final: Alice=${alice[\'balance\']}")'),
])

labs['06_ttl_and_capped.ipynb'] = nb([
    md("# 🧪 Lab 06: TTL & Capped Collections\n\n**Topics:** TTL indexes, per-doc expiry, capped collections, change streams\n\n---"),
    code(CONNECTION_CELL),
    md("## TTL Index — Auto-delete after N seconds"),
    code('db.sessions.drop()\ndb.sessions.create_index([("createdAt",1)],expireAfterSeconds=30,name="idx_sessions_ttl")\ndb.sessions.insert_many([{"sessionId":"sess-001","userId":"alice","data":{"page":"/home"},"createdAt":datetime.now(timezone.utc)},{"sessionId":"sess-002","userId":"bob","data":{"page":"/catalog"},"createdAt":datetime.now(timezone.utc)},{"sessionId":"sess-old","userId":"charlie","data":{},"createdAt":datetime.now(timezone.utc)-timedelta(minutes=2)}])\nprint("Inserted 3 sessions (sess-old will auto-delete in ~60s)")\nprint("Count:", db.sessions.count_documents({}))'),
    md("## Modify TTL with collMod"),
    code('db.command({"collMod":"sessions","index":{"name":"idx_sessions_ttl","expireAfterSeconds":3600}})\nprint("Extended TTL to 1 hour")'),
    md("## Per-Document Expiry Pattern"),
    code('db.tokens.drop()\ndb.tokens.create_index([("expiresAt",1)],expireAfterSeconds=0,name="idx_tokens_expire")\ndb.tokens.insert_many([{"token":"reset-abc","userId":"alice","type":"password_reset","expiresAt":datetime.now(timezone.utc)+timedelta(minutes=15)},{"token":"otp-xyz","userId":"bob","type":"otp","expiresAt":datetime.now(timezone.utc)+timedelta(minutes=5)}])\nfor t in db.tokens.find({},{"_id":0,"token":1,"type":1,"expiresAt":1}):\n    print(f"  {t[\'token\']} ({t[\'type\']}) expires: {t[\'expiresAt\']}")'),
    md("## Capped Collections — Fixed-size ring buffer"),
    code('if "activity_log" in db.list_collection_names():\n    db.activity_log.drop()\ndb.create_collection("activity_log",capped=True,size=10240,max=10)\nfor i in range(1,16):\n    db.activity_log.insert_one({"seq":i,"action":f"event-{i}","ts":datetime.now(timezone.utc)})\ncount = db.activity_log.count_documents({})\nprint(f"Inserted 15, retained: {count} (capped at 10)")\nfor doc in db.activity_log.find({},{"_id":0,"seq":1,"action":1}):\n    print(f"  seq={doc[\'seq\']}: {doc[\'action\']}")'),
    md("## Capped Stats"),
    code('stats = db.command("collStats","activity_log")\nprint(f"Capped: {stats.get(\'capped\')}, Max docs: {stats.get(\'max\')}, Max size: {stats.get(\'maxSize\')} bytes")'),
    md("## Change Streams (concept)"),
    code('print("Opening change stream on orders...")\nwith db.orders.watch([{"$match":{"operationType":{"$in":["insert","update"]}}}],max_await_time_ms=3000) as stream:\n    db.orders.insert_one({"userName":"StreamTest","status":"pending","total":1.0,"orderedAt":datetime.now(timezone.utc)})\n    change = stream.try_next()\n    if change:\n        print(f"✅ Change event: {change[\'operationType\']} on {change.get(\'fullDocument\',{}).get(\'userName\')}")\n    else:\n        print("(No change event in time window)")'),
])

labs['07_advanced_aggregation.ipynb'] = nb([
    md("# 🧪 Lab 07: Advanced Aggregation\n\n**Topics:** $lookup, $facet, $bucket, $graphLookup, $setWindowFields\n\n---"),
    code(CONNECTION_CELL),
    md("## Setup"),
    code('db.users.drop()\ndb.orders.drop()\nalice_id = db.users.insert_one({"name":"Alice Johnson","email":"alice@example.com"}).inserted_id\nbob_id = db.users.insert_one({"name":"Bob Smith","email":"bob@example.com"}).inserted_id\ndb.orders.insert_many([{"userId":alice_id,"status":"delivered","total":120.0,"orderedAt":datetime(2024,4,5)},{"userId":alice_id,"status":"pending","total":45.0,"orderedAt":datetime(2024,4,12)},{"userId":bob_id,"status":"delivered","total":349.99,"orderedAt":datetime(2024,4,10)}])\nprint("Users + orders seeded")'),
    md("## $lookup — Join collections"),
    code('pipeline = [{"$match":{"status":"delivered"}},{"$lookup":{"from":"users","localField":"userId","foreignField":"_id","as":"userDetails"}},{"$unwind":{"path":"$userDetails","preserveNullAndEmpty":True}},{"$project":{"_id":0,"customer":"$userDetails.name","email":"$userDetails.email","total":1,"status":1}}]\nfor r in db.orders.aggregate(pipeline):\n    print(f"  {r[\'customer\']} ({r[\'email\']}): ${r[\'total\']}")'),
    md("## $lookup with pipeline"),
    code('pipeline = [{"$match":{"name":"Alice Johnson"}},{"$lookup":{"from":"orders","let":{"uid":"$_id"},"pipeline":[{"$match":{"$expr":{"$and":[{"$eq":["$userId","$$uid"]},{"$ne":["$status","delivered"]}]}}},{"$project":{"_id":1,"status":1,"total":1}}],"as":"activeOrders"}},{"$project":{"_id":0,"name":1,"activeOrders":1}}]\nfor r in db.users.aggregate(pipeline):\n    print(f"{r[\'name\']} active orders: {r[\'activeOrders\']}")'),
    md("## $facet — Multi-faceted aggregation"),
    code('db.products.drop()\ndb.products.insert_many([{"name":"Keyboard","category":"peripherals","price":89.99},{"name":"USB Hub","category":"peripherals","price":22.99},{"name":"Monitor","category":"monitors","price":349.99},{"name":"Stand","category":"accessories","price":35.99},{"name":"Desk","category":"furniture","price":499.0}])\npipeline = [{"$facet":{"stats":[{"$group":{"_id":None,"total":{"$sum":1},"avg":{"$avg":"$price"},"min":{"$min":"$price"},"max":{"$max":"$price"}}}],"byCategory":[{"$group":{"_id":"$category","count":{"$sum":1}}},{"$sort":{"count":-1}}]}}]\nresult = list(db.products.aggregate(pipeline))[0]\nprint("Stats:", result["stats"])\nprint("By category:", result["byCategory"])'),
    md("## $bucket — Price ranges"),
    code('pipeline = [{"$bucket":{"groupBy":"$price","boundaries":[0,50,100,500],"default":"Other","output":{"count":{"$sum":1},"names":{"$push":"$name"}}}}]\nfor b in db.products.aggregate(pipeline):\n    print(f"  ${b[\'_id\']}+: count={b[\'count\']}, products={b[\'names\']}")'),
    md("## $bucketAuto"),
    code('pipeline = [{"$bucketAuto":{"groupBy":"$price","buckets":3}}]\nfor b in db.products.aggregate(pipeline):\n    print(f"  ${b[\'_id\'][\'min\']:.2f}–${b[\'_id\'][\'max\']:.2f}: {b[\'count\']} products")'),
    md("## $graphLookup — Recursive traversal"),
    code('db.employees.drop()\ndb.employees.insert_many([{"_id":1,"name":"CEO","reportsTo":None},{"_id":2,"name":"VP Eng","reportsTo":"CEO"},{"_id":3,"name":"Sr Engineer","reportsTo":"VP Eng"},{"_id":4,"name":"Engineer","reportsTo":"Sr Engineer"}])\npipeline = [{"$match":{"name":"Engineer"}},{"$graphLookup":{"from":"employees","startWith":"$reportsTo","connectFromField":"reportsTo","connectToField":"name","as":"chain","maxDepth":5,"depthField":"depth"}},{"$project":{"name":1,"chain":1}}]\nresult = list(db.employees.aggregate(pipeline))[0]\nfor m in sorted(result["chain"], key=lambda x:x["depth"]):\n    print(f"  depth {m[\'depth\']}: {m[\'name\']}")'),
])

labs['08_schema_patterns.ipynb'] = nb([
    md("# 🧪 Lab 08: Schema Design Patterns\n\n**Topics:** Bucket, Computed, Polymorphic, Outlier, Subset\n\n---"),
    code(CONNECTION_CELL),
    md("## Bucket Pattern — Time-series"),
    code('db.sensor_buckets.drop()\ndb.sensor_buckets.create_index([("sensorId",1),("hour",1)],unique=True)\nsensor_id, hour = "sensor-001", "2026-04-10T10:00"\nreadings = [{"ts":datetime(2026,4,10,10,i+1),"temp":22.0+i*0.1} for i in range(5)]\nfor r in readings:\n    db.sensor_buckets.update_one({"sensorId":sensor_id,"hour":hour},{"$push":{"readings":r},"$inc":{"count":1},"$min":{"minTemp":r["temp"]},"$max":{"maxTemp":r["temp"]},"$setOnInsert":{"sensorId":sensor_id,"hour":hour,"createdAt":datetime.now(timezone.utc)}},upsert=True)\nbucket = db.sensor_buckets.find_one({"sensorId":sensor_id})\nprint(f"Bucket: {bucket[\'count\']} readings, temp range {bucket[\'minTemp\']:.1f}–{bucket[\'maxTemp\']:.1f}°C")'),
    md("## Computed Pattern — Pre-computed stats"),
    code('db.products_computed.drop()\ndb.products_computed.insert_one({"_id":"prod-001","name":"Keyboard","ratingStats":{"total":450,"count":100,"avg":4.5}})\nnew_rating = 5\ndb.products_computed.update_one({"_id":"prod-001"},{"$inc":{"ratingStats.total":new_rating,"ratingStats.count":1}})\nprod = db.products_computed.find_one({"_id":"prod-001"})\nnew_avg = prod["ratingStats"]["total"] / prod["ratingStats"]["count"]\ndb.products_computed.update_one({"_id":"prod-001"},{"$set":{"ratingStats.avg":new_avg}})\nprint(f"{prod[\'name\']}: avg rating = {new_avg:.2f} ({prod[\'ratingStats\'][\'count\']} reviews)")'),
    md("## Polymorphic Pattern — Multiple shapes"),
    code('db.catalog.drop()\ndb.catalog.insert_many([{"type":"book","name":"MongoDB Guide","price":39.99,"author":"Shannon","pages":514},{"type":"electronics","name":"Headphones","price":149.99,"brand":"Sony","battery":30},{"type":"clothing","name":"Hoodie","price":49.99,"sizes":["S","M","L"],"color":"gray"}])\nfor item in db.catalog.find({},{"_id":0,"type":1,"name":1,"price":1}):\n    print(f"  [{item[\'type\']}] {item[\'name\']}: ${item[\'price\']}")'),
    md("## Outlier Pattern — Overflow for viral docs"),
    code('db.posts.drop()\ndb.post_overflow.drop()\ndb.posts.insert_one({"_id":"post-normal","author":"alice","content":"Learning MongoDB","likes":[ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa")],"hasOverflow":False})\ndb.posts.insert_one({"_id":"post-viral","author":"celebrity","content":"Announcement!","likes":[ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa")],"hasOverflow":True})\ndb.post_overflow.insert_one({"postId":"post-viral","page":2,"likes":[ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb")]})\nviralpost = db.posts.find_one({"_id":"post-viral"})\nif viral["hasOverflow"]:\n    overflow = list(db.post_overflow.find({"postId":"post-viral"}))\n    extra_likes = sum(len(p["likes"]) for p in overflow)\n    print(f"Viral post: {viral[\'content\']}, overflow pages={len(overflow)}, extra likes={extra_likes}")'),
    md("## Subset Pattern — Embed recent, store full elsewhere"),
    code('db.products_subset.drop()\ndb.reviews.drop()\ndb.products_subset.insert_one({"_id":"prod-monitor","name":"Monitor","price":349.99,"recentReviews":[{"user":"alice","rating":5,"comment":"Excellent!"}],"reviewCount":1,"avgRating":5.0})\ndb.reviews.insert_one({"productId":"prod-monitor","user":"alice","rating":5,"comment":"Excellent!"})\nprod = db.products_subset.find_one({"_id":"prod-monitor"},{"name":1,"recentReviews":1,"reviewCount":1,"_id":0})\nprint(f"{prod[\'name\']}: {prod[\'reviewCount\']} recent, {len(prod[\'recentReviews\'])} embedded")'),
])

labs['09_replica_set.ipynb'] = nb([
    md("# 🧪 Lab 09: Replica Set\n\n**Topics:** Read preferences, write concerns, replication lag\n\n---"),
    code(CONNECTION_CELL),
    md("## Replica Set Status"),
    code('admin_db = client["admin"]\nstatus = admin_db.command("replSetGetStatus")\nfor m in status["members"]:\n    print(f"  {m[\'name\']:25s} {m[\'stateStr\']:10s} health={m[\'health\']}")'),
    md("## Write Concerns"),
    code('# w=majority: survives primary failure\ndb.orders.insert_one({"test":"w-majority"},write_concern={"w":"majority","j":True})\nprint("Inserted with w=majority + journal")\n# w=1: primary-only (faster, less durable)\ndb.events.insert_one({"test":"w-1"},write_concern={"w":1})\nprint("Inserted with w=1 (primary-only)")'),
    md("## Read Preferences"),
    code('from pymongo import ReadPreference\n# Primary: consisent, slower\nprimary_coll = db.get_collection("orders",read_preference=ReadPreference.PRIMARY)\nprint("Read from PRIMARY:", primary_coll.count_documents({}))\n# SecondaryPreferred: may be stale, faster\nsec_coll = db.get_collection("orders",read_preference=ReadPreference.SECONDARY_PREFERRED)\nprint("Read from SECONDARY_PREFERRED:", sec_coll.count_documents({}))'),
    md("## Read Concerns"),
    code('from pymongo.read_concern import ReadConcern\nmajority_coll = db.get_collection("orders",read_concern=ReadConcern("majority"))\nfor o in majority_coll.find({},{"_id":0,"test":1}).limit(3):\n    print(f"  {o}")'),
    md("## Replication Lag"),
    code('rs_status = admin_db.command("replSetGetStatus")\nfor m in rs_status["members"]:\n    if m["stateStr"] != "PRIMARY":\n        optime = m.get("optimeDate")\n        if optime:\n            lag = (datetime.now(timezone.utc) - optime).total_seconds()\n            print(f"  {m[\'name\']}: lag ~{lag:.1f}s")\n        else:\n            print(f"  {m[\'name\']}: lag N/A")'),
])

labs['10_security_basics.ipynb'] = nb([
    md("# 🧪 Lab 10: Security\n\n**Topics:** Users, roles, custom roles, SCRAM-SHA-256\n\n---"),
    code(CONNECTION_CELL),
    md("## Create Users"),
    code('admin_db = client["admin"]\ntry:\n    admin_db.command("createUser","admin",pwd="AdminPass123!",roles=[{"role":"root","db":"admin"}])\n    print("✅ Created admin")\nexcept Exception as e:\n    print(f"ℹ️  {e}")'),
    code('try:\n    admin_db.command("createUser","app_user",pwd="AppPass456!",roles=[{"role":"readWrite","db":"mongo_labs"}],mechanisms=["SCRAM-SHA-256"])\n    print("✅ Created app_user")\nexcept Exception as e:\n    print(f"ℹ️  {e}")'),
    code('try:\n    admin_db.command("createUser","reporter",pwd="Report789!",roles=[{"role":"read","db":"mongo_labs"}])\n    print("✅ Created reporter")\nexcept Exception as e:\n    print(f"ℹ️  {e}")'),
    md("## Custom Role"),
    code('mongo_labs_db = client["mongo_labs"]\ntry:\n    mongo_labs_db.command("createRole","ordersReader",privileges=[{"resource":{"db":"mongo_labs","collection":"orders"},"actions":["find"]}],roles=[])\n    print("✅ Created ordersReader role")\nexcept Exception as e:\n    print(f"ℹ️  {e}")'),
    code('try:\n    admin_db.command("createUser","orders_svc",pwd="OrdersPass!",roles=[{"role":"ordersReader","db":"mongo_labs"}])\n    print("✅ Created orders_svc with ordersReader")\nexcept Exception as e:\n    print(f"ℹ️  {e}")'),
    md("## List Users"),
    code('users = admin_db.command("usersInfo")\nfor u in users.get("users",[]):\n    roles = [f\"{r[\'role\']}@{r[\'db\']}\" for r in u.get("roles",[])]\n    print(f"  {u[\'user\']:20s}: {roles}")'),
    md("## Grant/Revoke Roles"),
    code('admin_db.command("grantRolesToUser","reporter",roles=[{"role":"readWrite","db":"mongo_labs"}])\nprint("✅ Granted readWrite to reporter")\nadmin_db.command("revokeRolesFromUser","reporter",roles=[{"role":"readWrite","db":"mongo_labs"}])\nprint("✅ Revoked readWrite from reporter")'),
])

labs['11_monitoring_and_performance.ipynb'] = nb([
    md("# 🧪 Lab 11: Monitoring & Performance\n\n**Topics:** explain(), $indexStats, collStats, serverStatus, profiler\n\n---"),
    code(CONNECTION_CELL),
    md("## explain() — Query execution"),
    code('plan = db.orders.find({"status":"delivered"}).explain("executionStats")\nprint("Stage:", plan["queryPlanner"]["winningPlan"]["stage"])\nprint("Docs examined:", plan["executionStats"]["totalDocsExamined"])\nprint("Docs returned:", plan["executionStats"]["totalDocsReturned"])\nprint("Time (ms):", plan["executionStats"]["executionTimeMillis"])'),
    md("## $indexStats — Index usage"),
    code('print("Index usage stats:")\nfor stat in db.orders.aggregate([{"$indexStats":{}}]):\n    print(f"  {stat[\'name\']:30s} accesses={stat[\'accesses\'][\'ops\']}"))'),
    md("## collStats — Collection size"),
    code('stats = db.command("collStats","orders")\nprint("=== orders collection ===" )\nprint(f"  Count: {stats.get(\'count\',0)}")\nprint(f"  Storage: {stats.get(\'storageSize\',0)} bytes")\nprint(f"  Index size: {stats.get(\'totalIndexSize\',0)} bytes")\nprint(f"  Indexes: {len(stats.get(\'indexSizes\',{}))}")'),
    md("## dbStats — Database stats"),
    code('db_stats = db.command("dbStats")\nprint("=== mongo_labs database ===" )\nprint(f"  Collections: {db_stats.get(\'collections\',0)}")\nprint(f"  Objects: {db_stats.get(\'objects\',0)}")\nprint(f"  Data size: {db_stats.get(\'dataSize\',0)} bytes")'),
    md("## serverStatus — Server metrics"),
    code('admin_db = client["admin"]\nsvr = admin_db.command("serverStatus")\nprint("=== Server Status ===" )\nprint(f"  Connections current: {svr[\'connections\'][\'current\']}")\nprint(f"  Connections available: {svr[\'connections\'][\'available\']}")\nprint(f"  Insert ops: {svr[\'opcounters\'][\'insert\']}")\nprint(f"  Query ops: {svr[\'opcounters\'][\'query\']}")'),
    md("## currentOp — Running operations"),
    code('ops = admin_db.command("currentOp",{"active":True,"secs_running":{"$gt":1}})\nif ops["inprog"]:\n    for op in ops["inprog"]:\n        print(f"  opid={op.get(\'opid\')}, secs={op.get(\'secs_running\')}")\nelse:\n    print("✅ No long-running operations")'),
    md("## Profiler — Capture slow queries"),
    code('db.command("profile",1,slowms=100)\ndb.orders.find({"status":"delivered"}).sort("total",-1).toArray()\nprofiled = list(db.system.profile.find({}).sort("ts",-1).limit(5))\nif profiled:\n    for op in profiled[:3]:\n        print(f"  {op.get(\'op\')}: {op.get(\'millis\')}ms examined={op.get(\'docsExamined\')}")\ndb.command("profile",0)\nprint("✅ Profiler off")'),
])

# Write all notebooks
os.makedirs(NB_DIR, exist_ok=True)
for filename, notebook in labs.items():
    path = os.path.join(NB_DIR, filename)
    with open(path, 'w') as f:
        json.dump(notebook, f, indent=1, default=str)
    print(f"✅ Created {filename}")

print("\n✅ Generated all 11 labs!")
