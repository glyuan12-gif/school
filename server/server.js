const express = require('express');
const cors = require('cors');
const db = require('./db');

const usersRouter = require('./routes/users');
const postsRouter = require('./routes/posts');
const messagesRouter = require('./routes/messages');
const lettersRouter = require('./routes/letters');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== 中间件 ==========

// CORS 配置 - 开发阶段允许所有来源
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// JSON 解析
app.use(express.json({ limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ========== 路由 ==========

app.use('/api', usersRouter);
app.use('/api/posts', postsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/letters', lettersRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

// 全局错误处理
app.use((err, req, res, _next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

// ========== 启动服务器 ==========

app.listen(PORT, () => {
  console.log(`树洞后端服务已启动: http://localhost:${PORT}`);
  console.log(`数据库文件: ${db.name}`);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭服务器...');
  db.close();
  process.exit(0);
});

module.exports = app;
