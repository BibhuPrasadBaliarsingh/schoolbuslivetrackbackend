const express = require('express');
const router = express.Router();
const { Expense } = require('../models/index');
const { protect, authorize } = require('../middleware/auth');
const { createUploader } = require('../middleware/upload');

const uploadReceipt = createUploader('expenses');

router.post('/', protect, authorize('driver'), uploadReceipt.single('receiptImage'), async (req, res) => {
  try {
    const expense = await Expense.create({
      ...req.body,
      amount: Number(req.body.amount),
      driver: req.user._id,
      receiptImage: req.file ? `/uploads/expenses/${req.file.filename}` : undefined,
    });
    res.status(201).json({ success: true, expense });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'driver' ? { driver: req.user._id } : {};
    if (req.query.status) filter.status = req.query.status;
    const expenses = await Expense.find(filter)
      .populate('driver', 'name')
      .populate('bus', 'busNumber')
      .sort({ createdAt: -1 });
    res.json({ success: true, expenses });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { ...req.body, approvedBy: req.user._id, approvedAt: new Date() },
      { new: true }
    );
    res.json({ success: true, expense });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
