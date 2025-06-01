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
const GroupContribution = require("../models/GroupContribution");
const GroupExpense = require("../models/GroupExpense");
const GroupFund = require("../models/GroupFund");
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Publiczz
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

router.get("/income/total/:userId", async (req, res) => {
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
// ...existing code...
router.post("/Withdraw", async (req, res) => {
  const { user_id, amount, source, note, category_id } = req.body;

  if (!user_id || !amount || !source) {
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
  }
  if (!mongoose.Types.ObjectId.isValid(user_id)) {
    return res.status(400).json({ message: "user_id không hợp lệ" });
  }

  const amountNum = Number(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ message: "Số tiền không hợp lệ" });
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

    if (currentBalance < amountNum) {
      return res.status(400).json({ message: "Số dư không đủ để rút" });
    }

    // Lưu thông tin giao dịch rút tiền
    const withdraw = new Withdraw({
      user_id,
      amount: amountNum,
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
      amount: amountNum,
      source,
      note,
      created_at: new Date(),
      date: new Date(),
      category_id: category_id
        ? new mongoose.Types.ObjectId(category_id)
        : undefined,
    });

    await newExpense.save(); // <--- BỔ SUNG DÒNG NÀY

    // Cập nhật số dư (trừ số tiền đã rút)
    let remain = amountNum;
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
// POST /api/groups/createAdd commentMore actions
router.post("/create", async (req, res) => {
  try {
    const { name, description, created_by, memberEmail } = req.body;

    if (!name || !created_by) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    // Tìm user từ email nếu có
    let member = null;
    if (memberEmail) {
      member = await User.findOne({ email: memberEmail });
    }

    // Tạo nhóm
    const newGroup = await Group.create({
      name,
      description,
      created_by,
    });

    // Danh sách thành viên (gồm admin + thành viên từ email nếu có)
    const groupMembers = [
      {
        group_id: newGroup._id,
        user_id: created_by,
        role: "admin",
        status: "active",
      },
    ];

    if (member) {
      groupMembers.push({
        group_id: newGroup._id,
        user_id: member._id,
        role: "member",
        status: "active",
      });
    }

    await GroupMember.insertMany(groupMembers);

    return res
      .status(201)
      .json({ message: "Tạo nhóm thành công", group: newGroup });
  } catch (err) {
    console.error("Lỗi tạo nhóm:", err);
    return res.status(500).json({ message: "Đã có lỗi xảy ra khi tạo nhóm" });
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
      const existing = await User.findOne({
        email,
        _id: { $ne: req.params.id },
      });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Email đã được sử dụng bởi tài khoản khác" });
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

/* =========================================================
   GROUP CONTRIBUTION
========================================================= */
// POST /api/auth/group-contributions  ==> nộp tiền vào quỹ nhóm (tạo quỹ nếu chưa có)
router.post("/group-contributions", async (req, res) => {
  try {
    const {
      group_id, // ID nhóm
      fund_name, // Tên quỹ nhập tay từ FE
      amount,
      payment_method = "cash",
      member_id, // ID người nộp tiền
      description = "", // Mô tả quỹ (tùy chọn)
      end_date = null, // Ngày kết thúc quỹ (tùy chọn)
      purpose = "", // Mục đích quỹ (tùy chọn)
    } = req.body;

    // Validate
    if (
      !isValidId(group_id) ||
      !isValidId(member_id) ||
      !fund_name ||
      !amount ||
      amount <= 0
    ) {
      return res.status(400).json({ error: "Thiếu hoặc sai thông tin" });
    }

    // 1. Tìm hoặc tạo quỹ nhóm theo tên (fund_name) và group_id
    let fund = await GroupFund.findOne({ group_id, name: fund_name });
    if (!fund) {
      fund = await GroupFund.create({
        group_id,
        name: fund_name,
        description,
        end_date,
        purpose,
      });
    }

    // 2. Lưu contribution vào quỹ vừa tìm/đã tạo
    const contribution = await GroupContribution.create({
      fund_id: fund._id,
      member_id,
      amount,
      payment_method,
    });

    // Trừ số dư cá nhân: tạo bản ghi âm trong Income
    await Income.create({
      user_id: member_id,
      amount: -amount,
      source: "group_contribution",
      received_date: new Date(),
      note: `Nạp vào quỹ nhóm "${fund.name}"`,
      status: "pending",
    });

    res.status(201).json({ contribution, fund });
  } catch (err) {
    console.error("❌ Lỗi tạo contribution:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// PATCH /api/auth/group-contributions/:id/status  ==> xác nhận / từ chối
router.patch("/group-contributions/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status = "confirmed" } = req.body; // confirmed | rejected

    if (!isValidId(id) || !["confirmed", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Tham số không hợp lệ" });
    }

    const updated = await GroupContribution.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Không tìm thấy" });

    res.json(updated);
  } catch (err) {
    console.error("❌ Lỗi cập nhật contribution:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

/* =========================================================
   GROUP EXPENSE
========================================================= */
// POST /api/auth/group-expenses  ==> tạo chi tiêu nhóm, trừ vào số dư cá nhân
router.post("/group-expenses", async (req, res) => {
  try {
    const {
      fund_id,
      amount,
      date = new Date(),
      description = "",
      category_id,
      receipt_image = "",
    } = req.body;
    const member_id = req.user?._id; // người thực hiện

    // Validate
    if (
      !isValidId(fund_id) ||
      !isValidId(category_id) ||
      !isValidId(member_id)
    ) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Số tiền không hợp lệ" });
    }

    /* ----- Kiểm tra số dư cá nhân trước khi chi ----- */
    const totalIncome = await Income.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(member_id),
          status: "pending", // thu nhập còn khả dụng
        },
      },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);
    const personalBalance = totalIncome[0]?.totalAmount || 0;

    if (personalBalance < amount) {
      return res
        .status(400)
        .json({ error: "Số dư cá nhân không đủ để chi tiêu" });
    }

    /* ----- Khởi tạo chi tiêu ----- */
    const expense = await GroupExpense.create({
      fund_id,
      member_id,
      amount,
      date,
      description,
      category_id,
      receipt_image,
      approval_status: "pending",
    });

    // Giảm số dư cá nhân: tạo bản ghi âm (negative) trong Income hoặc Update khác
    await Income.create({
      user_id: member_id,
      amount: -amount,
      source: "group_expense",
      received_date: new Date(),
      note: `Chi cho nhóm #${fund_id}`,
      status: "pending",
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error("❌ Lỗi tạo expense:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// PATCH /api/auth/group-expenses/:id/approve  ==> duyệt / từ chối chi tiêu
router.patch("/group-expenses/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { status = "approved" } = req.body; // approved | rejected
    const approver = req.user?._id;

    if (!isValidId(id) || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Tham số không hợp lệ" });
    }

    const updated = await GroupExpense.findByIdAndUpdate(
      id,
      { approval_status: status, approved_by: approver },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Không tìm thấy" });

    res.json(updated);
  } catch (err) {
    console.error("❌ Lỗi duyệt expense:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.post("/group-funds", async (req, res) => {
  try {
    const {
      group_id,
      name,
      description = "",
      end_date = null,
      purpose = "",
    } = req.body;

    if (!isValidId(group_id) || !name) {
      return res.status(400).json({ error: "Thông tin không hợp lệ" });
    }

    const newFund = await GroupFund.create({
      group_id,
      name,
      description,
      end_date,
      purpose,
    });

    res.status(201).json(newFund);
  } catch (err) {
    console.error("❌ Lỗi tạo quỹ:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/group-funds", async (req, res) => {
  try {
    const { groupId } = req.query;
    if (!isValidId(groupId)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }

    const funds = await GroupFund.find({ group_id: groupId }).sort({
      created_at: -1,
    });
    res.json({ funds });
  } catch (err) {
    console.error("❌ Lỗi lấy danh sách quỹ:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/group-funds", async (req, res) => {
  try {
    const { groupId } = req.query;
    if (!isValidId(groupId)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }

    const funds = await GroupFund.find({ group_id: groupId }).sort({
      created_at: -1,
    });
    res.json({ funds });
  } catch (err) {
    console.error("❌ Lỗi lấy danh sách quỹ:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// GET /api/auth/groups/:groupId/balance
router.get("/groups/:groupId/balance", async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!isValidId(groupId)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }
    // Lấy tất cả fund_id của nhóm
    const funds = await GroupFund.find({ group_id: groupId }).select("_id");
    const fundIds = funds.map((f) => f._id);
    const result = await GroupContribution.aggregate([
      { $match: { fund_id: { $in: fundIds } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const balance = result[0]?.total || 0;
    res.json({ balance });
  } catch (err) {
    res.status(500).json({ error: "Lỗi máy chủ" });
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

module.exports = router;
