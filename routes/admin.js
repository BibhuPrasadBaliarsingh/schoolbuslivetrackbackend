const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Bus = require('../models/Bus');
const Trip = require('../models/Trip');
const { protect, authorize } = require('../middleware/auth');

// Get all users
router.get('/users', protect, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    const users = await User.find(filter).populate('assignedBus', 'busNumber');
    res.json({ success: true, users });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Toggle user active status
router.put('/users/:id/toggle', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Get activity logs (recent trips + events)
router.get('/activity', protect, authorize('admin'), async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate('bus', 'busNumber')
      .populate('driver', 'name')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, activities: trips });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Analytics export data
router.get('/analytics', protect, authorize('admin'), async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const [tripStats, busStats, complaintStats] = await Promise.all([
      Trip.aggregate([
        { $match: { createdAt: { $gte: daysAgo } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Bus.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      require('../models/index').Complaint.aggregate([
        { $match: { createdAt: { $gte: daysAgo } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({ success: true, analytics: { trips: tripStats, buses: busStats, complaints: complaintStats } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
