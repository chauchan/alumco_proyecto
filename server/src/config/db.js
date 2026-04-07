require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  ssl:                { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit:    10,
  enableKeepAlive:    true,
  keepAliveInitialDelay: 10000
});

pool.getConnection()
  .then(conn => {
    console.log('✓ Conectado a MySQL');
    conn.release();
  })
  .catch(err => console.error('✗ Error conexión MySQL:', err.message));

// Wrapper: convierte $1,$2... (postgres style) a ? (mysql style)
// y devuelve { rows } igual que pg para no cambiar el resto del código
const _query = pool.query.bind(pool);

pool.query = async (sql, params = []) => {
  const mysqlSql = sql.replace(/\$\d+/g, '?');
  const finalSql = mysqlSql
    .replace(/= true\b/gi, '= 1')
    .replace(/= false\b/gi, '= 0');

  const ejecutar = () => _query(finalSql, params);

  let rows;
  try {
    [rows] = await ejecutar();
  } catch (err) {
    if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
      [rows] = await ejecutar();
    } else {
      throw err;
    }
  }

  return {
    rows: Array.isArray(rows) ? rows : [rows],
    rowCount: Array.isArray(rows) ? rows.length : 1,
    lastID: rows?.insertId
  };
};

module.exports = pool;
