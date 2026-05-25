// netlify/lib/db.ts
// 职责：统一管理 PostgreSQL 数据库连接池，防多实例连接溢出，并提供基础的 SQL 执行函数。
// 所有注释均使用中文，契合 AGENTS 规范。

import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * 获取数据库连接池单例
 */
export function getDbPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL 环境变量未配置，无法连接数据库");
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 10, // Serverless 环境下不宜设置过大
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

/**
 * 执行任意 SQL 查询并返回行数据
 * @param text SQL 查询文本
 * @param params SQL 占位符参数数组
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const dbPool = getDbPool();
  return dbPool.query<T>(text, params);
}
