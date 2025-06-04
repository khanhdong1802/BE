const express = require("express");
const router = express.Router();
const Category = require("../../models/Category");

/* ------------------------
   GET /api/auth/categories
   Lấy toàn bộ danh mục
-------------------------*/
router.get("/", async (req, res) => {
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
router.post("/", async (req, res) => {
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

module.exports = router;
