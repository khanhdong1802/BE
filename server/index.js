require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRouter = require("./routes/auth");
const adminCategoryRouter = require("./routes/admin/category");
const adminUserRouter = require("./routes/admin/user");
const transactionHistoryRouter = require("./routes/TransactionHistory");
const app = express();

// Đảm bảo bật CORS trước khi xử lý các middleware khác
app.use(cors());

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "");
    console.log("✅ Kết nối MongoDB thành công");
  } catch (error) {
    console.error("❌ Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }
};

connectDB();

app.use(express.json()); // ✅ để xử lý req.body

app.use("/api/auth", authRouter); // ✅ sử dụng route
app.use("/api/admin/categories", adminCategoryRouter);
app.use("/api/admin/users", adminUserRouter);
app.use("/api/transactions", transactionHistoryRouter);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
