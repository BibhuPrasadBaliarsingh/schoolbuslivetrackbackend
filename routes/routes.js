// This file exports all route handlers
const express = require('express');

// ---- ROUTES ROUTE ----
const routesRouter = express.Router();
const Route = require('../models/Route');
const { protect, authorize } = require('../middleware/auth');

routesRouter.get('/', async (req, res) => {
  try {
    const routes = await Route.find({ isActive: true });
    res.json({ success: true, routes });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
routesRouter.get('/:id', async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, route });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
routesRouter.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const route = await Route.create(req.body);
    res.status(201).json({ success: true, route });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
routesRouter.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, route });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
routesRouter.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Route.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Route deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = routesRouter;
