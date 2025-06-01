const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// --- Import các Mongoose Models cần thiết ---
// Đảm bảo đường dẫn đến models là chính xác từ vị trí file history.js
const Income = require("../models/Income");
const Expense = require("../models/Expense"); // Model cho chi tiêu cá nhân
const GroupContribution = require("../models/GroupContribution");
const GroupExpense = require("../models/GroupExpense");
const GroupFund = require("../models/GroupFund"); // Để lấy thông tin quỹ/nhóm
const User = require("../models/User"); // Nếu cần populate thông tin người dùng (ví dụ: avatar)
const Category = require("../models/Category"); // Nếu cần populate thông tin danh mục
const GroupMember = require("../models/GroupMember"); // Để liên kết User với GroupExpense/Contribution

// Hàm kiểm tra ObjectId hợp lệ (bạn có thể đã có hàm này ở file khác, có thể import hoặc định nghĩa lại)
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// === API LẤY LỊCH SỬ GIAO DỊCH CÁ NHÂN ===
// GET /api/history/user/:userId
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidId(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID người dùng không hợp lệ." });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Lấy tất cả các bản ghi Income của người dùng
    const incomes = await Income.find({ user_id: userObjectId })
      .populate("category_id", "name icon") // Populate để lấy tên/icon danh mục nếu có
      .sort({ received_date: -1 }); // Sắp xếp mới nhất lên trước

    // Lấy tất cả các bản ghi Expense của người dùng (được tạo khi Withdraw)
    const expenses = await Expense.find({ user_id: userObjectId })
      .populate("category_id", "name icon")
      .sort({ date: -1 }); // Sắp xếp mới nhất lên trước

    let transactions = [];

    // Xử lý và định dạng lại Incomes
    incomes.forEach((inc) => {
      let transaction_type = "unknown_income_adjustment";
      let desc = inc.note || inc.source;
      if (inc.amount >= 0) {
        transaction_type = "deposit"; // Nạp tiền cá nhân
      } else {
        // amount < 0
        if (inc.source === "group_contribution") {
          transaction_type = "paid_to_group_fund"; // Tiền cá nhân dùng nạp vào quỹ nhóm
          desc = inc.note || `Nạp tiền vào quỹ nhóm`;
        } else {
          transaction_type = "personal_spending_or_adjustment"; // Các khoản chi cá nhân khác ghi qua Income âm
        }
      }
      transactions.push({
        _id: inc._id.toString(),
        type: transaction_type,
        amount: inc.amount,
        description: desc,
        date: inc.received_date,
        categoryName:
          inc.category_id?.name ||
          (inc.amount < 0 && inc.source === "group_contribution"
            ? "Nạp tiền vào nhóm"
            : inc.source),
        categoryIcon: inc.category_id?.icon,
        status: inc.status, // Giữ lại status của Income (ví dụ: pending, confirmed, completed)
        source_ref: "IncomeModel", // Để biết bản ghi này từ đâu ra
      });
    });

    // Xử lý và định dạng lại Expenses (thường là kết quả của Withdraw)
    expenses.forEach((exp) => {
      transactions.push({
        _id: exp._id.toString(),
        type: "withdrawal", // Rút tiền/Chi tiêu cá nhân
        amount: -Math.abs(exp.amount), // Đảm bảo số tiền là âm
        description: exp.note || exp.source,
        date: exp.date || exp.created_at,
        categoryName: exp.category_id?.name || exp.source,
        categoryIcon: exp.category_id?.icon,
        source_ref: "ExpenseModel",
      });
    });

    // Sắp xếp tất cả giao dịch theo ngày giảm dần
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, transactions });
  } catch (err) {
    console.error("Lỗi khi lấy lịch sử giao dịch cá nhân:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi máy chủ khi lấy lịch sử giao dịch cá nhân.",
      });
  }
});

