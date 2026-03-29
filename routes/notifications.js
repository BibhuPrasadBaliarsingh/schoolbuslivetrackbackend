const express = require('express');
const router = express.Router();
const { Notification } = require('../models/index');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const notification = await Notification.create({ ...req.body, sentBy: req.user._id });
    // Broadcast via Socket.io
    req.io.emit('new_notification', notification);
    res.status(201).json({ success: true, notification });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ isActive: true })
      .sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, notifications });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/:id/read', protect, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { $addToSet: { isRead: req.user._id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
