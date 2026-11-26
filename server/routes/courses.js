const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAuth, requireTeacher } = require('../middleware/auth');

function isValidHexColor(color) {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color.trim());
}

// GET /api/courses - Lista apenas disciplinas vinculadas ao usuário autenticado
router.get('/', requireAuth, (req, res) => {
  try {
    const { id: authUserId, role: authRole } = req.authUser;
    let courses;

    if (authRole === 'admin') {
      courses = db.prepare(`
        SELECT c.*, u.name as teacher_name, r.name as room_name, r.block as room_block,
               r.latitude as room_latitude, r.longitude as room_longitude, r.default_radius_meters,
               (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = c.id) as enrolled_count,
               (SELECT COUNT(*) FROM class_sessions s WHERE s.course_id = c.id) as total_sessions
        FROM courses c
        JOIN users u ON c.teacher_id = u.id
        LEFT JOIN rooms r ON c.room_id = r.id
        ORDER BY c.name ASC
      `).all();
    } else if (authRole === 'teacher') {
      courses = db.prepare(`
        SELECT c.*, u.name as teacher_name, r.name as room_name, r.block as room_block,
               r.latitude as room_latitude, r.longitude as room_longitude, r.default_radius_meters,
               (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = c.id) as enrolled_count,
               (SELECT COUNT(*) FROM class_sessions s WHERE s.course_id = c.id) as total_sessions
        FROM courses c
        JOIN users u ON c.teacher_id = u.id
        LEFT JOIN rooms r ON c.room_id = r.id
        WHERE c.teacher_id = ?
        ORDER BY c.name ASC
      `).all(authUserId);
    } else {
      courses = db.prepare(`
        SELECT c.*, u.name as teacher_name, r.name as room_name, r.block as room_block,
               r.latitude as room_latitude, r.longitude as room_longitude, r.default_radius_meters,
               (SELECT COUNT(*) FROM class_sessions s WHERE s.course_id = c.id) as total_sessions
        FROM course_students cs
        JOIN courses c ON cs.course_id = c.id
        JOIN users u ON c.teacher_id = u.id
        LEFT JOIN rooms r ON c.room_id = r.id
        WHERE cs.student_id = ?
        ORDER BY c.name ASC
      `).all(authUserId);
    }

    res.json({ success: true, courses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/courses - Docente cria nova turma/disciplina
router.post('/', requireTeacher, (req, res) => {
  try {
    const {
      name,
      code,
      description = '',
      semester = '2026/2',
      room_id = null,
      color = '#3b82f6',
      student_ids = null
    } = req.body;

    if (!name || !String(name).trim() || !code || !String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Informe o nome e o código da turma/disciplina.'
      });
    }

    const cleanName = String(name).trim();
    const cleanCode = String(code).trim().toUpperCase();
    const cleanDesc = String(description || '').trim();
    const cleanSemester = String(semester || '2026/2').trim() || '2026/2';
    const cleanColor = isValidHexColor(color) ? color.trim() : '#3b82f6';
    const parsedRoomId = room_id ? Number(room_id) : null;

    if (parsedRoomId !== null) {
      const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(parsedRoomId);
      if (!room) {
        return res.status(404).json({ success: false, message: 'Sala informada não encontrada.' });
      }
    }

    const existingCode = db.prepare('SELECT id FROM courses WHERE UPPER(code) = ?').get(cleanCode);
    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: `Já existe uma disciplina cadastrada com o código "${cleanCode}".`
      });
    }

    const teacherId = req.authUser.id;

    const createTx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO courses (name, code, description, teacher_id, semester, room_id, color)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(cleanName, cleanCode, cleanDesc, teacherId, cleanSemester, parsedRoomId, cleanColor);

      const newCourseId = result.lastInsertRowid;
      const insertEnroll = db.prepare('INSERT OR IGNORE INTO course_students (course_id, student_id) VALUES (?, ?)');

      if (Array.isArray(student_ids)) {
        const validStudentStmt = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'student'`);
        for (const rawId of student_ids) {
          const st = validStudentStmt.get(Number(rawId));
          if (st) insertEnroll.run(newCourseId, st.id);
        }
      } else {
        // Por padrão matricula os alunos ativos da base na nova turma
        const allStudents = db.prepare(`SELECT id FROM users WHERE role = 'student'`).all();
        for (const st of allStudents) {
          insertEnroll.run(newCourseId, st.id);
        }
      }

      return newCourseId;
    });

    const newCourseId = createTx();
    const created = db.prepare(`
      SELECT c.*, u.name as teacher_name, r.name as room_name, r.block as room_block,
             (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = c.id) as enrolled_count
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN rooms r ON c.room_id = r.id
      WHERE c.id = ?
    `).get(newCourseId);

    res.status(201).json({
      success: true,
      message: `Turma "${created.name}" (${created.code}) criada com sucesso!`,
      course: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/courses/:id - Docente titular edita turma/disciplina existente (anti-IDOR)
router.patch('/:id', requireTeacher, (req, res) => {
  try {
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ success: false, message: 'ID de disciplina inválido.' });
    }

    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Turma/disciplina não encontrada.' });
    }

    if (req.authUser.role !== 'admin' && course.teacher_id !== req.authUser.id) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_COURSE_ACCESS',
        message: 'Apenas o docente titular pode editar esta turma/disciplina.'
      });
    }

    const { name, code, description, semester, room_id, color, student_ids } = req.body;

    const nextName = name !== undefined ? String(name).trim() : course.name;
    const nextCode = code !== undefined ? String(code).trim().toUpperCase() : course.code;
    const nextDesc = description !== undefined ? String(description).trim() : course.description;
    const nextSemester = semester !== undefined ? String(semester).trim() : course.semester;
    const nextColor = color !== undefined && isValidHexColor(color) ? color.trim() : course.color;
    const nextRoomId = room_id !== undefined ? (room_id ? Number(room_id) : null) : course.room_id;

    if (!nextName || !nextCode) {
      return res.status(400).json({ success: false, message: 'Nome e código da disciplina não podem ficar vazios.' });
    }

    if (nextRoomId !== null) {
      const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(nextRoomId);
      if (!room) {
        return res.status(404).json({ success: false, message: 'Sala informada não encontrada.' });
      }
    }

    const duplicate = db.prepare('SELECT id FROM courses WHERE UPPER(code) = ? AND id != ?').get(nextCode, courseId);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `O código "${nextCode}" já está em uso por outra disciplina.`
      });
    }

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE courses
        SET name = ?, code = ?, description = ?, semester = ?, room_id = ?, color = ?
        WHERE id = ?
      `).run(nextName, nextCode, nextDesc, nextSemester, nextRoomId, nextColor, courseId);

      if (Array.isArray(student_ids)) {
        db.prepare('DELETE FROM course_students WHERE course_id = ?').run(courseId);
        const validStudentStmt = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'student'`);
        const insertEnroll = db.prepare('INSERT OR IGNORE INTO course_students (course_id, student_id) VALUES (?, ?)');
        for (const rawId of student_ids) {
          const st = validStudentStmt.get(Number(rawId));
          if (st) insertEnroll.run(courseId, st.id);
        }
      }
    });

    updateTx();

    const updated = db.prepare(`
      SELECT c.*, u.name as teacher_name, r.name as room_name, r.block as room_block,
             (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = c.id) as enrolled_count
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN rooms r ON c.room_id = r.id
      WHERE c.id = ?
    `).get(courseId);

    res.json({
      success: true,
      message: `Turma "${updated.name}" (${updated.code}) atualizada com sucesso!`,
      course: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/courses/:id - Docente titular exclui turma/disciplina e sessões vinculadas (anti-IDOR)
router.delete('/:id', requireTeacher, (req, res) => {
  try {
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ success: false, message: 'ID de disciplina inválido.' });
    }

    const course = db.prepare('SELECT id, name, code, teacher_id FROM courses WHERE id = ?').get(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Turma/disciplina não encontrada.' });
    }

    if (req.authUser.role !== 'admin' && course.teacher_id !== req.authUser.id) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_COURSE_ACCESS',
        message: 'Apenas o docente titular pode excluir esta turma/disciplina.'
      });
    }

    const deleteTx = db.transaction(() => {
      // Remove sessões vinculadas antes da disciplina (attendances/liveness_challenges usam ON DELETE CASCADE)
      db.prepare('DELETE FROM class_sessions WHERE course_id = ?').run(courseId);
      db.prepare('DELETE FROM course_students WHERE course_id = ?').run(courseId);
      db.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
    });

    deleteTx();

    res.json({
      success: true,
      message: `Turma "${course.name}" (${course.code}) excluída com sucesso.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/courses/:id - Detalhes da disciplina com controle estrito de vínculo (anti-IDOR)
router.get('/:id', requireAuth, (req, res) => {
  try {
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId)) {
      return res.status(400).json({ success: false, message: 'ID de disciplina inválido.' });
    }

    const course = db.prepare(`
      SELECT c.*, u.name as teacher_name, r.name as room_name, r.block as room_block,
             r.latitude as room_latitude, r.longitude as room_longitude
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN rooms r ON c.room_id = r.id
      WHERE c.id = ?
    `).get(courseId);

    if (!course) {
      return res.status(404).json({ success: false, message: 'Disciplina não encontrada.' });
    }

    const isOwnerTeacher = req.authUser.role === 'teacher' && course.teacher_id === req.authUser.id;
    const isAdmin = req.authUser.role === 'admin';
    const isEnrolledStudent = req.authUser.role === 'student' && Boolean(
      db.prepare('SELECT 1 FROM course_students WHERE course_id = ? AND student_id = ?').get(courseId, req.authUser.id)
    );

    if (!isOwnerTeacher && !isAdmin && !isEnrolledStudent) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_COURSE_ACCESS',
        message: 'Você não tem permissão para acessar esta disciplina.'
      });
    }

    let students = [];
    if (isOwnerTeacher || isAdmin) {
      students = db.prepare(`
        SELECT u.id, u.name, u.registration_number, u.email, u.avatar_url,
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
    }

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
