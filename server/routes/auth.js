const express = require("express");
const router = express.Router();
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const Income = require("../models/Income");
const Withdraw = require("../models/Withdraw");
const Expense = require("../models/Expense");
const User = require("../models/User");
const Category = require("../models/Category");
const Group = require("../models/Group");
const GroupMember = require("../models/GroupMember");
const SpendingLimit = require("../models/SpendingLimit");

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
  const { user_id, amount, source, note, category_id } = req.body;

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

    if (currentBalance < amount) {
      return res.status(400).json({ message: "Số dư không đủ để rút" });
    }

    // Lưu thông tin giao dịch rút tiền
    const withdraw = new Withdraw({
      user_id,
      amount,
      source,
      note,
      category_id: category_id
        ? new mongoose.Types.ObjectId(category_id)
        : undefined,
    });

    await withdraw.save();

    // Thêm bản ghi chi tiêu (Expense) khi rút tiền
    const newExpense = new Expense({
      user_id,
      amount,
      source,
      note,
      created_at: new Date(),
      date: new Date(),
      category_id: category_id
        ? new mongoose.Types.ObjectId(category_id)
        : undefined,
    });

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

/* ------------------------
   GET /api/auth/categories
   Lấy toàn bộ danh mục
-------------------------*/
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 }); // A-Z
    res.json(categories);
  } catch (err) {
    console.error("❌ Lấy categories lỗi:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/* ------------------------
   POST /api/auth/categories
   Tạo mới một danh mục
-------------------------*/
router.post("/categories", async (req, res) => {
  const { name, description, icon, parent_category_id } = req.body;
  if (!name) return res.status(400).json({ message: "Thiếu name" });

  try {
    const newCat = new Category({
      name,
      description,
      icon,
      parent_category_id: parent_category_id
        ? new mongoose.Types.ObjectId(parent_category_id)
        : null,
    });

    await newCat.save();
    res.status(201).json(newCat);
  } catch (err) {
    console.error("❌ Tạo category lỗi:", err);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

// GET /api/auth/groups?userId=...
//Lấy danh sách nhóm mà user là thành viên
router.get("/groups", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "Thiếu userId" });
    }

    // Lấy các group mà user là thành viên
    const groupMembers = await GroupMember.find({ user_id: userId });
    const groupIds = groupMembers.map((gm) => gm.group_id);

    const groups = await Group.find({ _id: { $in: groupIds } });

    return res.json({ groups });
  } catch (err) {
    console.error("Lỗi lấy danh sách nhóm:", err);
    return res.status(500).json({ message: "Đã có lỗi xảy ra khi lấy nhóm" });
  }
});
// GET /api/groups/:id
router.get("/:id", async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Không tìm thấy nhóm" });
    res.json(group);
  } catch (err) {
    console.error("Lỗi lấy nhóm:", err);
    res.status(500).json({ message: "Đã có lỗi xảy ra khi lấy nhóm" });
  }
});
//tìm kiếm người dùng theo email
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: "Thiếu từ khóa tìm kiếm" });

    const users = await User.find({
      email: { $regex: q, $options: "i" },
    }).limit(5); // Giới hạn số gợi ý

    res.json(users);
  } catch (err) {
    console.error("Lỗi tìm kiếm người dùng:", err);
    res.status(500).json({ message: "Lỗi server khi tìm người dùng" });
  }
});

/* =====================================================
   POST /api/auth/spending-limits
   Tạo hạn mức mới
=====================================================*/
router.post("/spending-limits", async (req, res) => {
  const { user_id, amount, months, note } = req.body;

  if (!user_id || !amount) {
    return res.status(400).json({ message: "Thiếu user_id hoặc amount" });
  }

  try {
    // khi tạo mới → vô hiệu hoá hạn mức active cũ (nếu có)
    await SpendingLimit.updateMany(
      { user_id, active: true },
      { $set: { active: false } }
    );

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (months || 1)); // mặc định 1 tháng

    const limit = new SpendingLimit({
      user_id,
      amount,
      months: months || 1,
      note,
      start_date: startDate,
      end_date: endDate,
      active: true,
    });

    await limit.save();
    res.status(201).json(limit);
  } catch (err) {
    console.error("❌ Lỗi tạo SpendingLimit:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* =====================================================
   GET /api/auth/spending-limits/:userId/current
   Lấy hạn mức đang active của user
=====================================================*/
router.get("/spending-limits/:userId/current", async (req, res) => {
  const { userId } = req.params;
  try {
    const current = await SpendingLimit.findOne({
      user_id: userId,
      active: true,
    });
    res.json(current || { message: "Chưa thiết lập hạn mức" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* (tuỳ chọn) Lấy history */
router.get("/spending-limits/:userId/history", async (req, res) => {
  const { userId } = req.params;
  try {
    const history = await SpendingLimit.find({ user_id: userId }).sort({
      start_date: -1,
    });
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});
// ========================
// PUT /api/auth/update/:id
// ========================
router.put("/update/:id", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const updateData = { name, email };

    // Nếu có mật khẩu mới thì mã hóa rồi cập nhật
    if (password && password.trim() !== "") {
      updateData.password = await argon2.hash(password);
    }

    // Kiểm tra email đã tồn tại cho user khác chưa (nếu đổi email)
    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ message: "Email đã được sử dụng bởi tài khoản khác" });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    res.json({
      message: "Cập nhật thành công",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi cập nhật user:", err);
    res.status(500).json({ message: "Có lỗi xảy ra khi cập nhật" });
  }
});
module.exports = router;
