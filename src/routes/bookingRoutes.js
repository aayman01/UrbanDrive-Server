const express = require('express');
const bookingController = require('../controllers/bookingController');
const router = express.Router();

router.post('/bookings', bookingController.createBooking);
router.get('/bookings', bookingController.getAllBookings);
router.get('/bookings/:bookingId', bookingController.getBookingById);

module.exports = router;
