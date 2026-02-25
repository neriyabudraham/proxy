import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'proxy_manager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

export async function initDB() {
  const client = await pool.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'viewer',
        parent_id INTEGER REFERENCES users(id),
        password_setup BOOLEAN DEFAULT false,
        invite_token VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Add invite_token column if not exists (for existing tables)
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='invite_token') THEN
          ALTER TABLE users ADD COLUMN invite_token VARCHAR(255);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        main_ip VARCHAR(50) NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS proxy_ips (
        id SERIAL PRIMARY KEY,
        ip VARCHAR(50) NOT NULL,
        port INTEGER DEFAULT 8080,
        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS phone_numbers (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(50) NOT NULL,
        proxy_id INTEGER NOT NULL REFERENCES proxy_ips(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key VARCHAR(255) NOT NULL,
        value VARCHAR(255) NOT NULL,
        UNIQUE(user_id, key)
      );
    `);
    
    console.log('Database initialized');
  } finally {
    client.release();
  }
}

// Helper functions for database queries
export const db = {
  async query(text, params) {
    const result = await pool.query(text, params);
    return result.rows;
  },
  
  async queryOne(text, params) {
    const result = await pool.query(text, params);
    return result.rows[0];
  },
  
  async execute(text, params) {
    const result = await pool.query(text, params);
    return { rowCount: result.rowCount, rows: result.rows };
  }
};
