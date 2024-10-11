const carsCollection = require('../config/db').db("urbanDrive").collection("cars");

exports.getCars = async (req, res) => {
  const { page = 1, limit = 6, category = "", minPrice = 0, maxPrice = Number.MAX_SAFE_INTEGER, sort, seatCount } = req.query;
  const skip = (page - 1) * limit;

  try {
    const query = {
      ...(category && { category: { $regex: category, $options: 'i' } }),
      price: { $gte: parseFloat(minPrice), $lte: parseFloat(maxPrice) },
      ...(seatCount && { seatCount: { $gte: parseInt(seatCount) } }),
    };

    let sortOption = {};
    if (sort === 'price-asc') sortOption = { price: 1 };
    else if (sort === 'price-desc') sortOption = { price: -1 };
    else if (sort === 'date-asc') sortOption = { date: 1 };
    else if (sort === 'date-desc') sortOption = { date: -1 };

    const totalCars = await carsCollection.countDocuments();
    const cars = await carsCollection.find(query).sort(sortOption).skip(skip).limit(parseInt(limit)).toArray();

    const totalPages = Math.ceil(totalCars / limit);

    res.json({ cars, totalCars, totalPages, currentPage: page });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
