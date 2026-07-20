#!/usr/bin/env node
/**
 * 数据层入口文件 - SQLite 数据代理
 * 想象力平台数据层规范：
 * - 监听 PORT 环境变量（默认3002）
 * - 处理 /query (SELECT) 和 /exec (INSERT/UPDATE/DELETE) 请求
 * - 请求已通过 _data_guard.js 验签
 * 
 * 注意：此文件会在数据层容器中执行，容器环境包含：
 * - Node.js 运行时（由平台提供）
 * - /config/workspace/ 目录（持久化存储）
 * - SQLite 数据库文件
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = Number(process.env.PORT || 3002);
const DB_PATH = process.env.DB_PATH || '/config/workspace/ai_review.db';
const MIGRATIONS_DIR = process.env.DG_MIG_DIR || '/config/workspace/migrations';

// 确保 migrations 目录存在
try {
  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
} catch {}

// 确保 SQLite 可执行文件存在（使用 better-sqlite3 或系统 sqlite3）
let sqlite3Path = 'sqlite3';
try {
  // 检查是否有 better-sqlite3
  if (fs.existsSync('/usr/local/bin/sqlite3')) {
    sqlite3Path = '/usr/local/bin/sqlite3';
  }
} catch {}

// 执行 SQL 查询
function executeQuery(sql, params = []) {
  try {
    // 使用 sqlite3 命令行工具执行查询
    const paramsStr = params.length > 0 ? params.map(p => 
      typeof p === 'string' ? `'${p.replace(/'/g, "''")}'` : String(p)
    ).join(' ') : '';
    
    const cmd = `echo "${sql.replace(/"/g, '\\"')}" | ${sqlite3Path} "${DB_PATH}" -header -csv`;
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    
    // 解析 CSV 结果
    const lines = result.trim().split('\n');
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
      return { rows: [], fields: [] };
    }
    
    const fields = lines[0].split(',');
    const rows = lines.slice(1).map(line => {
      const values = line.split(',');
      const row = {};
      fields.forEach((field, i) => {
        row[field] = values[i] || null;
      });
      return row;
    });
    
    return { rows, fields };
  } catch (error) {
    throw new Error(`SQL执行失败: ${error.message}`);
  }
}

// 执行 SQL 语句（INSERT/UPDATE/DELETE）
function executeStatement(sql, params = []) {
  try {
    const cmd = `echo "${sql.replace(/"/g, '\\"')}" | ${sqlite3Path} "${DB_PATH}"`;
    execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    
    // 获取影响的行数和最后插入的ID
    const changes = execSync(`echo "SELECT changes();" | ${sqlite3Path} "${DB_PATH}"`, { encoding: 'utf-8' }).trim();
    const lastId = execSync(`echo "SELECT last_insert_rowid();" | ${sqlite3Path} "${DB_PATH}"`, { encoding: 'utf-8' }).trim();
    
    return {
      affectedRows: Number(changes) || 0,
      insertId: Number(lastId) || 0
    };
  } catch (error) {
    throw new Error(`SQL执行失败: ${error.message}`);
  }
}

// 运行迁移脚本
function runMigrations() {
  try {
    const appCode = 'shared'; // 独立数据层使用 shared
    const migDir = path.join(MIGRATIONS_DIR, appCode);
    
    if (!fs.existsSync(migDir)) return;
    
    const files = fs.readdirSync(migDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    files.forEach(file => {
      const sqlPath = path.join(migDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      try {
        execSync(`echo "${sql.replace(/"/g, '\\"')}" | ${sqlite3Path} "${DB_PATH}"`, { encoding: 'utf-8', timeout: 30000 });
        console.log(`[data] Migration applied: ${file}`);
      } catch (e) {
        console.error(`[data] Migration failed: ${file}`, e.message);
      }
    });
  } catch (e) {
    console.error('[data] Migration error:', e.message);
  }
}

// 启动时运行迁移
runMigrations();

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  const urlPath = (req.url || '').split('?')[0];
  
  // 健康检查
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', db: fs.existsSync(DB_PATH) ? 'exists' : 'not found' }));
    return;
  }
  
  // 解析请求体
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let data;
    try {
      data = body ? JSON.parse(body) : {};
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    
    try {
      // SELECT 查询
      if (urlPath === '/query') {
        const { sql, params } = data;
        if (!sql) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing sql' }));
          return;
        }
        
        const result = executeQuery(sql, params || []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      
      // INSERT/UPDATE/DELETE 执行
      if (urlPath === '/exec') {
        const { sql, params } = data;
        if (!sql) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing sql' }));
          return;
        }
        
        const result = executeStatement(sql, params || []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      
      // 未知路由
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      
    } catch (error) {
      console.error('[data] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[data] SQLite data layer listening on port ${PORT}`);
  console.log(`[data] Database: ${DB_PATH}`);
  console.log(`[data] DB exists: ${fs.existsSync(DB_PATH)}`);
});