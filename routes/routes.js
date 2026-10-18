const express = require('express');

// ---- ROUTES ROUTE ----
const routesRouter = express.Router();
const Route = require('../models/Route');
const Bus = require('../models/Bus');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

const sendRouteError = (res, err) => {
  if (err?.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({
      path: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: 'Route validation failed',
      details,
    });
  }

  if (err?.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  if (err?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate key error: A route with this information already exists',
      details: err.keyValue || undefined,
    });
  }

  return res.status(500).json({ success: false, message: err?.message || 'Internal Server Error' });
};

// @desc    Calculate road-following route using OSRM or configurable provider
// @route   POST /api/routes/calculate
routesRouter.post('/calculate', async (req, res) => {
  try {
    const { coordinates, start, end, stops } = req.body;
    let points = [];

    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      points = coordinates;
    } else if (start && end) {
      const startCoord = Array.isArray(start.coordinates) ? start.coordinates : [start.lng ?? start[0], start.lat ?? start[1]];
      const endCoord = Array.isArray(end.coordinates) ? end.coordinates : [end.lng ?? end[0], end.lat ?? end[1]];
      points.push(startCoord);

      if (Array.isArray(stops)) {
        stops.forEach((s) => {
          const sCoord = s.location?.coordinates || (Array.isArray(s.coordinates) ? s.coordinates : [s.lng ?? s[0], s.lat ?? s[1]]);
          if (Array.isArray(sCoord) && sCoord.length === 2 && !Number.isNaN(sCoord[0]) && !Number.isNaN(sCoord[1])) {
            points.push(sCoord);
          }
        });
      }

      points.push(endCoord);
    }

    if (points.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 valid coordinate points [longitude, latitude] are required to calculate a route',
      });
    }

    // Verify all points are valid numbers
    const validPoints = points.filter(p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (validPoints.length < 2) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates provided' });
    }

    const coordStr = validPoints.map(p => `${p[0]},${p[1]}`).join(';');
    const routingBaseUrl = (process.env.ROUTING_API_URL || 'https://router.project-osrm.org/route/v1/driving').replace(/\/$/, '');
    const url = `${routingBaseUrl}/${coordStr}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({
        success: false,
        message: 'Routing service returned an error',
        details: errText,
      });
    }

    const data = await response.json();
    if (!data.routes || !data.routes.length) {
      return res.status(404).json({
        success: false,
        message: 'No road route could be found connecting these coordinates',
      });
    }

    const bestRoute = data.routes[0];
    const roadCoordinates = bestRoute.geometry?.coordinates || [];
    const distanceKm = Number((bestRoute.distance / 1000).toFixed(2));
    const durationMinutes = Math.round(bestRoute.duration / 60);

    res.json({
      success: true,
      coordinates: roadCoordinates,
      totalDistance: distanceKm,
      estimatedDuration: durationMinutes,
      provider: 'OSRM',
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'Routing service timed out' });
    }
    console.error('Route calculation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to calculate road route' });
  }
});

// @desc    Get all active routes (public / auth)
// @route   GET /api/routes
routesRouter.get('/', optionalAuth, async (req, res) => {
  try {
    const routes = await Route.find({ isActive: true })
      .populate('bus', 'busNumber registrationNumber model status currentLocation currentSpeed')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: routes.length, routes });
  } catch (e) { sendRouteError(res, e); }
});

// @desc    Get single route by ID
// @route   GET /api/routes/:id
routesRouter.get('/:id', optionalAuth, async (req, res) => {
  try {
    const route = await Route.findById(req.params.id)
      .populate('bus', 'busNumber registrationNumber model status currentLocation currentSpeed');

    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, route });
  } catch (e) { sendRouteError(res, e); }
});

// @desc    Create new route (Admin)
// @route   POST /api/routes
routesRouter.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { routeCode, bus: busId, ...routeData } = req.body;

    if (routeCode) {
      const existing = await Route.findOne({ routeCode: routeCode.trim(), isActive: true });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Route with code "${routeCode}" already exists. Please choose a unique route code.`,
        });
      }
    }

    const route = await Route.create({
      ...routeData,
      routeCode: routeCode ? routeCode.trim() : undefined,
      bus: busId || null,
    });

    // If bus assigned, link bus to this route
    if (busId) {
      await Bus.findByIdAndUpdate(busId, { route: route._id });
    }

    const populatedRoute = await Route.findById(route._id)
      .populate('bus', 'busNumber registrationNumber model status currentLocation');

    res.status(201).json({ success: true, route: populatedRoute });
  } catch (e) { sendRouteError(res, e); }
});

// @desc    Update existing route (Admin)
// @route   PUT /api/routes/:id
routesRouter.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { routeCode, bus: busId, ...updateData } = req.body;

    const existingRoute = await Route.findById(req.params.id);
    if (!existingRoute) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    if (routeCode && routeCode.trim() !== existingRoute.routeCode) {
      const duplicate = await Route.findOne({
        _id: { $ne: req.params.id },
        routeCode: routeCode.trim(),
        isActive: true,
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Route code "${routeCode}" is already in use by another route.`,
        });
      }
      updateData.routeCode = routeCode.trim();
    }

    // Handle bus assignment changes
    if (busId !== undefined) {
      updateData.bus = busId || null;
      if (existingRoute.bus && (!busId || existingRoute.bus.toString() !== busId.toString())) {
        await Bus.findByIdAndUpdate(existingRoute.bus, { route: null });
      }
      if (busId) {
        await Bus.findByIdAndUpdate(busId, { route: req.params.id });
      }
    }

    const updatedRoute = await Route.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('bus', 'busNumber registrationNumber model status currentLocation');

    res.json({ success: true, route: updatedRoute });
  } catch (e) { sendRouteError(res, e); }
});

// @desc    Update only stops of a route (Admin)
// @route   PUT /api/routes/:id/stops
routesRouter.put('/:id/stops', protect, authorize('admin'), async (req, res) => {
  try {
    const { stops } = req.body;
    if (!Array.isArray(stops)) {
      return res.status(400).json({ success: false, message: 'Stops array is required' });
    }

    const route = await Route.findByIdAndUpdate(
      req.params.id,
      { stops },
      { new: true, runValidators: true }
    ).populate('bus', 'busNumber registrationNumber model status currentLocation');

    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, route });
  } catch (e) { sendRouteError(res, e); }
});

// @desc    Soft delete route (Admin)
// @route   DELETE /api/routes/:id
routesRouter.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

    // Safely unassign any bus assigned to this route without deleting bus records
    await Bus.updateMany({ route: route._id }, { route: null });

    route.isActive = false;
    await route.save();

    res.json({ success: true, message: 'Route deactivated successfully' });
  } catch (e) { sendRouteError(res, e); }
});

module.exports = routesRouter;

