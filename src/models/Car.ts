import mongoose, { Document, Schema } from 'mongoose';

export interface ICar {
  make: string;
  modelName: string;  
  year: number;
  price: number;
}

export interface ICarDocument extends ICar, Document {}

const CarSchema: Schema = new Schema<ICar>({
  make: { type: String, required: true },
  modelName: { type: String, required: true },  
  year: { type: Number, required: true },
  price: { type: Number, required: true },
});

export const CarModel = mongoose.model<ICarDocument>('Car', CarSchema);