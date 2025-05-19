const express = require("express");
const router = express.Router();
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const Income = require("../models/Income");
const Withdraw = require("../models/Withdraw");
const Expense = require("../models/Expense");
const User = require("../models/User");

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  // Kiểm tra đầu vào
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
  }

  try {
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email đã được sử dụng" });
    }

    // Mã hóa mật khẩu với argon2
    const hashedPassword = await argon2.hash(password);

    // Tạo người dùng mới
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    // Tạo token JWT
    const accessToken = jwt.sign(
      { userId: newUser._id },
      process.env.ACCESS_TOKEN_SECRET
    );
    res
      .status(201)
      .json({ success: true, message: "Đăng ký thành công", accessToken });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Email không đúng" });
    }

    const passwordValid = await argon2.verify(user.password, password);
    if (!passwordValid) {
      return res
        .status(400)
        .json({ success: false, message: "Mật khẩu không đúng" });
    }

    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_TOKEN_SECRET
    );

    // Lưu thông tin người dùng (name, email) vào localStorage trong frontend
    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      accessToken,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name, // Chắc chắn rằng bạn truyền name cùng email
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// ========================
// POST /api/income
// ========================
router.post("/Income", async (req, res) => {
  const { user_id, amount, source, received_date, note, status } = req.body;

  if (!user_id || !amount || !source || !received_date) {
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
  }

  try {
    const income = new Income({
      user_id,
      amount,
      source,
      received_date,
      note,
      status: status || "pending",
    });

    await income.save();
    res.status(201).json({ message: "Thu nhập đã được lưu", income });
  } catch (err) {
    console.error("❌ Lỗi khi lưu thu nhập:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

// ========================
// GET /api/income/total/:userId
// ========================
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId; // Lấy ObjectId từ mongoose

router.get("/Income/total/:userId", async (req, res) => {
  const rawUserId = req.params.userId;
  const userId = rawUserId.trim(); // loại bỏ \n, khoảng trắng thừa

  console.log("📌 Cleaned userId:", userId);

  try {
    const total = await Income.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          status: "pending",
        },
      },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);

    res.json({ total: total[0]?.totalAmount || 0 });
  } catch (err) {
    console.error("❌ Lỗi tính tổng thu nhập:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

// ========================
// POST /api/withdraw
// ========================
// Đường dẫn này sẽ xử lý việc rút tiền
router.post("/Withdraw", async (req, res) => {
  const { user_id, amount, source, note } = req.body;

  if (!user_id || !amount || !source) {
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
  }
  if (!mongoose.Types.ObjectId.isValid(user_id)) {
    return res.status(400).json({ message: "user_id không hợp lệ" });
  }

  try {
    // Kiểm tra số dư tài khoản trước khi rút
    const totalIncomeArr = await Income.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(user_id),
          status: "pending",
        },
      },
      {
        $group: { _id: null, total: { $sum: "$amount" } },
      },
    ]);
    const totalExpenseArr = await Expense.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(user_id),
        },
      },
      {
        $group: { _id: null, total: { $sum: "$amount" } },
      },
    ]);

    const income = totalIncomeArr[0]?.total || 0;
    const expense = totalExpenseArr[0]?.total || 0;
    const currentBalance = income - expense;

    console.log(
      "income:",
      income,
      "expense:",
      expense,
      "currentBalance:",
      currentBalance,
      "amount:",
      amount,
      typeof amount
    );

    if (currentBalance < amount) {
      return res.status(400).json({ message: "Số dư không đủ để rút" });
    }

    // Lưu thông tin giao dịch rút tiền
    const withdraw = new Withdraw({
      user_id,
      amount,
      source,
      note,
    });

    await withdraw.save();

    const DEFAULT_CATEGORY_ID = "6649e2c8e2b8f2a1b2c3d4e5"; // Thay bằng _id thực tế của category mặc định

    // Thêm bản ghi chi tiêu (Expense) khi rút tiền
    const newExpense = new Expense({
      user_id,
      amount,
      source,
      note,
      created_at: new Date(),
      date: new Date(),
      category_id: DEFAULT_CATEGORY_ID,
    });
    await newExpense.save();

    // Cập nhật số dư (trừ số tiền đã rút)
    let remain = amount;
    const incomes = await Income.find({
      user_id: new mongoose.Types.ObjectId(user_id),
      status: "pending",
      amount: { $gt: 0 },
    }).sort({ _id: 1 }); // sort để trừ từ khoản cũ nhất

    for (const income of incomes) {
      if (remain <= 0) break;
      const deduct = Math.min(income.amount, remain);
      income.amount -= deduct;
      remain -= deduct;
      await income.save();
    }

    res.status(201).json({ message: "Rút tiền thành công", withdraw });
  } catch (err) {
    console.error("❌ Lỗi khi rút tiền:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

// ========================
router.get("/balance/:userId", async (req, res) => {
  const userId = req.params.userId.trim();

  console.log("userId nhận được:", userId);

  try {
    const totalIncome = await Income.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          status: "pending",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalExpense = await Expense.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const income = totalIncome[0]?.total || 0;
    const expense = totalExpense[0]?.total || 0;

    res.json({ balance: income - expense });
  } catch (err) {
    console.error("❌ Lỗi khi tính balance:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

module.exports = router;
