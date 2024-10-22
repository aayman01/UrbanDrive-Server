const express = require('express');
const carController = require('../controllers/carControllers');
const router = express.Router();

router.get('/cars', carController.getCars);
router.get('/cars/:id', carController.getCarById);
router.get('/totalCars', carController.getTotalCars);

module.exports = router;
