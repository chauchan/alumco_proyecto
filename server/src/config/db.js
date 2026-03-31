const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'alumco',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
});

pool.getConnection()
  .then(conn => {
    console.log('✓ Conectado a MySQL');
    conn.release();
  })
  .catch(err => console.error('✗ Error conexión MySQL:', err.message));

// mysql2 devuelve [rows, fields] — adaptamos para que el código existente
// siga usando pool.query() y reciba { rows }
const originalQuery = pool.query.bind(pool);
pool.query = async (sql, params = []) => {
  const [rows] = await originalQuery(sql, params);
  return { rows: Array.isArray(rows) ? rows : [rows], rowCount: Array.isArray(rows) ? rows.length : 1 };
};

module.exports = pool;
