const express = require('express');
const router = express.Router();
const { Complaint } = require('../models/index');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

// Submit complaint (public or logged in)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const complaint = await Complaint.create({
      ...req.body,
      submittedBy: req.user?._id || null,
    });
    res.status(201).json({ success: true, complaint });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Get all complaints (admin)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, priority } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    const complaints = await Complaint.find(filter)
      .populate('bus', 'busNumber')
      .populate('driver', 'name')
      .populate('submittedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Update complaint status (admin)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, complaint });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
