const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// ========== 叶脉号生成工具 ==========

const VEIN_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateVeinId() {
  let veinId;
  let exists;
  do {
    veinId = '';
    for (let i = 0; i < 7; i++) {
      veinId += VEIN_CHARS[Math.floor(Math.random() * VEIN_CHARS.length)];
    }
    const row = db.prepare('SELECT 1 FROM users WHERE vein_id = ?').get(veinId);
    exists = !!row;
  } while (exists);
  return veinId;
}

// ========== POST /api/register - 注册 ==========

router.post('/register', (req, res) => {
  try {
    const id = crypto.randomUUID();
    const veinId = generateVeinId();
    const now = new Date().toISOString();

    const {
      nickname = '',
      avatar_style = 'emoji',
      avatar_emoji = '',
      avatar_color = '',
      mbti = '',
      role = '',
      bio = '',
      show_vein_id = 1,
    } = req.body;

    db.prepare(`
      INSERT INTO users (id, vein_id, nickname, avatar_style, avatar_emoji, avatar_color, mbti, role, bio, show_vein_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, veinId, nickname, avatar_style, avatar_emoji, avatar_color, mbti, role, bio, show_vein_id, now);

    res.status(201).json({
      success: true,
      user: { id, vein_id: veinId, nickname, avatar_style, avatar_emoji, avatar_color, mbti, role, bio, show_vein_id, created_at: now },
    });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ success: false, error: '注册失败' });
  }
});

// ========== GET /api/user/:veinId - 通过叶脉号查找用户 ==========

router.get('/user/:veinId', (req, res) => {
  try {
    const { veinId } = req.params;
    const user = db.prepare('SELECT * FROM users WHERE vein_id = ?').get(veinId);

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    if (!user.show_vein_id) {
      return res.status(403).json({ success: false, error: '该用户不允许通过叶脉号查找' });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('查找用户失败:', err);
    res.status(500).json({ success: false, error: '查找失败' });
  }
});

// ========== PUT /api/user/:id - 更新用户信息 ==========

router.put('/user/:id', (req, res) => {
  try {
    const { id } = req.params;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const fields = ['nickname', 'avatar_style', 'avatar_emoji', 'avatar_color', 'mbti', 'role', 'bio', 'show_vein_id'];
    const updates = [];
    const values = [];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' });
    }

    values.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('更新用户失败:', err);
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

module.exports = router;
