const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const WithdrawSchema = new Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  source: {
    type: String,
    required: true,
  },
  note: {
    type: String,
    default: "",
  },
  withdraw_date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Withdraw", WithdrawSchema);
