const express = require('express');
const cors = require('cors');
require('dotenv').config();
const client = require('./config/db');

const carRoutes = require('./routes/carRoutes');
const userRoutes = require('./routes/userRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.use('/api', carRoutes);
app.use('/api', userRoutes);
app.use('/api', bookingRoutes);

client.connect().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});
