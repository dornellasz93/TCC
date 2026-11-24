const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireTeacher } = require('../middleware/auth');

// GET /api/rooms - List all campus rooms
router.get('/', (req, res) => {
  try {
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY block, name ASC').all();
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/rooms - Add new classroom/lab
router.post('/', requireTeacher, (req, res) => {
  try {
    const { name, code, block, campus, latitude, longitude, default_radius_meters, description } = req.body;

    if (!name || !code || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Dados obrigatórios faltando.' });
    }

    const result = db.prepare(`
      INSERT INTO rooms (name, code, block, campus, latitude, longitude, default_radius_meters, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      code,
      block || 'Bloco Principal',
      campus || 'Campus Volta Redonda - Aterrado (UGB)',
      Number(latitude),
      Number(longitude),
      Number(default_radius_meters) || 35,
      description || ''
    );

    res.status(201).json({ success: true, message: 'Sala cadastrada com sucesso!', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/rooms/:id - Calibrate room GPS coordinates live (ideal for live TCC presentation room!)
router.patch('/:id', requireTeacher, (req, res) => {
  try {
    const roomId = req.params.id;
    const { latitude, longitude, default_radius_meters, name } = req.body;

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Sala não encontrada.' });
    }

    const nextLat = latitude !== undefined ? Number(latitude) : room.latitude;
    const nextLon = longitude !== undefined ? Number(longitude) : room.longitude;
    const nextRadius = default_radius_meters !== undefined ? Number(default_radius_meters) : room.default_radius_meters;
    const nextName = name || room.name;

    if (Number.isNaN(nextLat) || Number.isNaN(nextLon)) {
      return res.status(400).json({ success: false, message: 'Coordenadas GPS inválidas.' });
    }

    db.prepare(`
      UPDATE rooms
      SET name = ?, latitude = ?, longitude = ?, default_radius_meters = ?
      WHERE id = ?
    `).run(nextName, nextLat, nextLon, nextRadius, roomId);

    const updated = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    res.json({
      success: true,
      message: `Coordenadas da sala "${updated.name}" calibradas com sucesso (${nextLat.toFixed(6)}, ${nextLon.toFixed(6)}).`,
      room: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
