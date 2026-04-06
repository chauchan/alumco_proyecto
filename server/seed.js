require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function seed() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'alumco',
  });

  try {
    // Obtener sedes
    const [sedes] = await conn.query('SELECT id, nombre FROM sedes');
    if (sedes.length === 0) {
      console.error('✗ No hay sedes. Corre npm run db:migrate primero.');
      process.exit(1);
    }
    const hualpen   = sedes.find(s => s.nombre.includes('Hualp')) || sedes[0];
    const coyhaique = sedes.find(s => s.nombre.includes('Coyh'))  || sedes[0];

    const usuarios = [
      // Jefatura
      { nombre:'Valentina Garrido',    identificador:'jefatura',    password:'jefatura123',  rol:'jefatura',   tipo:null,        sede: null },
      // Admin de sede
      { nombre:'Carmen Rojas',     identificador:'admin.hualpen', password:'admin123',   rol:'admin_sede', tipo:null,        sede: hualpen.id },
      { nombre:'Roberto Fuentes',  identificador:'admin.coyhaique',password:'admin123',  rol:'admin_sede', tipo:null,        sede: coyhaique.id },
      // Profesores
      { nombre:'Luis Morales',     identificador:'luis.morales',  password:'profesor123', rol:'profesor',  tipo:null,        sede: hualpen.id },
      { nombre:'Ana Fierro',       identificador:'ana.fierro',    password:'profesor123', rol:'profesor',  tipo:null,        sede: coyhaique.id },
      // Colaboradores Hualpén
      { nombre:'María González',   identificador:'maria.gonzalez',password:'alumco2026', rol:'colaborador',tipo:'fijo',      sede: hualpen.id },
      { nombre:'Jorge Pérez',      identificador:'jorge.perez',   password:'alumco2026', rol:'colaborador',tipo:'reemplazo', sede: hualpen.id },
      { nombre:'Ana López',        identificador:'ana.lopez',     password:'alumco2026', rol:'colaborador',tipo:'fijo',      sede: hualpen.id },
      { nombre:'Rosa Castro',      identificador:'rosa.castro',   password:'alumco2026', rol:'colaborador',tipo:'fijo',      sede: hualpen.id },
      // Colaboradores Coyhaique
      { nombre:'Pedro Navarro',    identificador:'pedro.navarro', password:'alumco2026', rol:'colaborador',tipo:'fijo',      sede: coyhaique.id },
      { nombre:'Laura Díaz',       identificador:'laura.diaz',    password:'alumco2026', rol:'colaborador',tipo:'reemplazo', sede: coyhaique.id },
    ];

    let creados = 0;
    let omitidos = 0;

    for (const u of usuarios) {
      const [existe] = await conn.query('SELECT id FROM usuarios WHERE identificador = ?', [u.identificador]);
      if (existe.length > 0) {
        console.log(`  ↷ Ya existe: ${u.identificador}`);
        omitidos++;
        continue;
      }
      const hash = bcrypt.hashSync(u.password, 10);
      await conn.query(
        'INSERT INTO usuarios (nombre, identificador, password_hash, rol, tipo_contrato, sede_id) VALUES (?, ?, ?, ?, ?, ?)',
        [u.nombre, u.identificador, hash, u.rol, u.tipo, u.sede]
      );
      console.log(`  ✓ Creado: ${u.identificador} (${u.rol})`);
      creados++;
    }

    console.log(`\n✓ Seed completado: ${creados} creados, ${omitidos} ya existían`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('USUARIOS DE PRUEBA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ROL              IDENTIFICADOR         CONTRASEÑA');
    console.log('──────────────────────────────────────────────────');
    console.log('Jefatura         jefatura              jefatura123');
    console.log('Admin Hualpén    admin.hualpen          admin123');
    console.log('Admin Coyhaique  admin.coyhaique        admin123');
    console.log('Profesor         luis.morales           profesor123');
    console.log('Profesor         ana.fierro             profesor123');
    console.log('Colaborador      maria.gonzalez         alumco2026');
    console.log('Colaborador      jorge.perez            alumco2026');
    console.log('Colaborador      pedro.navarro          alumco2026');
    console.log('──────────────────────────────────────────────────');

  } catch (err) {
    console.error('✗ Error en seed:', err.message);
  } finally {
    await conn.end();
  }
}

seed();
