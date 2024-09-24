import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db';
import carRoutes from './routes/carRoutes';
// import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// Connect to MongoDB
connectDB();

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'], 
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/cars', carRoutes);

// Error handling middleware
// app.use(errorHandler);

app.get('/', (req, res) => {
  res.send('Hello from UrbanDrive Server..');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});