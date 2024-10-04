import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
// import jwt from 'jsonwebtoken';

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

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xrbh57q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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
    
    const carsCollection = client.db("urbanDrive").collection<Car>("cars");  
    const usersCollection = client.db("urbanDrive").collection("users");

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
// users
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existUser = await usersCollection.findOne(query);
      if (existUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
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