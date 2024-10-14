const express = require('express');
const cors = require('cors');
require('dotenv').config();
const client = require('./src/config/database');

const carRoutes = require('./src/routes/carRoutes');
const userRoutes = require('./src/routes/userRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const hostCarRoutes = require('./src/routes/hostCarRoutes');
const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.use('/api', carRoutes);
app.use('/api', userRoutes);
app.use('/api', bookingRoutes);
app.use('/api', hostCarRoutes);

client.connect().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});