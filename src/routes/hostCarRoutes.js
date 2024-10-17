const express = require('express');
const router = express.Router();
const { createHostCar, getHostCar } = require('../controllers/hostCarController');

router.post('/hostCar', createHostCar);
router.get('/hostCar', getHostCar);

module.exports = router;