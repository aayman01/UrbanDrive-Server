import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@main.mq0mae1.mongodb.net/?retryWrites=true&w=majority&appName=Main`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

interface Car {
  _id?: ObjectId;
  make: string;
  model: string;
  year: number;
  price: number;
}

async function run() {
  try {
    // await client.connect();
    const database = client.db("urbanDrive");
    const carsCollection = database.collection<Car>("cars");

    // Get all cars
    app.get('/cars', async (req: Request, res: Response) => {
      const cars = await carsCollection.find().toArray();
      res.json(cars);
    });

    // Get a single car by ID
    app.get('/cars/:id', async (req: Request, res: Response) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const car = await carsCollection.findOne(query);
      res.json(car);
    });

    // Add a new car
    app.post('/cars', async (req: Request, res: Response) => {
      const newCar: Car = req.body;
      const result = await carsCollection.insertOne(newCar);
      res.json(result);
    });

    // Update a car
    app.put('/cars/:id', async (req: Request, res: Response) => {
      const id = req.params.id;
      const updatedCar: Car = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: updatedCar,
      };
      const result = await carsCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });

    // Delete a car
    app.delete('/cars/:id', async (req: Request, res: Response) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await carsCollection.deleteOne(query);
      res.json(result);
    });

    console.log("Connected to MongoDB");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from UrbanDrive Server..');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});