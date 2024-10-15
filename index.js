const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { MongoClient, ServerApiVersion, ObjectId, Long } = require("mongodb");

const app = express();
const port = process.env.PORT || 8000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
// nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587, 
  secure: false, 
  auth: {
      user: process.env.EMAIL_USER, 
      pass: process.env.EMAIL_PASS, 
  },
});



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    const usersCollection = client.db("urbanDrive").collection("users");
    const carsCollection = client.db("urbanDrive").collection("cars");
    const bookingsCollection = client.db("urbanDrive").collection("bookings");
    const paymentHistoryCollection = client.db("urbanDrive").collection("paymentHistory");
    const memberships = client.db("urbanDrive").collection("memberships");
    const membershipCollection = client.db("urbanDrive").collection("membershipsInfo");
    const hostCarCollection = client.db("urbanDrive").collection("hostCar");

    app.get("/cars", async (req, res) => {
      const page = parseInt(req.query.page) || 1; // Default to 1 if not provided
      const limit = parseInt(req.query.limit) || 6;
      const skip = (page - 1) * limit;

      const categoryName = req.query.category || "";
      const minPrice = parseFloat(req.query.minPrice) || 0;
      const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_SAFE_INTEGER;
      const sortOption = req.query.sort || "";
      const seatCount = parseInt(req.query.seatCount) || null;
      const driver = req.query.driver || "";
      const homePickup = req.query.homePickup || "";

      try {
        const query = {
          ...(categoryName && {
            category: { $regex: categoryName, $options: "i" },
          }),
          // ...(categoryName && { category: { $regex: categoryName, $options: 'i' } }),
          price: { $gte: minPrice, $lte: maxPrice },
          ...(seatCount && { seatCount: { $gte: seatCount } }),
          ...(driver && {
            driver: driver === "yes" ? "Yes" : "No", // Filter by 'Yes' or 'No'
          }),
          ...(homePickup && {
            home_pickup: homePickup === "yes" ? "Yes" : "No", // Filter by 'Yes' or 'No'
          }),
        };
        let sort = {};
        if (sortOption === "price-asc") {
          sort = { price: 1 }; // Sort by price ascending
        } else if (sortOption === "price-desc") {
          sort = { price: -1 }; // Sort by price descending
        } else if (sortOption === "date-desc") {
          sort = { date: -1 }; // Sort by date descending (newest first)
        } else if (sortOption === "date-asc") {
          sort = { date: 1 };
        }

        // Fetch total cars count without pagination
        const totalCars = await carsCollection.countDocuments();
        // console.log("totalcars:", totalCars);

        // Fetch cars with pagination

        const Cars = await carsCollection
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .toArray();
        // Calculate total pages
        const totalPages = Math.ceil(totalCars / limit);

        // Send the paginated data along with totalPages and totalCars
        console.log("Incoming query parameters:", req.query);

        res.json({ Cars, totalCars, totalPages, totalCars, currentPage: page });
      } catch (error) {
        res.status(500).json({ message: "Server error", error });
      }
    });

    app.get("/SearchCars", async (req, res) => {
      const { lng, lat, maxDistance, location } = req.query;
    
      try {
        let query = {};
    
        if (location === "current" && lat && Long) {
          const coordinates = [parseFloat(lng), parseFloat(lat)];
          query.location = {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: coordinates,
              },
              $maxDistance: parseInt(maxDistance) || 5000,
            },
          };
          console.log("Coordinates for search:", coordinates); 
        } else if (location === "anywhere") {
          query = {}; 
        }
       
    
        const cars = await carsCollection.find(query).toArray();
        res.json(cars);
        
      } catch (error) {
        res.status(500).json({ message: "Server error", error });
      }
    });

    // get membership data
    app.get("/memberships",async(req,res)=>{
      const data = await memberships.find().toArray();
      res.send(data)
    })

    // user related api
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
    app.post("/user/profile", async (req, res) => {
        const { updateData } = req.body; 
        const email = updateData.email;
        console.log('email:', email)
        console.log('UpdateProfile:', updateData);
      try {
     
        if (updateData.link) {
          const existingLinks = Array.isArray(updateData.link) ? updateData.link : [updateData.link];
          if (!existingLinks.includes(updateData.link)) {
            existingLinks.push(updateData.link);
          }
  
          updateData.link = existingLinks; 
        } else {
          
          updateData.link = updateData.link; 
        }
         //Find the user by email and update the profile
         const result = await usersCollection.updateOne(
           { email: email }, // Find user by unique field like email
           {
             $set: updateData, // Update the profile with new fields
           },
           { upsert: true } // Optional: If user doesn't exist, insert a new document
         );
    
        if (result.modifiedCount > 0) {
          res.status(200).send({ message: 'Profile successfully updated' });
        } else if (result.upsertedCount > 0) {
          res.status(201).send({ message: 'Profile successfully created' });
        } else {
          res.status(400).send({ message: 'No changes made to the profile' });
        }
      } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send({ message: 'Failed to update profile' });
      }
    });
    
    

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      if (result) {
        res.send(result);
    } else {
        res.status(404).send({ message: 'User not found' });
    }
    });
    // In your server-side route (userRoutes.js or memberships route)
