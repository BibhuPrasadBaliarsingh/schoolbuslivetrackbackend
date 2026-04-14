const express = require('express');
const router = express.Router();
const { Maintenance } = require('../models/index');
const { protect, authorize } = require('../middleware/auth');
const { createUploader } = require('../middleware/upload');

const uploadMaintenanceImage = createUploader('maintenance');

router.post('/', protect, authorize('driver', 'admin'), uploadMaintenanceImage.single('image'), async (req, res) => {
  try {
    const record = await Maintenance.create({
      ...req.body,
      estimatedCost: req.body.estimatedCost ? Number(req.body.estimatedCost) : undefined,
      requestedBy: req.user._id,
      images: req.file ? [`/uploads/maintenance/${req.file.filename}`] : [],
    });
    res.status(201).json({ success: true, maintenance: record });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'driver' ? { requestedBy: req.user._id } : {};
    if (req.query.status) filter.status = req.query.status;
    const records = await Maintenance.find(filter)
      .populate('bus', 'busNumber')
      .populate('requestedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, maintenance: records });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const record = await Maintenance.findByIdAndUpdate(
      req.params.id,
      { ...req.body, approvedBy: req.user._id },
      { new: true }
    );
    res.json({ success: true, maintenance: record });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
