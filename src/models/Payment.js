const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  whatsapp: {
    type: String,
  },
  amount: {
    type: Number,
    required: true,
  },
  txnid: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    required: true,
    enum: ["pending", "succeeded", "failed"],
    default: "pending",
  },
  formType: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Payment", paymentSchema);
