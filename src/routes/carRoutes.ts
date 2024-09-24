import express from 'express';
import { getCars, getCar, addCar, updateCar, deleteCar } from '../controller/carController';

const router = express.Router();

router.route('/').get(getCars).post(addCar);
router.route('/:id').get(getCar).put(updateCar).delete(deleteCar);

export default router;