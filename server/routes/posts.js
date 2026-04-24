const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// ========== GET /api/posts - 获取帖子列表（支持分页、频道筛选） ==========

router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 20, channel } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let countSql = 'SELECT COUNT(*) AS total FROM posts';
    let listSql = `
      SELECT p.*, u.nickname, u.vein_id, u.avatar_style, u.avatar_emoji, u.avatar_color, u.mbti
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
    `;
    const params = [];

    if (channel) {
      countSql += ' WHERE channel = ?';
      listSql += ' WHERE p.channel = ?';
      params.push(channel);
    }

    listSql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';

    const { total } = db.prepare(countSql).get(...params);
    const posts = db.prepare(listSql).all(...params, Number(limit), offset);

    // 解析 tags JSON 字符串为数组
    posts.forEach((post) => {
      try {
        post.tags = JSON.parse(post.tags || '[]');
      } catch {
        post.tags = [];
      }
    });

    res.json({
      success: true,
      data: posts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error('获取帖子列表失败:', err);
    res.status(500).json({ success: false, error: '获取帖子列表失败' });
  }
});

// ========== POST /api/posts - 发帖 ==========

router.post('/', (req, res) => {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const {
      author_id,
      show_vein = 1,
      title = '',
      content,
      channel = 'default',
      tags = '[]',
      mood = '',
      image = '',
    } = req.body;

    if (!author_id || !content) {
      return res.status(400).json({ success: false, error: 'author_id 和 content 为必填项' });
    }

    // 验证用户存在
    const user = db.prepare('SELECT 1 FROM users WHERE id = ?').get(author_id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const tagsStr = typeof tags === 'string' ? tags : JSON.stringify(tags);

    db.prepare(`
      INSERT INTO posts (id, author_id, show_vein, title, content, channel, tags, mood, image, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, author_id, show_vein, title, content, channel, tagsStr, mood, image, now);

    const post = db.prepare(`
      SELECT p.*, u.nickname, u.vein_id, u.avatar_style, u.avatar_emoji, u.avatar_color, u.mbti
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.id = ?
    `).get(id);

    try {
      post.tags = JSON.parse(post.tags || '[]');
    } catch {
      post.tags = [];
    }

    res.status(201).json({ success: true, post });
  } catch (err) {
    console.error('发帖失败:', err);
    res.status(500).json({ success: false, error: '发帖失败' });
  }
});

// ========== GET /api/posts/:id - 获取帖子详情 ==========

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const post = db.prepare(`
      SELECT p.*, u.nickname, u.vein_id, u.avatar_style, u.avatar_emoji, u.avatar_color, u.mbti
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.id = ?
    `).get(id);

    if (!post) {
      return res.status(404).json({ success: false, error: '帖子不存在' });
    }

    try {
      post.tags = JSON.parse(post.tags || '[]');
    } catch {
      post.tags = [];
    }

    res.json({ success: true, post });
  } catch (err) {
    console.error('获取帖子详情失败:', err);
    res.status(500).json({ success: false, error: '获取帖子详情失败' });
  }
});

module.exports = router;
