const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// ========== POST /api/messages - 发送私信 ==========

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
      INSERT INTO messages (id, from_id, to_id, content, created_at, read)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(id, from_id, receiver.id, content, now);

    res.status(201).json({ success: true, message: { id, from_id, to_id: receiver.id, content, created_at: now, read: 0 } });
  } catch (err) {
    console.error('发送私信失败:', err);
    res.status(500).json({ success: false, error: '发送私信失败' });
  }
});

// ========== GET /api/messages/:userId - 获取与某用户的私信记录 ==========

router.get('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { other_id } = req.query;

    if (!other_id) {
      return res.status(400).json({ success: false, error: '请提供 other_id 参数指定对话对象' });
    }

    const messages = db.prepare(`
      SELECT m.*,
        u_from.nickname AS from_nickname, u_from.vein_id AS from_vein_id,
        u_to.nickname AS to_nickname, u_to.vein_id AS to_vein_id
      FROM messages m
      LEFT JOIN users u_from ON m.from_id = u_from.id
      LEFT JOIN users u_to ON m.to_id = u_to.id
      WHERE (m.from_id = ? AND m.to_id = ?) OR (m.from_id = ? AND m.to_id = ?)
      ORDER BY m.created_at ASC
    `).all(userId, other_id, other_id, userId);

    res.json({ success: true, messages });
  } catch (err) {
    console.error('获取私信记录失败:', err);
    res.status(500).json({ success: false, error: '获取私信记录失败' });
  }
});

module.exports = router;
