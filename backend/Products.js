const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  userid: {
    type: mongoose.Schema.Types.ObjectId,  // Reference to User model
    ref: 'Users',  // Correct reference to the User model
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  likes: {
    type: Number,
    default: 0, // Initialize with 0 likes
  },
  likedBy: {
    type: [mongoose.Schema.Types.ObjectId],  // Array of User IDs who have liked the product
    ref: 'Users',  // Reference to the User model
    default: [], // Initialize with an empty array
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // Expire after 1 day (86400 seconds)
  },
}, 
{ timestamps: true });

module.exports = mongoose.model('Product', productSchema);
