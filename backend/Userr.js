const mongoose = require('mongoose')

const userschema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profileImage: {type:String},
    resetToken: { type: String, default: undefined }, 
    resetTokenExpiry: { type: Date, default: undefined }, 
});

module.exports = mongoose.model('users',userschema)