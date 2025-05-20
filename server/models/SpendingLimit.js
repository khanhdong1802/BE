const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SpendingLimitSchema = new Schema({
  user_id: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  months: {
    type: Number,
    default: 1, // 1, 3, 6, 12 tháng
  },
  note: {
    type: String,
    default: "",
  },
  start_date: {
    type: Date,
    default: Date.now,
  },
  end_date: {
    type: Date,
  },
  active: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("SpendingLimit", SpendingLimitSchema);
