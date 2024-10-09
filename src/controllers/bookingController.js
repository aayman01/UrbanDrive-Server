const bookingsCollection = require('../config/db').db("urbanDrive").collection("bookings");

exports.createBooking = async (req, res) => {
  const booking = req.body;
  const result = await bookingsCollection.insertOne(booking);
  res.send({ success: true, bookingId: result.insertedId });
};

exports.getAllBookings = async (req, res) => {
  const bookings = await bookingsCollection.find().toArray();
  res.send(bookings);
};

exports.getBookingById = async (req, res) => {
  const { bookingId } = req.params;

  if (!ObjectId.isValid(bookingId)) {
    return res.status(400).send({ success: false, message: "Invalid booking ID format" });
  }

  const booking = await bookingsCollection.findOne({ _id: new ObjectId(bookingId) });
  res.send(booking);
};
