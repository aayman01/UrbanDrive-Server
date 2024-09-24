import { Request, Response } from 'express';
import { CarModel } from '../models/Car';
import { asyncHandler } from '../utils/asyncHandler';

export const getCars = asyncHandler(async (req: Request, res: Response) => {
    const sortField = req.query.sortField?.toString() || 'price'; 
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1; 
  
    const cars = await CarModel.find().sort({ [sortField]: sortOrder });
  
    res.json(cars);
  });
  

export const getCar = asyncHandler(async (req: Request, res: Response) => {
  const car = await CarModel.findById(req.params.id);
  if (!car) {
    res.status(404);
    throw new Error('Car not found');
  }
  res.json(car);
});

export const addCar = asyncHandler(async (req: Request, res: Response) => {
  const newCar = new CarModel(req.body);
  const savedCar = await newCar.save();
  res.status(201).json(savedCar);
});

export const updateCar = asyncHandler(async (req: Request, res: Response) => {
  const updatedCar = await CarModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updatedCar) {
    res.status(404);
    throw new Error('Car not found');
  }
  res.json(updatedCar);
});

export const deleteCar = asyncHandler(async (req: Request, res: Response) => {
  const deletedCar = await CarModel.findByIdAndDelete(req.params.id);
  if (!deletedCar) {
    res.status(404);
    throw new Error('Car not found');
  }
  res.json({ message: 'Car deleted successfully' });
});