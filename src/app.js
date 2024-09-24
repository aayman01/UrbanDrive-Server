const express = require('express');
require('dotenv').config();
const cors = require('cors');
// const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json());
// app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);

// Connect to DB and start server
connectDB();

