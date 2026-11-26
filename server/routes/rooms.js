const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAuth, requireTeacher } = require('../middleware/auth');

// GET /api/rooms - Lista salas do campus (exige autenticação JWT)
router.get('/', requireAuth, (req, res) => {
  try {
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY block, name ASC').all();
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/rooms - Adiciona nova sala de aula ou laboratório
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

// PATCH /api/rooms/:id - Calibra coordenadas GPS da sala (restrito ao docente que ministra aula na sala ou admin)
router.patch('/:id', requireTeacher, (req, res) => {
  try {
    const roomId = Number(req.params.id);
    const { latitude, longitude, default_radius_meters, name } = req.body;

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Sala não encontrada.' });
    }

    if (req.authUser.role !== 'admin') {
      const assigned = db.prepare(`
        SELECT 1 FROM courses WHERE room_id = ? AND teacher_id = ?
        UNION
        SELECT 1 FROM class_sessions WHERE room_id = ? AND teacher_id = ?
        LIMIT 1
      `).get(roomId, req.authUser.id, roomId, req.authUser.id);

      if (!assigned) {
        return res.status(403).json({
          success: false,
          error_code: 'FORBIDDEN_ROOM_ACCESS',
          message: 'Você só pode calibrar salas vinculadas às suas disciplinas ou sessões.'
        });
      }
    }

    const nextLat = latitude !== undefined ? Number(latitude) : room.latitude;
    const nextLon = longitude !== undefined ? Number(longitude) : room.longitude;
    const nextRadius = default_radius_meters !== undefined ? Number(default_radius_meters) : room.default_radius_meters;
    const nextName = name || room.name;

    if (Number.isNaN(nextLat) || Number.isNaN(nextLon) || nextLat < -90 || nextLat > 90 || nextLon < -180 || nextLon > 180) {
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
