/**
 * zhiChat 本地代理服务
 * 同时承担两个职责：
 *   1. 静态文件服务 — 返回 index.html / style.css / app.js 等
 *   2. API 反向代理 — 将 /api/* 路径的请求转发到 TARGET_API，并注入 CORS 响应头
 *
 * 使用方式：
 *   node proxy.js
 * 然后浏览器访问 http://localhost:4174
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 4174;
const TARGET_API = 'https://fufu.iqach.top';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-api-key,anthropic-version',
};

function serveStatic(req, res) {
  const parsed = url.parse(req.url);
  let filePath = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

function proxyRequest(req, res) {
  // 拼接目标 URL，/api/xxx -> TARGET_API + /xxx
  const targetPath = req.url.replace(/^\/api/, '');
  const targetUrl = url.parse(TARGET_API + targetPath);

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 443,
    path: targetUrl.path,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.hostname,
    },
  };

  // 删除代理自身相关的 header，避免 upstream 报错
  delete options.headers['origin'];
  delete options.headers['referer'];

  const protocol = targetUrl.protocol === 'https:' ? https : http;

  const proxyReq = protocol.request(options, (proxyRes) => {
    // 注入 CORS 响应头
    const responseHeaders = {
      ...proxyRes.headers,
      ...CORS_HEADERS,
    };

    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[proxy] upstream error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ error: 'Bad Gateway', detail: err.message }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  // CORS 预检请求直接放行
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // /api/* 转发代理
  if (req.url.startsWith('/api/') || req.url === '/api') {
    proxyRequest(req, res);
    return;
  }

  // 其余请求提供静态文件
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n✅ zhiChat 代理服务已启动`);
  console.log(`   本地访问: http://localhost:${PORT}`);
  console.log(`   API 代理: http://localhost:${PORT}/api/* → ${TARGET_API}/*`);
  console.log(`   按 Ctrl+C 停止\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ 端口 ${PORT} 已被占用，请关闭占用进程后重试。\n`);
  } else {
    console.error('服务器错误:', err);
  }
  process.exit(1);
});
