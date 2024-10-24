const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { MongoClient, ServerApiVersion, ObjectId, Long } = require("mongodb");
const { default: axios } = require("axios");

const app = express();
const port = process.env.PORT || 8000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
app.use(cors());

app.use(express.json());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false //true for live, false for sandbox

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const usersCollection = client.db("urbanDrive").collection("users");
    const carsCollection = client.db("urbanDrive").collection("cars");
    const bookingsCollection = client.db("urbanDrive").collection("bookings");
    const paymentHistoryCollection = client
      .db("urbanDrive")
      .collection("paymentHistory");
    const memberships = client.db("urbanDrive").collection("memberships");
    const membershipCollection = client
      .db("urbanDrive")
      .collection("membershipsInfo");
    const hostCarCollection = client.db("urbanDrive").collection("hostCar");
    const favoriteCarsCollection = client
      .db("urbanDrive")
      .collection("favoriteCars");
    const reviewsCollection = client.db("urbanDrive").collection("reviews");
    await carsCollection.createIndex({ location: "2dsphere" });

    const paymentSuccessMemberships = client.db("urbanDrive").collection("successMemberships");//payment success membership **

    app.get("/cars", async (req, res) => {
      const page = parseInt(req.query.page) || 1; // Default to 1 if not provided
      const limit = parseInt(req.query.limit) || 6;
      const skip = (page - 1) * limit;

      const categoryName = req.query.category || "";
      const minPrice = parseFloat(req.query.minPrice) || 0;
      const maxPrice =
        parseFloat(req.query.maxPrice) || Number.MAX_SAFE_INTEGER;
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

        // calculate average rating
        const CarsWithRatings = await Promise.all(
          Cars.map(async (car) => {
            const reviews = await reviewsCollection
              .find({ carId: car._id.toString() })
              .toArray();
            const totalRating = reviews.reduce(
              (sum, review) => sum + review.rating,
              0
            );
            const averageRating =
              reviews.length > 0 ? totalRating / reviews.length : 0;
            return { ...car, averageRating, reviewCount: reviews.length };
          })
        );

        // Include category averages if they exist, otherwise use default values
        const categoryAverages = CarsWithRatings.categoryAverages || {
          cleanliness: 0,
          communication: 0,
          comfort: 0,
          convenience: 0,
        };

        // Send the paginated data along with totalPages and totalCars
        // console.log("Incoming query parameters:", req.query);

        res.json({
          Cars: CarsWithRatings,
          totalCars,
          totalPages,
          totalCars,
          currentPage: page,
          categoryAverages,
        });
      } catch (error) {
        res.status(500).json({ message: "Server error", error });
      }
    });
    app.get("/cars/:id", async (req, res) => {
      try {
        const carId = req.params.id;
        const car = await carsCollection.findOne({ _id: new ObjectId(carId) });
        if (!car) {
          return res.status(404).json({ message: "Car not found" });
        }
        // Fetch reviews for this car
        const reviews = await reviewsCollection
          .find({ carId: carId.toString() })
          .toArray();
        const totalRating = reviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        const averageRating =
          reviews.length > 0 ? totalRating / reviews.length : 0;
        // Include category averages if they exist, otherwise use default values
        const categoryAverages = car.categoryAverages || {
          cleanliness: 0,
          communication: 0,
          comfort: 0,
          convenience: 0,
        };

        // Add average rating and review count to the car object
        const carWithRating = {
          ...car,
          averageRating,
          reviewCount: reviews.length,
          categoryAverages,
        };

        res.json(carWithRating);
      } catch (error) {
        console.error("Error fetching car details:", error);
        res.status(500).json({ message: "Failed to fetch car details" });
      }
    });

    app.post("/reviews", async (req, res) => {
      try {
        const reviewData = req.body;
        // const existingReview = await reviewsCollection.findOne({
        //   carId: reviewData.carId,
        //   userId: reviewData.userId
        // })
        // if(existingReview){
        //   return res.status(400).json({
        //     success: false,
        //     message: "You already reviewed this car" });
        // }

        reviewData.createdAt = new Date();
        // Store carId as a string
        reviewData.carId = reviewData.carId.toString();
        const result = await reviewsCollection.insertOne(reviewData);
        // Update the car's average rating
        const carId = reviewData.carId;
        const allReviews = await reviewsCollection
          .find({ carId: carId })
          .toArray();
        const totalRating = allReviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        const averageRating = totalRating / allReviews.length;

        // category wise rating
        const categoryRatings = {
          Cleanliness: 0,
          Communication: 0,
          Comfort: 0,
          Convenience: 0,
        };

        allReviews.forEach((review) => {
          if (review.ratingDetails) {
            Object.keys(categoryRatings).forEach((category) => {
              categoryRatings[category] += review.ratingDetails[category] || 0;
            });
          }
        });

        // Calculate final category averages
        Object.keys(categoryRatings).forEach((category) => {
          categoryRatings[category] =
            categoryRatings[category] / allReviews.length;
        });

        // allReviews.forEach(review =>{
        //   categoryRatings.Cleanliness += review.ratingDetails?.Cleanliness || 0;
        //   categoryRatings.Communication += review.ratingDetails?.Communication || 0;
        //   categoryRatings.Comfort += review.ratingDetails?.Comfort || 0;
        //   categoryRatings.Convenience += review.ratingDetails?.Convenience || 0;
        // })

        await carsCollection.updateOne(
          { _id: new ObjectId(carId) },
          {
            $set: {
              averageRating,
              reviewCount: allReviews.length,
              categoryRatings,
            },
          }
        );

        res
          .status(201)
          .json({ success: true, message: "Review submitted successfully" });
      } catch (error) {
        // console.error("Error submitting review:", error);
        res
          .status(500)
          .json({ success: false, message: "Failed to submit review" });
      }
    });

    // get reviews
    app.get("/reviews", async (req, res) => {
      try {
        const reviews = await reviewsCollection.find().toArray();
        res.json(reviews);
      } catch (error) {
        // console.error("Error fetching reviews:", error);
        res.status(500).json({ message: "Failed to fetch reviews",error });
      }
    });

    // get reviews by id
    app.get("/reviews/:carId", async (req, res) => {
      try {
        const carId = req.params.carId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const reviews = await reviewsCollection
          .find({ carId: carId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
        // console.log("Found reviews:", reviews.length);

        const totalReviews = await reviewsCollection.countDocuments({
          carId: carId,
        });
        const totalPages = Math.ceil(totalReviews / limit);
        // console.log("Fetching reviews for carId:", carId);

        const car = await carsCollection.findOne(
          { _id: new ObjectId(carId) },
          {
            projection: {
              averageRating: 1,
              reviewCount: 1,
              categoryRatings: 1,
            },
          }
        );
        // Adnan Note: Projection is used to get only the specified fields from the database and it is faster than using find()

        res.json({
          reviews,
          totalReviews,
          totalPages,
          currentPage: page,
          averageRating: car?.averageRating || 0,
          categoryRatings: car?.categoryRatings || {
            cleanliness: 0,
            communication: 0,
            convenience: 0,
          },
        });
      } catch (error) {
        // console.error("Error fetching reviews:", error);
        res.status(500).json({ message: "Failed to fetch reviews",error });
      }
    });

    app.get("/cars", async (req, res) => {
      const page = parseInt(req.query.page) || 1; // Default to 1 if not provided
      const limit = parseInt(req.query.limit) || 6;
      const skip = (page - 1) * limit;

      const categoryName = req.query.category || "";
      const minPrice = parseFloat(req.query.minPrice) || 0;
      const maxPrice =
        parseFloat(req.query.maxPrice) || Number.MAX_SAFE_INTEGER;
      const sortOption = req.query.sort || "";
      const seatCount = parseInt(req.query.seatCount) || null;
      const homePickup = req.query.homePickup || "";

      try {
        const query = {
          ...(categoryName && {
            category: { $regex: categoryName, $options: "i" },
          }),
          // ...(categoryName && { category: { $regex: categoryName, $options: 'i' } }),
          price: { $gte: minPrice, $lte: maxPrice },
          ...(seatCount && { seatCount: { $gte: seatCount } }),
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
        // console.log("Incoming query parameters:", req.query);

        res.json({ Cars, totalCars, totalPages, totalCars, currentPage: page });
      } catch (error) {
        res.status(500).json({ message: "Server error", error });
      }
    });

    app.get("/SearchCars", async (req, res) => {
      const { lng, lat, maxDistance, location } = req.query;
      // console.log("Request Params:", req.query);

      try {
        let query = {};

        if (location === "current" && lat && lng) {
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
          // console.log("Coordinates for search:", coordinates);
        } else if (location === "anywhere") {
          query = {};
        }


        const cars = await carsCollection.find(query).toArray();
        res.json(cars);

      } catch (error) {
        // console.log("Error fetching cars:", error);
        res.status(500).json({ message: "Server error", error });
      }
    });
    // app.get("/SearchCars", async (req, res) => {
    //   const { lng, lat, maxDistance, location } = req.query;

    //   try {
    //     let query = {};
    //     await collection.createIndex({ location: "2dsphere" });
    //     if (location === "current" && lat && lng) {
    //       const coordinates = [parseFloat(lng), parseFloat(lat)];
    //       const maxDistanceValue = parseInt(maxDistance) || 5000;

    //       if (isNaN(maxDistanceValue)) {
    //         return res.status(400).json({ message: "Invalid maxDistance value" });
    //       }
    //       if (isNaN(coordinates[0]) || isNaN(coordinates[1])) {
    //         return res.status(400).json({ message: "Invalid coordinates" });
    //       }
    //       query.location = {
    //         $near: {
    //           $geometry: {
    //             type: "Point",
    //             coordinates: coordinates,
    //           },
    //           $maxDistance: maxDistanceValue,
    //         },
    //       };

    //       console.log("Coordinates for search:", coordinates);
    //     } else if (location === "anywhere") {
    //       query = {}; // এখানে সমস্ত গাড়ি অনুসন্ধান করা হবে
    //     } else {
    //       return res.status(400).json({ message: "Invalid location parameter" });
    //     }

    //     const cars = await carsCollection.find(query).toArray();
    //     res.json(cars);

    //   } catch (error) {
    //     console.error("Error occurred:", error);
    //     res.status(500).json({ message: "Server error", error });
    //   }
    // });

    // get membership data
    app.get("/memberships", async (req, res) => {
      const data = await memberships.find().toArray();
      res.send(data)
    })

    app.get('/favoritesCars/:email', async (req, res) => {
      const email = req.params.email;
      const result = await favoriteCarsCollection.find({ email }).toArray();
      console.log('result:', result)
      if (result) {
        res.send(result);
      } else {
        res.status(404).send({ message: 'User not found' });
      }

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
    app.post("/favoritesCars", async (req, res) => {
      const carData = req.body;
      const userEmail = req.body.email;
      // console.log('carData:', carData);

      try {
        carData._id = new ObjectId(carData._id);
        const existingCar = await favoriteCarsCollection.findOne({
          _id: carData._id,
        });

        if (existingCar) {
          return res.status(400).send({ message: "Car already in favorites" });
        }
        const carWithEmail = {
          ...carData,
          email: userEmail,
        };
        const favoriteCar = await favoriteCarsCollection.insertOne(
          carWithEmail
        );
        res.send(favoriteCar);
      } catch (error) {
        // console.error("Error adding to favorites:", error);
        res.status(500).send({ message: "Internal server error",error });
      }
    });

    app.put("/user/profile", async (req, res) => {
      const { updateData } = req.body;
      const email = updateData.email;
      // console.log('email:', email)
      // console.log('UpdateProfile:', updateData);
      try {
        const existingUser = await usersCollection.findOne({ email: email });

        if (!existingUser) {
          return res.status(404).send({ message: "User not found" });
        }

        if (updateData.link) {
          const existingLinks = Array.isArray(updateData.link)
            ? updateData.link
            : [updateData.link];
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
            $set: {
              ...(updateData.Name && { Name: updateData.Name }),
              ...(updateData.photoURL && { photoURL: updateData.photoURL }),
              ...(updateData.language && { language: updateData.language }),
              ...(updateData.work && { work: updateData.work }),
              ...(updateData.phone && { phone: updateData.phone }),
              ...(updateData.link && {
                link: [
                  ...new Set([
                    ...(existingUser.link || []), // Keep existing links
                    ...(Array.isArray(updateData.link)
                      ? updateData.link
                      : [updateData.link]), // Add new links
                  ]),
                ],
              }), // Update link if present
            }, // Update the profile with new fields
          },
          { upsert: true } // Optional: If user doesn't exist, insert a new document
        );

        if (result.modifiedCount > 0) {
          res.status(200).send({ message: "Profile successfully updated" });
        } else if (result.upsertedCount > 0) {
          res.status(201).send({ message: "Profile successfully created" });
        } else {
          res.status(400).send({ message: "No changes made to the profile" });
        }
      } catch (error) {
        // console.error('Error updating profile:', error);
        res.status(500).send({ message: "Failed to update profile" });
      }
    });
    app.delete("/favoritesCars/:id", async (req, res) => {
      const carId = req.params.id;
      // console.log('carid:',carId)

      try {
        const carExists = await favoriteCarsCollection.findOne({
          _id: new ObjectId(carId),
        });
        // console.log('exist car:', carExists);
        // console.log('ObjectId:', new ObjectId(carId));

        if (!carExists) {
          return res
            .status(404)
            .send({ message: "Car not found in favorites" });
        }
        const result = await favoriteCarsCollection.deleteOne({
          _id: new ObjectId(carId),
        });
        // console.log('result:',result);

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ message: "Car not found in favorites" });
        }

        res.send({ message: "Car removed from favorites successfully" });
      } catch (error) {
        // console.error("Error removing from favorites:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      if (result) {
        res.send(result);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });
    app.get("/booking/:email", async (req, res) => {
      const email = req.params.email;
      const result = await bookingsCollection.find({ email }).toArray();
      // console.log('result:',result)
      if (result) {
        res.send(result);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });
    // In your server-side route (userRoutes.js or memberships route)
    app.get("/users", async (req, res) => {
      const email = req.query.email; // Get email from query parameter
      if (!email) {
        return res
          .status(400)
          .json({ message: "Email query parameter is required" });
      }

      try {
        const userData = await usersCollection.findOne({ email: email });

        if (!userData) {
          return res
            .status(404)
            .json({ message: "No user found for this email" });
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
    app.post("/payment", async (req, res) => {
      const paymentHistory = req.body;
      const result = await paymentHistoryCollection.insertOne(paymentHistory);

      res.send(result);
    });
    // Handle membership payment
    app.post("/membership-payment", async (req, res) => {
      const { paymentInfo, membershipInfo } = req.body;
      // console.log(req.body)

      try {
        // Insert payment info into Payment collection
        const payment = await paymentHistoryCollection.insertOne(paymentInfo);
        // console.log("Payment inserted:", payment);
        const membershipsinfo = await membershipCollection.insertOne(
          membershipInfo
        );
        // console.log("Membership info inserted:", membershipsinfo);

        res.status(200).json({
          message: "Membership and payment info saved successfully",
          payment,
          membershipsinfo,
        });
      } catch (error) {
        // console.error("Error saving membership/payment info:", error);
        res.status(500).send("Server error");
      }
    });
    // get all payment
    app.get("/paymentHistory", async (req, res) => {
      const result = await paymentHistoryCollection.find().toArray();
      res.send(result);
    });

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
        res
          .status(500)
          .send({ success: false, error: "Failed to create booking" });
      }
    });
    app.get("/bookings", async (req, res) => {
      try {
        const bookings = await bookingsCollection.find({}).toArray();
        res.send(bookings);
      } catch (error) {
        // console.error("Error fetching bookings:", error);
        res
          .status(500)
          .send({ success: false, error: "Failed to fetch bookings" });
      }
    });
    // get booking
    app.get("/bookings/:bookingId", async (req, res) => {
      try {
        const bookingId = req.params.bookingId;

        // Validate bookingId format
        if (!ObjectId.isValid(bookingId)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid booking ID format" });
        }

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(bookingId),
        });
        if (booking) {
          res.send(booking);
        } else {
          res
            .status(404)
            .send({ success: false, message: "Booking not found" });
        }
      } catch (error) {
        // console.error("Error fetching booking:", error);
        res
          .status(500)
          .send({ success: false, error: "Failed to fetch booking" });
      }
    });

    // Update a booking
    app.put("/bookings/:bookingId", async (req, res) => {
      try {
        const bookingId = req.params.bookingId;

        if (!ObjectId.isValid(bookingId)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid booking ID format" });
        }

        const { email, phoneNumber, paymentMethod } = req.body;
        // console.log(email, phoneNumber, paymentMethod);
        // console.log("Request body:", req.body);
        if (!email || !phoneNumber || !paymentMethod) {
          return res
            .status(400)
            .send({ success: false, message: "Required fields missing." });
        }

        let driversLicenseUrl = "";
        if (req.files && req.files.driversLicense) {
          driversLicenseUrl = await uploadFile(req.files.driversLicense);
        }

        const updatedBooking = {
          email,
          phoneNumber,
          driversLicense: driversLicenseUrl,
          paymentMethod,
        };

        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          { $set: updatedBooking }
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Booking not found" });
        }

        res.send({ success: true, message: "Booking updated successfully" });
      } catch (error) {
        // console.error("Error updating booking:", error);
        res
          .status(500)
          .send({ success: false, error: "Failed to update booking" });
      }
    });

    //  API to send verification code
    app.post("/send-verification-code", async (req, res) => {
      const email = req.body.email;
      const query = { email: email };
      // console.log('email:', email);

      const verificationCode = crypto.randomInt(100000, 999999).toString();
      const user = await usersCollection.findOne({ email });
      if (user) {
        await usersCollection.updateOne(
          { email },
          {
            $set: {
              verificationCode,
              verificationCodeExpires: Date.now() + 3600000,
            },
          }
        );
      } else {
        await usersCollection.insertOne({
          email,
          verificationCode,
          verificationCodeExpires: Date.now() + 3600000,
        });
      }

      // Send the verification code to the user's email
      const mailOptions = {
        from: `UrbanDrive <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your Email Verification Code",
        text: `Your verification code is: ${verificationCode}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          // console.error("Error sending verification email:", error);
          res
            .status(500)
            .send({
              success: false,
              message: "Error sending verification email",
            });
        } else {
          // console.log("Verification email sent:", info.response);
          res.send({ success: true, message: "Verification email sent" });
        }
      });
    });

    // API to Verify Code
    app.post("/verify-code", async (req, res) => {
      const { email, code } = req.body;

      const user = await usersCollection.findOne({ email });

      if (
        user &&
        user.verificationCode === code &&
        user.verificationCodeExpires > Date.now()
      ) {
        await usersCollection.updateOne(
          { email },
          {
            $unset: { verificationCode: "", verificationCodeExpires: "" },
            $set: { isEmailVerified: true },
          }
        );
        res.send({ success: true, message: "Email verified successfully" });
      } else {
        res
          .status(400)
          .send({
            success: false,
            message: "Invalid or expired verification code",
          });
      }
    });

    // host car
    app.post("/hostCar", async (req, res) => {
      try {
        const hostCarData = req.body;
        const result = await hostCarCollection.insertOne(hostCarData);
        res.send({
          success: true,
          message: "Car hosted successfully",
          carId: result.insertedId,
        });
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
        res
          .status(500)
          .send({ success: false, error: "Failed to fetch host cars" });
      }
    });

    // -----------------------ssl commarze start----------------
    //1.init payment
    //2.post Request---url: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
    // 3. save data in database
    // 4. if payment success and then update database
    // 5. if payment is not success and fail
    // sslCommarze create payment-------------------------------

    // booking cars
    app.post("/booking-create-payment", async (req, res) => {
      const paymentInfo = req.body;
      const trxId = new ObjectId().toString();
      // console.log(paymentInfo);
      const intentData = {
        store_id,
        store_passwd,
        total_amount: paymentInfo?.price,
        currency: paymentInfo?.currency || "BDT",
        tran_id: trxId,
        success_url: "https://urban-driveserver.vercel.app/success-booking",
        fail_url: "https://urban-driveserver.vercel.app/fail",
        cancel_url: "https://urban-driveserver.vercel.app/cancel",
        emi_option: 0,
        cus_name: paymentInfo?.name,
        cus_email: paymentInfo?.email,
        cus_add1: "Address Line 1",
        cus_city: "City",
        cus_postcode: "1234",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        shipping_method: "NO",
        product_name: paymentInfo?.carDetails?.make || "car",
        product_category: "General",
        product_profile: "general",
      };

      const response = await axios({
        method: "POST",
        url: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
        data: intentData,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      // console.log(response);
      // save data in database
      const saveData = {
        cus_name: paymentInfo?.name,
        cus_email: paymentInfo?.email,
        cus_phoneNumber: paymentInfo?.phoneNumber,
        driversLicense: paymentInfo?.driversLicense,
        product_name: paymentInfo?.bookingDetails?.carDetails?.make || "Car",
        amount: paymentInfo?.price,
        currency: paymentInfo?.currency || "BDT",
        paymentId: trxId,
        startDate: paymentInfo.bookingDetails?.startDate,
        endDate: paymentInfo.bookingDetails?.endDate,
        bookingDetailsId: paymentInfo.bookingDetails?._id,
        location: paymentInfo.bookingDetails?.location,
        status: paymentInfo.bookingDetails?.status,
        includedDriver: paymentInfo.bookingDetails?.includedDriver,
        carDetails: paymentInfo?.bookingDetails?.carDetails,
      };
      const result = await bookingsCollection.insertOne(saveData);
      if (result) {
        res.send({
          paymentUrl: response.data.GatewayPageURL,
        });
      }
    });
    // success-payment
    app.post("/success-booking", async (req, res) => {
      const successData = req.body;
      // console.log(successData);
      if (successData.status !== "VALID") {
        throw new Error("unauthorize payment , invalid payment");
      }
      // update the database
      const query = {
        paymentId: successData.tran_id,
      };
      const update = {
        $set: {
          status: "Success",
          tran_date: successData.tran_date,
          card_type: successData.card_type,
        },
      };
      const updateData = await bookingsCollection.updateOne(query, update);
      // console.log(updateData);
      res.redirect("https://cheery-bubblegum-eecb30.netlify.app/success");
    });

    // membarship-------------------------
    app.post("/create-payment", async (req, res) => {
      const paymentInfo = req.body;
      const trxId = new ObjectId().toString();
      const intentData = {
        store_id,
        store_passwd,
        total_amount: paymentInfo?.price,
        currency: paymentInfo?.currency || "BDT",
        tran_id: trxId,
        success_url: "https://urban-driveserver.vercel.app/success-payment",
        fail_url: "https://urban-driveserver.vercel.app/fail",
        cancel_url: "https://urban-driveserver.vercel.app/cancel",
        emi_option: 0,
        cus_name: paymentInfo?.name,
        cus_email: paymentInfo?.email,
        cus_add1: "Address Line 1",
        cus_city: "City",
        cus_postcode: "1234",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        shipping_method: "NO",
        product_name:
          paymentInfo?.productName || paymentInfo?.planName || "car",
        product_category: "General",
        product_profile: "general",
      };

      const response = await axios({
        method: "POST",
        url: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
        data: intentData,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      // console.log(response);
      // save data in database
      const saveData = {
        cus_name: paymentInfo?.name,
        cus_email: paymentInfo?.email,
        product_name: paymentInfo?.productName || "Car",
        amount: paymentInfo?.price,
        currency: paymentInfo?.currency || "BDT",
        paymentId: trxId,
        status: "Pending",
        expiryDate: paymentInfo.expiryDate,
        purchaseDate: paymentInfo.purchaseDate,
        planName: paymentInfo.planName,
      };
      const result = await paymentSuccessMemberships.insertOne(saveData);
      if (result) {
        res.send({
          paymentUrl: response.data.GatewayPageURL,
        });
      }
    });
    // success-payment
    app.post("/success-payment", async (req, res) => {
      const successData = req.body;
      if (successData.status !== "VALID") {
        throw new Error("unauthorize payment , invalid payment");
      }
      // update the database
      const query = {
        paymentId: successData.tran_id,
      };
      const update = {
        $set: {
          status: "Success",
          tran_date: successData.tran_date,
          card_type: successData.card_type,
        },
      };
      const updateData = await paymentSuccessMemberships.updateOne(
        query,
        update
      );
      // console.log(updateData);
      res.redirect("https://cheery-bubblegum-eecb30.netlify.app/success");
    });
    // fail-payment
    app.post("/fail", async (req, res) => {
      res.redirect("https://cheery-bubblegum-eecb30.netlify.app/fail");
    });
    // cancel-payment
    app.post("/cancel", async (req, res) => {
      res.redirect("https://cheery-bubblegum-eecb30.netlify.app/cancel");
    });

    // get paymentSuccess data
    app.get("/memberships-data", async (req, res) => {
      const result = await paymentSuccessMemberships.find().toArray();
      res.send(result);
    });

    // get payment history email
    app.get("/myPaymentHistory/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentSuccessMemberships.find(query).toArray();
      res.send(result);
    });
    // -----------------------ssl commarze end----------------

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

    app.patch("/users/profile/:id", async (req, res) => {
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
          return res
            .status(404)
            .json({ message: "User not found or no changes made" });
        }

        // Respond with the updated result
        res.json({ message: "Profile updated successfully", result });
      } catch (error) {
        // Handle any errors
        res.status(500).json({ message: "Error updating profile", error });
      }
    });

    app.get("/admin-stats", async (req, res) => {
      const hostCount = await usersCollection.countDocuments({ role: "Host" });

      const passengerCount = await usersCollection.countDocuments({
        role: { $nin: ["Admin", "Host"] },
      });

      const carCount = await carsCollection.countDocuments();

      // console.log(hostCount,passengerCount,carCount)

      res.send({ hostCount, passengerCount, carCount });
    });
    // get all car
    app.get("/totalCars", async (req, res) => {
      const totalCar = await carsCollection.find().toArray();
      res.send(totalCar);
    });
    // delete specific car
    app.delete("/cars/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await carsCollection.deleteOne(query);
      res.send(result);
    });
    // get all bookings
    app.get("/allBookings", async (req, res) => {
      const result = await bookingsCollection.find().toArray();
      res.send(result);
    });

    app.get("/recent-bookings", async (req, res) => {
      const recentBookings = await bookingsCollection
        .find()
        .sort({ startDate: -1 })
        .limit(4)
        .toArray();
      res.send(recentBookings);
    });

    // await client.db("admin").command({ ping: 1 });
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