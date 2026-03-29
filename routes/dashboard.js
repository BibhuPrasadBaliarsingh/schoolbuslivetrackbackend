const express = require('express');
const router = express.Router();
const { getAdminDashboard, getDriverDashboard } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

router.get('/admin', protect, authorize('admin'), getAdminDashboard);
router.get('/driver', protect, authorize('driver'), getDriverDashboard);

module.exports = router;
