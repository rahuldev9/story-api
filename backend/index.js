const express = require("express");
var nodemailer = require('nodemailer');
const cors = require("cors");
require("./config");
const User = require("./Userr");
const Product = require("./Products");
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require("jsonwebtoken");

require('dotenv').config();
const PORT = process.env.PORT || 5000
const JWT_SECRET = process.env.JWT_SECRET;



const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
  },
});

const app = express();

const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads"); // Directory to store uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Unique file name
  },
});
const upload = multer({ storage });

const path = require("path");

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.json());

app.use(cors({
    origin: "https://story-api-pgo4.onrender.com", // Correct URL for your frontend
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Allow all common HTTP methods
    credentials: true // Allow credentials (cookies, authorization headers, etc.)
}));


app.get('/',(req,res)=>{
  res.json("hello")
})
app.post("/register", async (req, resp) => {
  try {
      const { name, email, password } = req.body;

      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
          return resp.status(400).send({ error: "Email already exists" });
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Save the user with the hashed password
      let user = new User({ name, email, password: hashedPassword });
      let result = await user.save();

      result = result.toObject();
      delete result.password; // Remove the password from the response

      // Generate JWT
      jwt.sign({ result }, JWT_SECRET, { expiresIn: "4h" }, (err, token) => {
          if (err) {
              return resp.status(500).send("Something went wrong!");
          }
          resp.send({ result, auth: token });
      });
  } catch (error) {
      resp.status(500).send("Error occurred while registering user");
  }
});


app.post("/login", async (req, resp) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      return resp.status(404).json({ error: "User not found" }); // Return JSON response
    }

    // Compare the entered password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return resp.status(401).json({ error: "Invalid credentials" }); // Return JSON response
    }

    // Remove password from user object
    user = user.toObject();
    delete user.password;

    // Generate JWT
    jwt.sign({ user }, JWT_SECRET, { expiresIn: "4h" }, (err, token) => {
      if (err) {
        return resp.status(500).json({ error: "Something went wrong!" }); // Return JSON response
      }
      resp.json({ user, auth: token }); // Success response in JSON
    });
  } catch (error) {
    console.error("Login Error:", error); // Log the error for debugging
    resp.status(500).json({ error: "An error occurred while logging in" }); // Return JSON response
  }
});

app.post('/forgot-password', async (req, resp) => {
  const { email } = req.body;

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    return resp.status(404).send('User not found');
  }


  // Generate a reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Save the reset token hash and expiry time
  user.resetToken = resetTokenHash;
  user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes expiry time

  try {
    await user.save();

    // Send reset link to the user via email
    const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;
    const message = `You requested a password reset. Please visit the following link to reset your password: ${resetUrl}`;

    try {
      await transporter.sendMail({
        to: user.email,
        subject: 'Password Reset',
        text: message,
      });
      resp.send('Reset link sent to your email');
    } catch (error) {
      // In case of an error while sending the email, clear the reset token
      console.error('Error sending email:', error);
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();
      resp.status(500).send('Error sending email');
    }
  } catch (error) {
    console.error('Error saving user:', error);
    resp.status(500).send('Error saving reset token');
  }
});



app.post('/reset-password/:token', async (req, resp) => {
  const { token } = req.params; // Token from URL parameter
  const { password } = req.body; // Password from the request body

  // Hash the received token to match with the stored hashed token
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Find the user by matching the hashed token and ensuring it's not expired
  const user = await User.findOne({
    resetToken: tokenHash,
    resetTokenExpiry: { $gt: Date.now() }, // Ensure token hasn't expired
  });

  if (!user) {
    console.log('No user found or token expired');
    return resp.status(400).json({ message: 'Invalid or expired token' }); // Send JSON response on failure
  }

  // Hash the new password before saving it
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(password, salt);

  // Clear the reset token and expiration time after password reset
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();

  resp.json({ message: 'Password reset successful' }); // Send JSON response on success
});



app.post("/add-product", verifytoken,upload.single("image"), async (req, res) => {
  try {
    const { message, userid ,name,time} = req.body;

    // Create and save the product
    const product = new Product({
      message,
      userid,
      name,
      time
    });
    await product.save();

    res.status(201).json({ message: "Product added successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Error adding product", error });
  }
});


