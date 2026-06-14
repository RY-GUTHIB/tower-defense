/**
 * tower-defense 本地服务端
 * 启动：node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { IncomingForm } = require('formidable');

const PORT = 3000;
const ADMIN_PASSWORD = 'admin888';
const ROOT = __dirname;

// 项目内资源目录（服务器进程有写权限时优先使用，文件持久化）
const PROJECT_ASSETS_DIR = path.join(ROOT, 'public', 'assets');

// 上传图片降级存储目录（系统临时目录，沙箱不可写但服务器进程可写）
const UPLOAD_DIR = path.join(os.tmpdir(), 'tower-defense-uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * 保存上传文件：优先写项目目录，失败则降级到临时目录
 * 返回 { destPath, usedProjectDir }
 */
function saveUploadFile(folder, ext, fileBuf) {
  const fileName = crypto.randomBytes(8).toString('hex') + ext;
  // 尝试写项目目录
  try {
    const projectDir = path.join(PROJECT_ASSETS_DIR, folder);
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
    const projectPath = path.join(projectDir, fileName);
    fs.writeFileSync(projectPath, fileBuf);
    console.log('[upload] saved to project:', projectPath);
    return { filePath: projectPath, url: '/assets/' + folder + '/' + fileName, stored: 'project' };
  } catch (e) {
    console.warn('[upload] project dir not writable, falling back to temp:', e.code, e.message);
  }
  // 降级：写临时目录
  const tempDir = path.join(UPLOAD_DIR, folder);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, fileName);
  fs.writeFileSync(tempPath, fileBuf);
  console.log('[upload] saved to temp:', tempPath);
  return { filePath: tempPath, url: '/assets/' + folder + '/' + fileName, stored: 'temp' };
}

// MIME
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

