const express = require('express');
const router = express.Router();
const { createPaymentIntent, savePaymentHistory, getPaymentHistory } = require('../controllers/paymentController');

router.post('/create-payment-intent', createPaymentIntent);
router.post('/', savePaymentHistory);
router.get('/history/:email', getPaymentHistory);

module.exports = router;