# ALUMCO — Plataforma de Capacitación Interna

## Stack
- **Frontend**: React + Vite + React Router
- **Backend**: Node.js + Express
- **Base de datos**: PostgreSQL
- **Despliegue**: Railway

## Estructura
```
alumco/
├── client/   → Frontend React
└── server/   → Backend Express + API
```

## Cómo arrancar

### Backend
```bash
cd server
npm install
cp .env.example .env   # completar variables
npm run dev
```

### Frontend
```bash
cd client
npm install
npm run dev
```

## Roles del sistema
| Rol | Descripción |
|-----|-------------|
| colaborador | Accede a cursos y certificados |
| profesor | Sube contenido y valida certificados |
| admin_sede | Gestiona su ELEAM |
| jefatura | Vista global de toda la ONG |

## Equipo
- Elisa Merino (PM + dev) — Auth, usuarios
- Renato Barra (dev) — Cursos, evaluaciones
- Ignacio Llarlluri (dev) — Certificados, reportes, IA
