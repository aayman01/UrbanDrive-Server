const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());

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

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const usersCollection = client.db("urbanDrive").collection("users");
    const carsCollection = client.db("urbanDrive").collection("cars");
    
     
    app.get('/cars',async(req,res)=>{
      const page = parseInt(req.query.page) || 1; // Default to 1 if not provided
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page-1)*limit;

        const categoryName = req.query.category || '';
        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_SAFE_INTEGER;
        const sortOption = req.query.sort || ''; 
        console.log('mainPrice:', minPrice, 'maxPrice', maxPrice);

        try {
        const query = {
                
                ...(categoryName && { category: { $regex: categoryName, $options: 'i' } }),
                // ...(categoryName && { category: { $regex: categoryName, $options: 'i' } }),
                price: { $gte: minPrice, $lte: maxPrice }
              };
              let sort = {};
              if (sortOption === 'price-asc') {
                  sort = { price: 1 }; // Sort by price ascending
              } else if (sortOption === 'price-desc') {
                  sort = { price: -1 }; // Sort by price descending
              } else if (sortOption === 'date-desc') {
                  sort = { productCreationDateTime: -1 }; // Sort by date descending (newest first)
              }
      
         // Fetch total cars count without pagination
        const totalCars = await carsCollection.find(query).count();

        // Fetch cars with pagination
        const Cars = await carsCollection.find(query).sort(sort).skip(skip).limit(limit).toArray();
          // Calculate total pages
          const totalPages = Math.ceil(totalCars / limit);
      
          // Send the paginated data along with totalPages and totalCars
       
          res.json({ Cars,totalCars, totalPages, totalCars, currentPage: page });
        } catch (error) {
          res.status(500).json({ message: 'Server error', error });
        }
    })


    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Urban drive is running...");
});

app.listen(port, () => {
  console.log(`my port is running on ${port}`);
});