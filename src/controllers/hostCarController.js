const hostCarCollection = require('../config/db').db("urbanDrive").collection("hostCar");

exports.createHostCar = async (req, res) => {
    try {
      const hostCarData = req.body;
      const result = await hostCarCollection.insertOne(hostCarData);
      res.send({ success: true, message: "Car hosted successfully", carId: result.insertedId });
    } catch (error) {
      console.error("Error hosting car:", error);
      res.status(500).send({ success: false, error: "Failed to host car" });
    }
  }
  exports.getHostCar = async (req, res) => {
    try {
      const hostCar = await hostCarCollection.find({}).toArray();
      res.send(hostCar);
    } catch (error) {
      console.error("Error fetching host cars:", error);
      res.status(500).send({ success: false, error: "Failed to fetch host cars" });
    }
  }
