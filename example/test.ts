// // file: main.ts
// import { MongoClient } from "npm:mongodb"; // updated for Deno

// const client = new MongoClient(
//   "mongodb://admin:123456@192.168.21.125:30711/test?authSource=admin",
// );

// async function main() {
//   console.log("connecting");
//   await client.connect();
//   console.log("connected");
//   const collection = client.db("test").collection("test_collection");
//   // await collection.deleteMany({});
//   await collection.insertOne({ a: 2.3 });
//   var results = await collection.count({ a: 2.3 });
//   console.log(`found ${results}`);
// }

// main();
