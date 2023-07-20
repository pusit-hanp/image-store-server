// db.js
import { MongoClient } from 'mongodb';

let db;

async function connectToDb(cb) {
  const client = new MongoClient(
    `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.q7jc927.mongodb.net/?retryWrites=true&w=majority`
  );

  try {
    await client.connect();
    db = client.db('image-store-db');
    cb();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
  }
}

export { db, connectToDb };