// === API LẤY LỊCH SỬ GIAO DỊCH NHÓM ===
// GET /api/history/group/:groupId
router.get("/group/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!isValidId(groupId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID nhóm không hợp lệ." });
    }
    const groupObjectId = new mongoose.Types.ObjectId(groupId);

    // Lấy tất cả các fund_id và tên quỹ thuộc nhóm này
    const fundsInGroup = await GroupFund.find({
      group_id: groupObjectId,
    }).select("_id name");
    const fundIdsInGroup = fundsInGroup.map((fund) => fund._id);
    // Tạo một map để dễ dàng lấy tên quỹ từ fund_id
    const fundNameMap = fundsInGroup.reduce((map, fund) => {
      map[fund._id.toString()] = fund.name;
      return map;
    }, {});

    // Nếu nhóm không có quỹ nào, trả về mảng rỗng (hoặc xử lý theo logic của bạn)
    // (Việc kiểm tra fundIdsInGroup.length > 0 trước khi query là tốt để tránh lỗi)

    let contributions = [];
    if (fundIdsInGroup.length > 0) {
      contributions = await GroupContribution.find({
        fund_id: { $in: fundIdsInGroup },
      })
        .populate({
          path: "member_id", // Populate GroupMember document
          populate: {
            path: "user_id", // Từ GroupMember, populate User document
            model: "User", // Chỉ định rõ model User
            select: "name avatar", // Chỉ lấy các trường cần thiết từ User
          },
        })
        .sort({ contributed_at: -1 });
    }

    let groupExpenses = [];
    if (fundIdsInGroup.length > 0) {
      groupExpenses = await GroupExpense.find({
        fund_id: { $in: fundIdsInGroup },
      })
        .populate({
          path: "member_id", // Populate GroupMember document
          populate: {
            path: "user_id", // Từ GroupMember, populate User document
            model: "User", // Chỉ định rõ model User
            select: "name avatar",
          },
        })
        .populate("category_id", "name icon") // Populate Category cho chi tiêu
        .sort({ date: -1 });
    }

    let transactions = [];

    contributions.forEach((con) => {
      transactions.push({
        _id: con._id.toString(),
        type: "group_contribution", // Loại: Nạp tiền vào nhóm
        amount: con.amount, // Số dương
        description: con.note || `Đóng góp`,
        userName: con.member_id?.user_id?.name || "Không rõ thành viên",
        userAvatar: con.member_id?.user_id?.avatar,
        date: con.contributed_at,
        status: con.status, // Trạng thái của đóng góp (pending, confirmed)
        paymentMethod: con.payment_method,
        fundName: fundNameMap[con.fund_id.toString()] || "Không rõ", // Tên quỹ mà tiền được nạp vào
        source_ref: "GroupContributionModel",
      });
    });

    groupExpenses.forEach((exp) => {
      transactions.push({
        _id: exp._id.toString(),
        type: "group_expense", // Loại: Chi tiêu từ nhóm
        amount: -Math.abs(exp.amount), // Số âm
        description: exp.description || `Chi tiêu nhóm`,
        userName: exp.member_id?.user_id?.name || "Không rõ thành viên", // Người thực hiện/ghi chép
        userAvatar: exp.member_id?.user_id?.avatar,
        date: exp.date,
        categoryName: exp.category_id?.name || "Chưa phân loại",
        categoryIcon: exp.category_id?.icon,
        approvalStatus: exp.approval_status, // Trạng thái duyệt chi (pending, approved, rejected)
        fundName: fundNameMap[exp.fund_id.toString()] || "Không rõ", // Quỹ được dùng để phân loại chi tiêu
        source_ref: "GroupExpenseModel",
      });
    });

    // Sắp xếp tất cả giao dịch của nhóm theo ngày giảm dần
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, transactions });
  } catch (err) {
    console.error("Lỗi khi lấy lịch sử giao dịch nhóm:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi máy chủ khi lấy lịch sử giao dịch nhóm.",
      });
  }
});

module.exports = router;
