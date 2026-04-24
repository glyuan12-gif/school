const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// ========== POST /api/letters - 发信 ==========

router.post('/', (req, res) => {
  try {
    const { from_id, to_vein_id, content } = req.body;

    if (!from_id || !to_vein_id || !content) {
      return res.status(400).json({ success: false, error: 'from_id、to_vein_id 和 content 为必填项' });
    }

    // 验证发送者存在
    const sender = db.prepare('SELECT 1 FROM users WHERE id = ?').get(from_id);
    if (!sender) {
      return res.status(404).json({ success: false, error: '发送者不存在' });
    }

    // 通过叶脉号查找接收者
    const receiver = db.prepare('SELECT id FROM users WHERE vein_id = ?').get(to_vein_id);
    if (!receiver) {
      return res.status(404).json({ success: false, error: '接收者不存在，请检查叶脉号' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO letters (id, from_id, to_id, content, written_at, opened)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(id, from_id, receiver.id, content, now);

    res.status(201).json({
      success: true,
      letter: { id, from_id, to_id: receiver.id, content, written_at: now, opened: 0 },
    });
  } catch (err) {
    console.error('发信失败:', err);
    res.status(500).json({ success: false, error: '发信失败' });
  }
});

// ========== GET /api/letters/inbox - 收件箱 ==========

router.get('/inbox', (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ success: false, error: '请提供 user_id 参数' });
    }

    const letters = db.prepare(`
      SELECT l.*,
        u_from.nickname AS from_nickname, u_from.vein_id AS from_vein_id,
        u_from.avatar_style AS from_avatar_style, u_from.avatar_emoji AS from_avatar_emoji, u_from.avatar_color AS from_avatar_color
      FROM letters l
      LEFT JOIN users u_from ON l.from_id = u_from.id
      WHERE l.to_id = ?
      ORDER BY l.written_at DESC
    `).all(user_id);

    res.json({ success: true, letters });
  } catch (err) {
    console.error('获取收件箱失败:', err);
    res.status(500).json({ success: false, error: '获取收件箱失败' });
  }
});

// ========== GET /api/letters/sent - 已发送的信 ==========

router.get('/sent', (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ success: false, error: '请提供 user_id 参数' });
    }

    const letters = db.prepare(`
      SELECT l.*,
        u_to.nickname AS to_nickname, u_to.vein_id AS to_vein_id,
        u_to.avatar_style AS to_avatar_style, u_to.avatar_emoji AS to_avatar_emoji, u_to.avatar_color AS to_avatar_color
      FROM letters l
      LEFT JOIN users u_to ON l.to_id = u_to.id
      WHERE l.from_id = ?
      ORDER BY l.written_at DESC
    `).all(user_id);

    res.json({ success: true, letters });
  } catch (err) {
    console.error('获取已发送信件失败:', err);
    res.status(500).json({ success: false, error: '获取已发送信件失败' });
  }
});

// ========== PUT /api/letters/:id/open - 开封信件 ==========

router.put('/:id/open', (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();

    const letter = db.prepare('SELECT * FROM letters WHERE id = ?').get(id);
    if (!letter) {
      return res.status(404).json({ success: false, error: '信件不存在' });
    }

    if (letter.opened) {
      return res.json({ success: true, letter });
    }

    db.prepare('UPDATE letters SET opened = 1, open_at = ? WHERE id = ?').run(now, id);

    const updated = db.prepare('SELECT * FROM letters WHERE id = ?').get(id);
    res.json({ success: true, letter: updated });
  } catch (err) {
    console.error('开封信件失败:', err);
    res.status(500).json({ success: false, error: '开封信件失败' });
  }
});

module.exports = router;
