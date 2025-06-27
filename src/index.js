require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const brochureRoutes = require("./routes/brochure");
const paymentRoutes = require("./routes/payment");
const contactRoutes = require("./routes/contact");
const formsRoutes = require("./routes/forms");

const app = express();

// ✅ CORS Configuration
const allowedOrigins = [
  "http://localhost:3000",
  "https://tradingwalla.com",
  "https://secure.payu.in",
  "https://test.payu.in",
];

const corsOptions = {
  origin: function (origin, callback) {
    // ✅ Allow if:
    // - no origin (like in direct server-to-server calls from PayU)
    // - or it's from allowed frontend
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("Blocked by CORS:", origin);
      callback(null, false); // or: callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// ✅ Middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Special handling for PayU callbacks
app.use((req, res, next) => {
  if (req.headers.origin === 'https://secure.payu.in' || req.headers.origin === 'https://test.payu.in') {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  next();
}); // Enable preflight requests for all routes
app.use(express.json());

// ✅ Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log("Request Headers:", req.headers);
  console.log("Request Body:", req.body);
  next();
});

// ✅ Root Test Route
app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Stock Website Backend API",
    endpoints: {
      test: "/test",
      brochure: "/api/brochure",
      payment: "/api/payment",
      contact: "/api/contact",
    },
  });
});

app.get("/test", (req, res) => {
  res.json({
    status: "success",
    message: "Server is working properly!",
    timestamp: new Date().toISOString(),
  });
});

// ✅ MongoDB Connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/stock_website";

console.log("Attempting to connect to MongoDB...");
console.log("MongoDB URI:", MONGODB_URI);

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Successfully connected to MongoDB.");
    console.log("MongoDB URI:", MONGODB_URI);

    // Test Mongo connection
    const TestModel = mongoose.model(
      "Test",
      new mongoose.Schema({ test: String })
    );
    return TestModel.create({ test: "connection_test" })
      .then(() => {
        console.log("Successfully created test document");
        return TestModel.deleteOne({ test: "connection_test" });
      })
      .then(() => {
        console.log("Cleaned up test document");
      });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// ✅ Routes
app.use("/api/brochure", brochureRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/forms", formsRoutes);

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    message: "Something went wrong!",
    error: err.message,
  });
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test the server at: http://localhost:${PORT}/test`);
});