app.get('/users', async (req, res) => {
  const email = req.query.email; // Get email from query parameter
  if (!email) {
    return res.status(400).json({ message: "Email query parameter is required" });
  }

  try {
    const userData =  await usersCollection.findOne({email:email})

    if (!userData) {
      return res.status(404).json({ message: "No user found for this email" });
    }

    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: "Error fetching memberships", error });
  }
});

    app.get("/user", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const data = req.body;
      const query = { email: email };
      const updatedDoc = {
        $set: {
          name: data.name,
          role: data.role,
        },
      };
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    
    // payment----------create-payment-intent------
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price;
      // generate client secret
      const priceCent = parseFloat(price) * 100;

      if (priceCent < 1) return;
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceCent,
        currency: "usd",

        automatic_payment_methods: {
          enabled: true,
        },
      });
      // and client secret as response`
      res.send({ clientSecret: client_secret });
    });
    // payment history
    app.post('/payment', async (req, res) => {
      const paymentHistory = req.body;
      const result = await paymentHistoryCollection.insertOne(paymentHistory);

      res.send(result)
    })
    // Handle membership payment
    app.post("/membership-payment", async (req, res) => {
  const { paymentInfo, membershipInfo } = req.body;
  console.log(req.body)

  try {
    // Insert payment info into Payment collection
    const payment = await paymentHistoryCollection.insertOne(paymentInfo);
    console.log("Payment inserted:", payment);
    const membershipsinfo = await membershipCollection.insertOne(membershipInfo);
    console.log("Membership info inserted:", membershipsinfo);
    

    res.status(200).json({
      message: "Membership and payment info saved successfully",
      payment,
      membershipsinfo,
    })
  } catch (error) {
    console.error("Error saving membership/payment info:", error);
    res.status(500).send("Server error");
  }
})
    // get all payment
    app.get('/paymentHistory',async(req,res)=>{
      const result = await paymentHistoryCollection.find().toArray();
      res.send(result);
    })
    
    // get payment history email
    app.get("/myHistory/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentHistoryCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const car = await carsCollection.findOne(query);
      res.send(car);
    });

    // bookings
    app.post("/bookings", async (req, res) => {
      try {
        const bookingData = req.body;
        const result = await bookingsCollection.insertOne(bookingData);
        res.send({ success: true, bookingId: result.insertedId });
      } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).send({ success: false, error: "Failed to create booking" });
      }
    });
    app.get("/bookings", async (req, res) => {
      try {
        const bookings = await bookingsCollection.find({}).toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ success: false, error: "Failed to fetch bookings" });
      }
    })
    // get booking
    app.get("/bookings/:bookingId", async (req, res) => {
      try {
        const bookingId = req.params.bookingId;
        
        // Validate bookingId format
        if (!ObjectId.isValid(bookingId)) {
          return res.status(400).send({ success: false, message: "Invalid booking ID format" });
        }

        const booking = await bookingsCollection.findOne({ _id: new ObjectId(bookingId) });
        if (booking) {
          res.send(booking);
        } else {
          res.status(404).send({ success: false, message: "Booking not found" });
        }
      } catch (error) {
        console.error("Error fetching booking:", error);
        res.status(500).send({ success: false, error: "Failed to fetch booking" });
      }
    });

    // Update a booking
    app.put("/bookings/:bookingId", async (req, res) => {
      try {
        const bookingId = req.params.bookingId;

       
        if (!ObjectId.isValid(bookingId)) {
          return res.status(400).send({ success: false, message: "Invalid booking ID format" });
        }

        const {
          email,
          phoneNumber,
          paymentMethod
        } = req.body; 
        // console.log(email, phoneNumber, paymentMethod);
        // console.log("Request body:", req.body);
        if (!email || !phoneNumber || !paymentMethod) {
          return res.status(400).send({ success: false, message: "Required fields missing." });
        }

        
        let driversLicenseUrl = '';
        if (req.files && req.files.driversLicense) {
          
          driversLicenseUrl = await uploadFile(req.files.driversLicense);
        }

        const updatedBooking = {
          email,
          phoneNumber,
          driversLicense: driversLicenseUrl,
          paymentMethod
        };

        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          { $set: updatedBooking }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ success: false, message: "Booking not found" });
        }

        res.send({ success: true, message: "Booking updated successfully" });
      } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).send({ success: false, error: "Failed to update booking" });
      }
    });


    //  API to send verification code
    app.post('/send-verification-code', async (req, res) => {
      const  email  = req.body.email;
      const query = { email: email };
      // console.log('email:', email);
      
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      const user = await usersCollection.findOne({ email });
      if (user) {
        await usersCollection.updateOne({ email }, { $set: { verificationCode, verificationCodeExpires: Date.now() + 3600000 } });
      } else {
        await usersCollection.insertOne({ email, verificationCode, verificationCodeExpires: Date.now() + 3600000 });
      }
    
      // Send the verification code to the user's email
      const mailOptions = {
        from: `UrbanDrive <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your Email Verification Code',
        text: `Your verification code is: ${verificationCode}`,
      };
    
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending verification email:', error);
          res.status(500).send({ success: false, message: 'Error sending verification email' });
        } else {
          console.log('Verification email sent:', info.response);
          res.send({ success: true, message: 'Verification email sent' });
        }
      });
    });

    // API to Verify Code
    app.post('/verify-code', async (req, res) => {
      const { email, code } = req.body;
    
      
      const user = await usersCollection.findOne({ email });
    
      
      if (user && user.verificationCode === code && user.verificationCodeExpires > Date.now()) {
        
        await usersCollection.updateOne(
          { email },
          { $unset: { verificationCode: "", verificationCodeExpires: "" }, $set: { isEmailVerified: true } }
        );
        res.send({ success: true, message: 'Email verified successfully' });
      } else {
        res.status(400).send({ success: false, message: 'Invalid or expired verification code' });
      }
    });

    // host car
    app.post("/hostCar", async (req, res) => {
      try {
        const hostCarData = req.body;
        const result = await hostCarCollection.insertOne(hostCarData);
        res.send({ success: true, message: "Car hosted successfully", carId: result.insertedId });
      } catch (error) {
        console.error("Error hosting car:", error);
        res.status(500).send({ success: false, error: "Failed to host car" });
      }
    });
    // get host car
    app.get("/hostCar", async (req, res) => {
      try {
        const hostCar = await hostCarCollection.find({}).toArray();
        res.send(hostCar);
      } catch (error) {
        console.error("Error fetching host cars:", error);
        res.status(500).send({ success: false, error: "Failed to fetch host cars" });
      }
    });
    
    
    // admin api

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: data.role,
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch('/users/profile/:id', async (req, res) => {
      const id = req.params.id; // Get the user ID from the request parameters
      const data = req.body; 
      // Get the data from the request body
    
      // Create a filter to find the user by ID
      const filter = { _id: new ObjectId(id) }; 
    
      // Prepare the updated document
      const updatedDoc = {
        $set: {
          name: data.name, // Update name
          email: data.email, // Update email
          phoneNumber: data.phoneNumber, // Update phone number
          profilePicture: req.file ? req.file.path : null, // Handle file upload path
        },
      };
    
      try {
        // Update the user in the database
        const result = await usersCollection.updateOne(filter, updatedDoc);
    
        // Check if any document was modified
        if (result.modifiedCount === 0) {
          return res.status(404).json({ message: 'User not found or no changes made' });
        }
    
        // Respond with the updated result
        res.json({ message: 'Profile updated successfully', result });
      } catch (error) {
        // Handle any errors
        res.status(500).json({ message: 'Error updating profile', error });
      }
    });

    app.get('/admin-stats',async(req,res) => {
      const hostCount = await usersCollection.countDocuments({ role: "Host" });

      const passengerCount = await usersCollection.countDocuments({
         role: { $nin: ["Admin", "Host"] },
      });

      const carCount = await carsCollection.countDocuments();

      // console.log(hostCount,passengerCount,carCount)

      res.send({hostCount, passengerCount, carCount})

    })
    // get all car
    app.get('/totalCars',async(req,res) => {
      const totalCar = await carsCollection.find().toArray();
      res.send(totalCar)
    })
    // delete specific car
    app.delete(
      "/cars/delete/:id",
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await carsCollection.deleteOne(query);
        res.send(result);
      }
    );
    // get all bookings
    app.get("/allBookings",async(req,res)=>{
      const result = await bookingsCollection.find().toArray();
      res.send(result)
    });

    await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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