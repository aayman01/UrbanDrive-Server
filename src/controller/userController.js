// const { db } = require('../config/db');

// const usersCollection = db.collection('users');

// saveUser = async (req, res) => {
//   const user = req.body;
//   const query = { email: user?.email };
//   const isExist = await usersCollection.findOne(query);

//   if (isExist) {
//     if (user.status === 'Requested') {
//       const result = await usersCollection.updateOne(query, {
//         $set: { status: user?.status },
//       });
//       return res.send(result);
//     } else {
//       return res.send(isExist);
//     }
//   }

//   const updateDoc = { $set: { ...user, timestamp: Date.now() } };
//   const result = await usersCollection.updateOne(query, updateDoc, { upsert: true });
//   res.send(result);
// };

// module.exports = { saveUser };
