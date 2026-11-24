const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/courses - Lista todas as disciplinas com professores e salas padrão
router.get('/', (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT 
        c.*, 
        u.name as teacher_name, 
        u.email as teacher_email,
        r.name as room_name, 
        r.block as room_block,
        r.latitude as room_latitude,
        r.longitude as room_longitude,
        r.default_radius_meters,
        (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = c.id) as enrolled_count,
        (SELECT COUNT(*) FROM class_sessions s WHERE s.course_id = c.id) as total_sessions
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN rooms r ON c.room_id = r.id
      ORDER BY c.name ASC
    `).all();

    res.json({ success: true, courses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/courses/:id - Detalhes da disciplina com alunos
router.get('/:id', (req, res) => {
  try {
    const courseId = req.params.id;

    const course = db.prepare(`
      SELECT 
        c.*, 
        u.name as teacher_name, 
        r.name as room_name, 
        r.block as room_block,
        r.latitude as room_latitude,
        r.longitude as room_longitude
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN rooms r ON c.room_id = r.id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Disciplina não encontrada.' });
    }

    const students = db.prepare(`
      SELECT 
        u.id, 
        u.name, 
        u.registration_number, 
        u.email, 
        u.avatar_url,
        (SELECT COUNT(*) FROM attendances a 
         JOIN class_sessions s ON a.session_id = s.id 
         WHERE s.course_id = ? AND a.student_id = u.id AND a.status IN ('present', 'manual_approved')
        ) as presences_count,
        (SELECT COUNT(*) FROM class_sessions s WHERE s.course_id = ?) as total_sessions
      FROM course_students cs
      JOIN users u ON cs.student_id = u.id
      WHERE cs.course_id = ?
      ORDER BY u.name ASC
    `).all(courseId, courseId, courseId);

    const sessions = db.prepare(`
      SELECT s.*, r.name as room_name,
        (SELECT COUNT(*) FROM attendances a WHERE a.session_id = s.id AND a.status IN ('present', 'manual_approved')) as present_count
      FROM class_sessions s
      JOIN rooms r ON s.room_id = r.id
      WHERE s.course_id = ?
      ORDER BY s.date DESC, s.start_time DESC
    `).all(courseId);

    res.json({ success: true, course, students, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
