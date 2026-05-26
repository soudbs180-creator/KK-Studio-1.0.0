// server/lib/db.js
// 职责：管理 PostgreSQL 数据库连接池单例，供整个后端服务公用。
// 遵守规范：所有注释使用中文，以清晰说明设计意图和规避机制。

const { Pool } = require('pg');

let pool = null;

/**
 * 获取或初始化 PostgreSQL 数据库连接池单例
 * 根据运行环境和连接配置，自动判定是否启用 SSL。
 * 生产环境（production）或显式指定 sslmode=require 时强制开启 SSL 校验，
 * 但通过 rejectUnauthorized: false 豁免自签名证书校验，防止外部云数据库连接失败。
 */
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('[数据库连接] 警告：未配置 DATABASE_URL 环境变量。');
    }

    const needsSsl = connectionString && 
      (connectionString.includes('sslmode=require') || process.env.NODE_ENV === 'production');

    pool = new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

module.exports = {
  getPool,
};
