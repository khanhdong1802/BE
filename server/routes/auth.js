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
const TransactionHistory = require("../models/TransactionHistory");
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
  const { user_id, amount, source, note, status } = req.body;

  if (!user_id || !amount || !source) {
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
  }

  try {
    // Lấy thời điểm thực tế tại server
    const now = new Date();

    const income = new Income({
      user_id,
      amount,
      source,
      received_date: now, // Lưu thời điểm thực tế
      note,
      status: status || "pending",
    });

    await income.save();

    // Thêm vào lịch sử giao dịch
    await TransactionHistory.create({
      transaction_type: "income",
      amount,
      transaction_date: now, // Lưu thời điểm thực tế
      description: note || source,
      user_id,
      status: status || "completed",
    });

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

    await newExpense.save();

    // Ghi vào lịch sử giao dịch
    await TransactionHistory.create({
      transaction_type: "expense",
      amount: amountNum,
      transaction_date: new Date(),
      description: note || source || "Rút tiền",
      user_id,
      status: "completed",
    });

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
    // Thêm vào lịch sử giao dịch
    await TransactionHistory.create({
      transaction_type: "contribution",
      amount,
      transaction_date: new Date(),
      description: `Nạp vào quỹ nhóm "${fund.name}"`,
      user_id: member_id,
      group_id: group_id,
      status: "completed",
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
// POST /api/auth/group-expenses
router.post("/group-expenses", async (req, res) => {
  try {
    const {
      fund_id, // ID của quỹ dùng để phân loại (ví dụ: quỹ chung của nhóm)
      amount,
      user_making_expense_id, // User ID của người dùng đang đăng nhập thực hiện hành động
      date = new Date(),
      description = "",
      category_id,
      receipt_image = "",
    } = req.body;

    const numericAmount = Number(amount);
    console.log(
      "amount nhận từ FE:",
      amount,
      "→ numericAmount:",
      numericAmount
    );

    // --- VALIDATION ---
    if (
      !isValidId(fund_id) ||
      !isValidId(user_making_expense_id) ||
      (category_id && !isValidId(category_id))
    ) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ (quỹ, người dùng, hoặc danh mục).",
      });
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Số tiền không hợp lệ." });
    }

    // --- LẤY GROUP ID TỪ FUND ID ---
    const fundObjectId = new mongoose.Types.ObjectId(fund_id);
    const groupFundDoc = await GroupFund.findById(fundObjectId);
    if (!groupFundDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Quỹ không tồn tại." });
    }
    const groupIdForBalanceCheck = groupFundDoc.group_id;

    // --- KIỂM TRA SỐ DƯ TỔNG CỦA NHÓM ---
    const fundsInGroup = await GroupFund.find({
      group_id: groupIdForBalanceCheck,
    }).select("_id");
    const fundIdsInGroup = fundsInGroup.map((fund) => fund._id);

    let actualGroupBalance = 0;
    if (fundIdsInGroup.length > 0) {
      const contributionData = await GroupContribution.aggregate([
        { $match: { fund_id: { $in: fundIdsInGroup }, status: "pending" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const totalContributions = contributionData[0]?.total || 0;

      const expenseData = await GroupExpense.aggregate([
        {
          $match: {
            fund_id: { $in: fundIdsInGroup },
            approval_status: "approved",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const totalExpenses = expenseData[0]?.total || 0;
      actualGroupBalance = totalContributions - totalExpenses;
    } else if (numericAmount > 0) {
      return res.status(400).json({
        success: false,
        message: "Nhóm này không có quỹ nào để ghi nhận chi tiêu.",
      });
    }

    // --- THÊM ĐOẠN CODE KIỂM TRA SỐ DƯ BẠN CUNG CẤP VÀO ĐÂY ---
    if (actualGroupBalance < numericAmount) {
      return res.status(400).json({
        success: false,
        message: `Số dư tài khoản nhóm không đủ. Hiện có: ${actualGroupBalance.toLocaleString()} đ`,
      });
    }
    // --- KẾT THÚC KIỂM TRA SỐ DƯ NHÓM ---

    // --- TÌM GROUPMEMBER ID CHO BẢN GHI GROUPEXPENSE ---
    const groupMemberEntry = await GroupMember.findOne({
      group_id: groupIdForBalanceCheck,
      user_id: new mongoose.Types.ObjectId(user_making_expense_id),
    });

    if (!groupMemberEntry) {
      return res.status(403).json({
        success: false,
        message:
          "Người dùng không phải là thành viên của nhóm này hoặc thông tin không chính xác.",
      });
    }
    const memberIdForExpenseRecord = groupMemberEntry._id;

    // --- TẠO BẢN GHI GROUPEXPENSE MỚI ---
    const newGroupExpense = new GroupExpense({
      fund_id: fundObjectId,
      member_id: memberIdForExpenseRecord,
      amount: numericAmount,
      date: date,
      description: description,
      category_id: category_id
        ? new mongoose.Types.ObjectId(category_id)
        : undefined,
      receipt_image: receipt_image,
      approval_status: "approved", // Hoặc "pending" nếu bạn có quy trình duyệt
    });

    await newGroupExpense.save();

    // Ghi vào lịch sử giao dịch nhóm
    const now = new Date();
    await TransactionHistory.create({
      transaction_type: "expense",
      amount: numericAmount,
      transaction_date: now,
      description: description || "Chi tiêu nhóm",
      user_id: user_making_expense_id,
      group_id: groupIdForBalanceCheck,
      status: "completed",
    });

    // Quan trọng: Đảm bảo không có code tạo Income âm cho user_making_expense_id ở đây
    // để không trừ tiền cá nhân khi chi từ tài khoản nhóm.

    res.status(201).json({
      success: true,
      message: "Chi tiêu nhóm đã được tạo và trừ vào tài khoản nhóm",
      expense: newGroupExpense,
    });
  } catch (err) {
    console.error("❌ Lỗi tạo chi tiêu nhóm:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi tạo chi tiêu nhóm." });
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

// GET /groups/:groupId/actual-balance
// Lấy số dư thực tế có thể chi tiêu của một quỹ cụ thể
router.get("/groups/:groupId/actual-balance", async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID nhóm không hợp lệ." });
    }
    const groupObjectId = new mongoose.Types.ObjectId(groupId);

    // Lấy tất cả các fund_id thuộc nhóm này
    const fundsInGroup = await GroupFund.find({
      group_id: groupObjectId,
    }).select("_id");
    const fundIdsInGroup = fundsInGroup.map((fund) => fund._id);

    if (fundIdsInGroup.length === 0) {
      // Nếu nhóm không có quỹ nào, số dư là 0 (hoặc bạn có thể cho phép đóng góp trực tiếp vào nhóm mà không cần quỹ)
      return res.json({ success: true, balance: 0 });
    }

    // Tính tổng đóng góp đã xác nhận cho tất cả các quỹ trong nhóm
    const contributionData = await GroupContribution.aggregate([
      {
        $match: {
          fund_id: { $in: fundIdsInGroup },
          status: "pending",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalContributions = contributionData[0]?.total || 0;

    // Tính tổng chi tiêu đã duyệt cho tất cả các quỹ trong nhóm
    const expenseData = await GroupExpense.aggregate([
      {
        $match: {
          fund_id: { $in: fundIdsInGroup },
          approval_status: "approved",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpenses = expenseData[0]?.total || 0;

    const actualGroupBalance = totalContributions - totalExpenses;
    res.json({
      success: true,
      balance: actualGroupBalance,
      totalSpent: totalExpenses,
    });
  } catch (err) {
    console.error("Lỗi khi lấy số dư tổng của nhóm:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi tính số dư nhóm." });
  }
});

// === API MỚI: LẤY SỐ DƯ CÁ NHÂN THỰC TẾ (THU - CHI) ===
// GET /api/auth/balance/:userId
router.get("/balance/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidId(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID người dùng không hợp lệ." });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Tính tổng thu nhập dương đã được xác nhận
    const incomeData = await Income.aggregate([
      {
        $match: {
          user_id: userObjectId,
          amount: { $gte: 0 }, // Chỉ lấy các khoản thu nhập (dương hoặc bằng 0)
          status: "confirmed", // Chỉ tính các khoản đã xác nhận
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalPositiveIncome = incomeData[0]?.total || 0;

    // 2. Tính tổng các khoản chi tiêu cá nhân trực tiếp (từ bảng Expense)
    // Giả định Expense luôn là số dương và thể hiện một khoản chi
    const personalExpensesData = await Expense.aggregate([
      { $match: { user_id: userObjectId } }, // Không cần status nếu mọi Expense đều là đã chi
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalPersonalExpenses = personalExpensesData[0]?.total || 0;

    // 3. Tính tổng các khoản tiền cá nhân đã dùng để nạp vào quỹ nhóm
    // (Đây là các bản ghi Income âm, với source là "group_contribution" và status là "completed" hoặc "confirmed_debit")
    const contributionsToGroupData = await Income.aggregate([
      {
        $match: {
          user_id: userObjectId,
          source: "group_contribution", // Hoặc một định danh khác bạn dùng khi nạp tiền vào nhóm
          amount: { $lt: 0 }, // Chỉ lấy các khoản âm
          status: "completed", // Hoặc "confirmed_debit" - trạng thái cho khoản trừ này
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }, // total này sẽ là số âm
    ]);
    // totalContributionsToGroup sẽ là tổng các số âm, ví dụ -50000, -20000.
    // Hoặc bạn có thể lấy Math.abs() nếu muốn cộng dồn các khoản chi.
    // Để tính số dư, chúng ta cần giá trị âm này.
    const totalNegativeAdjustmentsFromGroupContributions =
      contributionsToGroupData[0]?.total || 0;

    // Tính số dư cuối cùng
    // Số dư = Tổng thu nhập dương - Tổng chi tiêu cá nhân trực tiếp - Tổng (giá trị tuyệt đối của) các khoản tiền cá nhân nạp vào nhóm
    // Hoặc: Số dư = Tổng thu nhập dương + (Tổng các khoản Income âm đã completed/confirmed_debit) - Tổng chi tiêu Expense
    const currentBalance =
      totalPositiveIncome +
      totalNegativeAdjustmentsFromGroupContributions -
      totalPersonalExpenses;

    console.log(
      `BALANCE API for ${userId}: PositiveIncome ${totalPositiveIncome}, NegativeAdjustments ${totalNegativeAdjustmentsFromGroupContributions}, PersonalExpenses ${totalPersonalExpenses}, FinalBalance ${currentBalance}`
    );

    res.json({ success: true, balance: currentBalance });
  } catch (err) {
    console.error("❌ Lỗi khi tính balance cá nhân:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tính balance cá nhân.",
    });
  }
});

// === API LẤY TỔNG CHI TIÊU CÁ NHÂN (Chỉ từ bảng Expense) ===
// GET /api/auth/expenses/personal/total/:userId
router.get("/expenses/personal/total/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidId(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID người dùng không hợp lệ." });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const expenseAggregation = await Expense.aggregate([
      { $match: { user_id: userObjectId } }, // Lấy tất cả chi tiêu cá nhân
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalUserExpenses = expenseAggregation[0]?.total || 0;
    res.json({ success: true, total: totalUserExpenses });
  } catch (err) {
    console.error("❌ Lỗi tính tổng chi tiêu cá nhân:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi tính tổng chi tiêu cá nhân.",
    });
  }
});

// GET /api/expenses/personal/monthly-summary/:userId?month=YYYY-MM
router.get("/expenses/personal/monthly-summary/:userId", async (req, res) => {
  const { userId } = req.params;
  const { month } = req.query; // "2025-05"
  if (!userId || !month) {
    return res.status(400).json({ message: "Thiếu userId hoặc tháng" });
  }

  // Tính ngày đầu và cuối tháng
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  try {
    // Gom nhóm theo category
    const summary = await Expense.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          date: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: "$category_id",
          total: { $sum: "$amount" },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: "$category",
      },
      {
        $project: {
          _id: 0,
          category_id: "$category._id",
          category_name: "$category.name",
          total: 1,
        },
      },
    ]);

    // Tổng chi tiêu tháng
    const total = summary.reduce((sum, item) => sum + item.total, 0);

    res.json({ total, summary });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Lỗi máy chủ khi tổng hợp chi tiêu tháng" });
  }
});

module.exports = router;