app.get("/products/:userid", verifytoken, async (req, resp) => {
  const { userid } = req.params; // Extract userid from request parameters

  try {
    // Use the where condition to find products by userid
    let products = await Product.find({ userid: userid }); // Query by userid field

    if (products.length > 0) {
      resp.send(products);
    } else {
      resp.send({ result: "No products found for this user" });
    }
  } catch (error) {
    // Handle errors
    resp
      .status(500)
      .send({ error: "An error occurred while fetching products" });
  }
});

app.get("/home", verifytoken, async (req, resp) => {
  try {
    let products = await Product.find({});

    if (products.length > 0) {
      resp.send(products);
    } else {
      resp.send({ result: "No products found for this user" });
    }
  } catch (error) {
    resp
      .status(500)
      .send({ error: "An error occurred while fetching products" });
  }
});

const fs = require("fs").promises;

app.delete("/product/:id", verifytoken, async (req, resp) => {
  try {
    // Find the product by ID
    const product = await Product.findById(req.params.id);

    if (!product) {
      return resp.status(404).send({ message: "Product not found" });
    }

    // Delete the product from the database
    const result = await Product.deleteOne({ _id: req.params.id });
    resp.status(200).send({ message: "Product deleted successfully", result });
  } catch (error) {
    console.error("Error deleting product:", error);
    resp.status(500).send({ message: "Error deleting product", error });
  }
});

app.get("/product/:id", verifytoken, async (req, resp) => {
  let result = await Product.findOne({ _id: req.params.id });
  if (result) {
    resp.send(result);
  } else {
    resp.send({ result: "no result found" });
  }
});

app.put(
  "/product/:id",
  verifytoken,
  upload.single("image"),
  async (req, resp) => {
    try {
      const product = await Product.findById(req.params.id);

      if (!product) {
        return resp.status(404).send({ message: "Product not found" });
      }

      let updatedData = {
        message: req.body.message
      };

      const result = await Product.updateOne(
        { _id: req.params.id },
        { $set: updatedData }
      );

      resp
        .status(200)
        .send({ message: "Product updated successfully", result });
    } catch (error) {
      console.error("Error updating product:", error);
      resp.status(500).send({ message: "Error updating product", error });
    }
  }
);

app.get("/search/:key", verifytoken, async (req, resp) => {
  let result = await Product.find({
    $or: [
      { message: { $regex: req.params.key } },
      { name: { $regex: req.params.key } },
      // { category: { $regex: req.params.key } },
      // { price: { $regex: req.params.key } },
    ],
  });
  resp.send(result);
});

function verifytoken(req, resp, next) {
  let token = req.headers["authorization"];
  if (token) {
    token = token.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, vaild) => {
      if (err) {
        resp.status(401).send({ result: "please provide token" });
      } else {
        next();
      }
    });
  } else {
    resp.status(403).send({ result: "please add token with header" });
  }
}


app.put("/profile/:id", verifytoken, upload.single("profileImage"), async (req, resp) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return resp.status(404).send({ message: "User not found" });
    }

    let updatedData = {};
    if (req.file) {
      const newImagePath = `uploads/${req.file.filename}`;
      updatedData.profileImage = newImagePath;

      if (user.profileImage) {
        const oldImagePath = path.resolve(__dirname, user.profileImage);
        try {
          await fs.unlink(oldImagePath);
          console.log("Old profile image deleted:", user.profileImage);
        } catch (err) {
          console.error("Error deleting old profile image:", err.message);
        }
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updatedData },
      { new: true }
    ).select("-password"); // Exclude the password field from the response

    if (!updatedUser) {
      return resp.status(500).send({ message: "Failed to update profile image" });
    }

    resp.status(200).send({
      message: "Profile image updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile image:", error);
    resp.status(500).send({ message: "Error updating profile image", error: error.message });
  }
});



app.put('/like-product/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.body.userId; // User ID passed in the request body
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send({ message: 'Product not found' });
        }

        if (product.likedBy.includes(userId)) {
            // If user has already liked, remove the like (dislike)
            product.likes -= 1;
            product.likedBy = product.likedBy.filter((id) => id.toString() !== userId);
        } else {
            // If user hasn't liked yet, add the like
            product.likes += 1;
            product.likedBy.push(userId);
        }

        await product.save();
        res.status(200).send({ likes: product.likes, likedBy: product.likedBy });
    } catch (err) {
        res.status(500).send({ message: 'Error updating like count', error: err });
    }
});











app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
