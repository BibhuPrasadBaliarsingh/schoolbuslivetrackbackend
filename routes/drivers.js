const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// Get all drivers
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver', isActive: true })
      .populate('assignedBus', 'busNumber status');
    res.json({ success: true, drivers });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Create driver
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const driver = await User.create({ ...req.body, role: 'driver' });
    res.status(201).json({ success: true, driver });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, message: 'Email already exists' });
    res.status(500).json({ success: false, message: e.message });
  }
});

// Update driver
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const driver = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, driver });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Delete/deactivate driver
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Driver deactivated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
