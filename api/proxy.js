/**
 * Vercel Serverless Function — API 反向代理
 * 将 /api/* 请求转发到 https://fufu.iqach.top/*
 * 注入 CORS 响应头，解决浏览器跨域问题
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const TARGET_API = 'https://fufu.iqach.top';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-api-key,anthropic-version',
};

module.exports = async function handler(req, res) {
  // 处理 CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // 将 /api/xxx 转为目标路径 /xxx
  const targetPath = req.url.replace(/^\/api/, '') || '/';
  const targetUrl = new URL(TARGET_API + targetPath);

  const isHttps = targetUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.hostname,
    },
  };

  // 移除可能导致上游拒绝的头部
  delete options.headers['origin'];
  delete options.headers['referer'];

  return new Promise((resolve, reject) => {
    const proxyReq = transport.request(options, (proxyRes) => {
      const responseHeaders = {
        ...proxyRes.headers,
        ...CORS_HEADERS,
      };

      // 移除 transfer-encoding，让 Node.js/Vercel 自行处理
      delete responseHeaders['transfer-encoding'];

      res.writeHead(proxyRes.statusCode, responseHeaders);
      proxyRes.pipe(res, { end: true });
      proxyRes.on('end', resolve);
    });

    proxyReq.on('error', (err) => {
      console.error('[proxy] upstream error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ error: 'Bad Gateway', detail: err.message }));
      }
      resolve();
    });

    // 将请求体转发
    if (req.body) {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      proxyReq.write(body);
      proxyReq.end();
    } else {
      req.pipe(proxyReq, { end: true });
    }
  });
};
