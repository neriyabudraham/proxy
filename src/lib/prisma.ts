import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient, type Client } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  libsql: Client | undefined;
  dbInitialized: boolean;
};

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";

const libsql = globalForPrisma.libsql ?? createClient({ url: dbUrl });
if (!globalForPrisma.libsql) globalForPrisma.libsql = libsql;

async function initializeDatabase() {
  if (globalForPrisma.dbInitialized) return;
  
  try {
    await libsql.execute(`
      CREATE TABLE IF NOT EXISTS User (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        name TEXT,
        role TEXT DEFAULT 'viewer',
        parentId TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        passwordSetup INTEGER DEFAULT 0,
        FOREIGN KEY (parentId) REFERENCES User(id)
      )
    `);
    
    await libsql.execute(`
      CREATE TABLE IF NOT EXISTS Server (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mainIp TEXT NOT NULL,
        userId TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
      )
    `);
    
    await libsql.execute(`
      CREATE TABLE IF NOT EXISTS ProxyIp (
        id TEXT PRIMARY KEY,
        ip TEXT NOT NULL,
        port INTEGER DEFAULT 8080,
        serverId TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (serverId) REFERENCES Server(id) ON DELETE CASCADE
      )
    `);
    
    await libsql.execute(`
      CREATE TABLE IF NOT EXISTS PasswordReset (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expiresAt TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("Database initialized successfully");
    globalForPrisma.dbInitialized = true;
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

function createPrismaClient() {
  const adapter = new PrismaLibSql({ url: dbUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

initializeDatabase();