function readJSON(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function replyJSON(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

// ---- 路由 ----
async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  try {
    // --- API: 验证密码 ---
    if (url.pathname === '/api/auth' && method === 'POST') {
      const body = await readJSON(req);
      replyJSON(res, body.password === ADMIN_PASSWORD ? 200 : 401,
        body.password === ADMIN_PASSWORD ? { ok: true, token: 'admin-session' } : { ok: false, error: '密码错误' });
      return;
    }

    // --- API: 更新配置 ---
    if (url.pathname === '/api/config' && method === 'POST') {
      const body = await readJSON(req);
      if (body.password !== ADMIN_PASSWORD) { replyJSON(res, 401, { ok: false, error: '密码错误' }); return; }
      const configPath = path.join(ROOT, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(body.config, null, 2), 'utf-8');
      console.log('[config] updated, size:', JSON.stringify(body.config).length);
      replyJSON(res, 200, { ok: true, message: '配置已保存' });
      return;
    }

    // --- API: 测试项目目录写权限 ---
    if (url.pathname === '/api/test-write' && method === 'POST') {
      const results = {};
      // 测试 PROJECT_ASSETS_DIR
      try {
        const testDir = path.join(PROJECT_ASSETS_DIR, 'general');
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
        const testPath = path.join(testDir, '.write-test-' + Date.now() + '.txt');
        fs.writeFileSync(testPath, 'test', 'utf-8');
        const stat = fs.statSync(testPath);
        fs.unlinkSync(testPath);
        results.projectAssetsDir = { ok: true, path: testDir, size: stat.size };
      } catch (e) {
        results.projectAssetsDir = { ok: false, error: e.code + ': ' + e.message };
      }
      // 测试 config.json 写权限
      try {
        const configPath = path.join(ROOT, 'config.json');
        const content = fs.readFileSync(configPath, 'utf-8');
        fs.writeFileSync(configPath, content, 'utf-8');
        results.configJson = { ok: true };
      } catch (e) {
        results.configJson = { ok: false, error: e.code + ': ' + e.message };
      }
      replyJSON(res, 200, results);
      return;
    }

    // --- API: 上传图片 ---
    if (url.pathname === '/api/upload' && method === 'POST') {
      const allowedFolders = ['towers', 'monsters', 'spells', 'levels', 'general'];
      const allowedExts = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];

      const form = new IncomingForm({
        multiples: false,
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024,
        uploadDir: UPLOAD_DIR   // 控制临时文件目录，避免系统清理
      });

      form.parse(req, (err, fields, files) => {
        if (err) { console.error('[upload] parse err:', err.message); replyJSON(res, 400, { ok: false, error: '解析失败: ' + err.message }); return; }
        try {
          const getField = k => Array.isArray(fields[k]) ? fields[k][0] : fields[k];
          const pwd = getField('password');
          if (pwd !== ADMIN_PASSWORD) { replyJSON(res, 401, { ok: false, error: '密码错误' }); return; }

          const folder = allowedFolders.includes(getField('folder')) ? getField('folder') : 'general';
          const fe = Array.isArray(files.image) ? files.image[0] : files.image;
          if (!fe || !fe.filepath) { replyJSON(res, 400, { ok: false, error: '未选择图片' }); return; }

          const ext = path.extname(fe.originalFilename || 'file').toLowerCase();
          if (!allowedExts.includes(ext)) { replyJSON(res, 400, { ok: false, error: '不支持的格式: ' + ext }); return; }

          // 读 formidable 临时文件内容
          let fileBuf;
          try {
            fileBuf = fs.readFileSync(fe.filepath);
          } catch (readErr) {
            console.error('[upload] temp file gone:', readErr.message);
            return replyJSON(res, 500, { ok: false, error: '上传超时，请重试' });
          }

          // 保存文件（优先项目目录，降级到临时目录）
          const result = saveUploadFile(folder, ext, fileBuf);

          console.log('[upload] saved:', result.url, '(' + fs.statSync(result.filePath).size + ' bytes, ' + result.stored + ')');
          replyJSON(res, 200, { ok: true, url: result.url, filename: path.basename(result.filePath), stored: result.stored });
        } catch (innerErr) {
          console.error('[upload] err:', innerErr.message);
          replyJSON(res, 500, { ok: false, error: '处理失败: ' + innerErr.message });
        }
      });
      return;
    }

    // --- ?admin 重定向 ---
    if (url.pathname === '/' && url.searchParams.has('admin')) {
      res.writeHead(302, { 'Location': '/admin.html' }); res.end(); return;
    }

    // --- 静态文件服务 ---
    let reqPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    let fullPath;

    if (reqPath.startsWith('/uploads/')) {
      fullPath = path.join(UPLOAD_DIR, reqPath.replace('/uploads/', ''));
    } else if (reqPath.startsWith('/assets/')) {
      // 优先项目目录，找不到则回退到 upload 临时目录
      const localPath = path.join(PROJECT_ASSETS_DIR, path.normalize(reqPath.replace('/assets/', '')).replace(/^(\.\.(\/|\\|$))+/, ''));
      const tmpPath = path.join(UPLOAD_DIR, reqPath.replace('/assets/', ''));
      if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
        fullPath = localPath;
      } else if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).isFile()) {
        fullPath = tmpPath;
      } else {
        fullPath = localPath; // 返回 404 的那个路径
      }
    } else {
      const safePath = path.normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
      fullPath = path.join(ROOT, safePath);
    }

    if (!fullPath.startsWith(UPLOAD_DIR) && !fullPath.startsWith(ROOT)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(fullPath).pipe(res);
    } else {
      res.writeHead(404); res.end('Not found: ' + reqPath);
    }
  } catch (e) {
    console.error('[error]', e.message);
    replyJSON(res, 500, { ok: false, error: e.message });
  }
}

// ---- 启动 ----
// 全局兜底：未捕获异常不崩进程
process.on('uncaughtException', (err) => {
  if (err.code === 'ENOENT') {
    console.error('[uncaught] ENOENT (file gone):', err.path || err.message);
    return;
  }
  console.error('[uncaught]', err);
});

// 启动前检查项目目录写权限
var _projectDirWritable = false;
try {
  const testFile = path.join(PROJECT_ASSETS_DIR, '.write-test');
  if (!fs.existsSync(PROJECT_ASSETS_DIR)) fs.mkdirSync(PROJECT_ASSETS_DIR, { recursive: true });
  fs.writeFileSync(testFile, 'test', 'utf-8');
  fs.unlinkSync(testFile);
  _projectDirWritable = true;
} catch (e) { /* not writable */ }

const server = http.createServer(handleRequest);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('[fatal] Port ' + PORT + ' is already in use. Kill the old process first.');
    process.exit(1);
  }
  throw err;
});
server.listen(PORT, '127.0.0.1', () => {
  var mode = _projectDirWritable ? '项目目录（文件持久化 ✅）' : '系统临时目录（重启可能丢失 ⚠️）';
  console.log('='.repeat(50));
  console.log('  tower-defense server ready');
  console.log('  http://localhost:' + PORT);
  console.log('  admin: http://localhost:' + PORT + '/admin.html');
  console.log('  文件存储: ' + mode);
  if (!_projectDirWritable) {
    console.log('');
    console.log('  ⚠️  项目目录不可写（沙箱限制）');
    console.log('  ⚠️  请在 PowerShell 中手动运行以启用持久化：');
    console.log('        cd ' + ROOT);
    console.log('        node server.js');
  }
  console.log('='.repeat(50));
});
