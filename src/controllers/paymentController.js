const { getDb } = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createPaymentIntent = async (req, res) => {
  const { price } = req.body;
  const priceCent = parseFloat(price) * 100;

  if (priceCent < 1) {
    return res.status(400).send({ error: 'Invalid price' });
  }

  try {
    const { client_secret } = await stripe.paymentIntents.create({
      amount: priceCent,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
    });
    res.send({ clientSecret: client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).send({ error: 'Failed to create payment intent' });
  }
};

const savePaymentHistory = async (req, res) => {
  const db = getDb();
  const paymentHistoryCollection = db.collection("paymentHistory");
  
  const paymentHistory = req.body;
  try {
    const result = await paymentHistoryCollection.insertOne(paymentHistory);
    res.send(result);
  } catch (error) {
    console.error("Error saving payment history:", error);
    res.status(500).send({ error: 'Failed to save payment history' });
  }
};

const getPaymentHistory = async (req, res) => {
  const db = getDb();
  const paymentHistoryCollection = db.collection("paymentHistory");
  
  const { email } = req.params;
  try {
    const result = await paymentHistoryCollection.find({ email }).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).send({ error: 'Failed to fetch payment history' });
  }
};

module.exports = {
  createPaymentIntent,
  savePaymentHistory,
  getPaymentHistory
};