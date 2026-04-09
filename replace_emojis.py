import sys, os
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
os.chdir(os.path.join(os.path.dirname(__file__), 'client', 'src'))

def patch(path, patches, add_icon_import=True):
    txt = open(path, encoding='utf-8').read()
    if add_icon_import and "from '@iconify/react'" not in txt:
        lines = txt.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('import '):
                lines.insert(i+1, "import { Icon } from '@iconify/react'")
                break
        txt = '\n'.join(lines)
        print(f'  + Icon import → {path}')
    for old, new in patches:
        if old in txt:
            txt = txt.replace(old, new)
            print(f'  OK: {repr(old[:55])}')
        else:
            print(f'  MISS: {repr(old[:55])}')
    open(path, 'w', encoding='utf-8').write(txt)

# ── Topbar.jsx ──────────────────────────────────────────────────────────────
print('=== Topbar.jsx ===')
patch('components/Topbar.jsx', [
    ('<span style={{ fontSize: 13 }}>⇄</span> Vista',
     '<Icon icon="lucide:arrows-left-right" width={14} /> Vista'),
    ("{ icon: '👤', label: 'Mis datos', path: '/mis-datos' },",
     "{ icon: 'lucide:user', label: 'Mis datos', path: '/mis-datos' },"),
    ("{ icon: '🔒', label: 'Cambiar contraseña', path: '/cambiar-password' },",
     "{ icon: 'lucide:lock', label: 'Cambiar contraseña', path: '/cambiar-password' },"),
    ('<span>{item.icon}</span> {item.label}',
     '<Icon icon={item.icon} width={14} /> {item.label}'),
])

# ── Colaborador.jsx ──────────────────────────────────────────────────────────
print('=== Colaborador.jsx ===')
patch('pages/Colaborador.jsx', [
    ("Hola, {usuario?.nombre?.split(' ')[0]} 👋",
     "Hola, {usuario?.nombre?.split(' ')[0]}"),
    ('↓ Descargar',
     '<><Icon icon="lucide:download" width={12} style={{verticalAlign:"middle",marginRight:2}} /> Descargar</>'),
    ("'Ver todos →'", '"Ver todos "'),
    ("'Detalle →'", '"Detalle "'),
    ('>Ver todos →<', '>Ver todos <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle"}} /><'),
    ('>Detalle →<', '>Detalle <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle"}} /><'),
])

# ── Jefatura.jsx ──────────────────────────────────────────────────────────
print('=== Jefatura.jsx ===')
patch('pages/Jefatura.jsx', [
    ('↓ Exportar a Excel',
     '<><Icon icon="lucide:download" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Exportar a Excel</>'),
    ('✨ Generador IA',
     '<><Icon icon="lucide:sparkles" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Generador IA</>'),
    (">Detalle →<", '>Detalle <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle"}} /></'),
    (">Ver todos →<", '>Ver todos <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle"}} /></'),
])

# ── AsignarCurso.jsx ──────────────────────────────────────────────────────
print('=== AsignarCurso.jsx ===')
patch('pages/AsignarCurso.jsx', [
    ('>✓ {exito}</div>',
     '><Icon icon="lucide:check" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {exito}</div>'),
    ('>✗ {error}</div>',
     '><Icon icon="lucide:x" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {error}</div>'),
    ("seleccionado && <span style={{ color: 'white', fontSize: 12 }}>✓</span>",
     'seleccionado && <Icon icon="lucide:check" color="white" width={12} />'),
    ("seleccionados.includes(u.id) && <span style={{ color: 'white', fontSize: 10 }}>✓</span>",
     'seleccionados.includes(u.id) && <Icon icon="lucide:check" color="white" width={10} />'),
])

# ── Capacitaciones.jsx ──────────────────────────────────────────────────────
print('=== Capacitaciones.jsx ===')
patch('pages/Capacitaciones.jsx', [
    ('<div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>',
     '<Icon icon="lucide:book-open" width={32} style={{marginBottom:12,display:"block",color:"#CCC"}} />'),
    ('<div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>',
     '<Icon icon="lucide:clipboard-list" width={32} style={{marginBottom:12,display:"block",color:"#CCC"}} />'),
    ("'✨ IA'",
     '<><Icon icon="lucide:sparkles" width={10} /> IA</>'),
    ('justifyContent: \'center\', fontSize: 20\n                  }}>\n                    📋',
     "justifyContent: 'center'\n                  }}>\n                    <Icon icon=\"lucide:clipboard-list\" width={22} style={{color:'#2B4BA0'}} />"),
])

# ── CertificadosGlobales.jsx ──────────────────────────────────────────────────
print('=== CertificadosGlobales.jsx ===')
patch('pages/CertificadosGlobales.jsx', [
    ('<div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>',
     '<Icon icon="lucide:clipboard-list" width={32} style={{marginBottom:8,display:"block",color:"#CCC"}} />'),
    ('↓ Descargar',
     '<><Icon icon="lucide:download" width={12} style={{verticalAlign:"middle",marginRight:2}} /> Descargar</>'),
])

# ── MisDatos.jsx ──────────────────────────────────────────────────────────
print('=== MisDatos.jsx ===')
patch('pages/MisDatos.jsx', [
    ('✓ {exito}',
     '<Icon icon="lucide:check" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {exito}'),
    ('✗ {error}',
     '<Icon icon="lucide:x" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {error}'),
])

# ── CambiarPassword.jsx ──────────────────────────────────────────────────────
print('=== CambiarPassword.jsx ===')
patch('pages/CambiarPassword.jsx', [
    ('✓ {exito}',
     '<Icon icon="lucide:check" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {exito}'),
])

# ── NuevoCurso.jsx ──────────────────────────────────────────────────────────
print('=== NuevoCurso.jsx ===')
patch('pages/NuevoCurso.jsx', [
    ("{completado ? '✓' : num}",
     '{completado ? <Icon icon="lucide:check" color="white" width={13} /> : num}'),
    ('✗ {error}',
     '<Icon icon="lucide:x" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {error}'),
    ('⏳ Subiendo archivo...',
     'Subiendo archivo...'),
    ('<div style={{ fontSize:24, marginBottom:8 }}>📁</div>',
     '<Icon icon="lucide:folder-open" width={28} style={{marginBottom:8,display:"block",color:"#888"}} />'),
    ("m.tipo === 'video' ? '🎥' : m.tipo === 'ppt' ? '📊' : '📄'",
     'm.tipo === \'video\' ? <Icon icon="lucide:video" width={14} /> : m.tipo === \'ppt\' ? <Icon icon="lucide:file-bar-chart" width={14} /> : <Icon icon="lucide:file-text" width={14} />'),
    ('"status-pill status-ok\">✓ Subido</span>',
     '"status-pill status-ok" style={{display:"inline-flex",alignItems:"center",gap:3}}><Icon icon="lucide:check" width={12} /> Subido</span>'),
    ('Siguiente →',
     'Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle"}} />'),
    ('← Atrás',
     '<Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle"}} /> Atrás'),
    ("alt.correcta && <span style={{ fontSize:10, color:'#1A7A45', whiteSpace:'nowrap' }}>✓ Correcta</span>",
     'alt.correcta && <span style={{ fontSize:10, color:"#1A7A45", whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:2 }}><Icon icon="lucide:check" width={10} /> Correcta</span>'),
    ('✓ Publicar curso',
     '<><Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Publicar curso</>'),
])

# ── Protocolos.jsx ──────────────────────────────────────────────────────────
print('=== Protocolos.jsx ===')
patch('pages/Protocolos.jsx', [
    ('<><div style={{ fontSize: 20, marginBottom: 4 }}>✓</div>',
     '<><Icon icon="lucide:check" width={24} style={{marginBottom:4,display:"block",color:"#1A7A45"}} />'),
    ("'⏳ Subiendo...' : '📁 Guardar protocolo'",
     "'Subiendo...' : <><Icon icon=\"lucide:folder-open\" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Guardar protocolo</>"),
    ('<div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>',
     '<Icon icon="lucide:loader-circle" width={28} style={{marginBottom:10,display:"block",color:"#888"}} />'),
    ('<div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>',
     '<Icon icon="lucide:folder-open" width={40} style={{marginBottom:12,display:"block",color:"#CCC"}} />'),
    ("fontSize: 18, flexShrink: 0 }}>📄</div>",
     "flexShrink: 0 }}><Icon icon=\"lucide:file-text\" width={18} style={{color:'#2B4BA0'}} /></div>"),
    ('✎ Editar',
     '<><Icon icon="lucide:pencil" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Editar</>'),
    ('🗑 Eliminar',
     '<><Icon icon="lucide:trash-2" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Eliminar</>'),
])

# ── Practicos.jsx ──────────────────────────────────────────────────────────
print('=== Practicos.jsx ===')
patch('pages/Practicos.jsx', [
    ("'✓ Google Calendar conectado'",
     '<><Icon icon="lucide:check" width={13} style={{verticalAlign:"middle",marginRight:3}} /> Google Calendar conectado</>'),
    ("'✕ Cancelar'",
     '<><Icon icon="lucide:x" width={13} /> Cancelar</>'),
    ('>✓ {exito}</div>',
     '><Icon icon="lucide:check" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {exito}</div>'),
    ('>✗ {error}</div>',
     '><Icon icon="lucide:x" width={14} style={{verticalAlign:"middle",marginRight:4}} /> {error}</div>'),
    ('📅 Conectar Google Calendar',
     '<><Icon icon="lucide:calendar" width={14} style={{verticalAlign:"middle",marginRight:4}} /> Conectar Google Calendar</>'),
    ("fontSize:14 }}>‹</button>",
     "display:'flex',alignItems:'center',justifyContent:'center' }}><Icon icon=\"lucide:chevron-left\" width={16} /></button>"),
    ("fontSize:14 }}>›</button>",
     "display:'flex',alignItems:'center',justifyContent:'center' }}><Icon icon=\"lucide:chevron-right\" width={16} /></button>"),
    ("color:'#4285F4', fontWeight:500, marginBottom:4 }}>📅 Google Calendar</div>",
     "color:'#4285F4', fontWeight:500, marginBottom:4, display:'flex', alignItems:'center', gap:3 }}><Icon icon=\"lucide:calendar\" width={10} /> Google Calendar</div>"),
    ('<div style={{ fontSize:11, color:\'#888\', marginBottom:4 }}>📋 {p.curso_nombre}</div>',
     '<div style={{ fontSize:11, color:\'#888\', marginBottom:4, display:\'flex\', alignItems:\'center\', gap:4 }}><Icon icon="lucide:clipboard-list" width={11} /> {p.curso_nombre}</div>'),
    ('<div style={{ fontSize:28, marginBottom:8 }}>📅</div>',
     '<Icon icon="lucide:calendar" width={28} style={{marginBottom:8,display:"block",color:"#CCC"}} />'),
    (">✕</button>",
     '><Icon icon="lucide:x" width={18} /></button>'),
    (">📅 Fecha *</label>",
     '><Icon icon="lucide:calendar" width={13} style={{marginRight:4}} /> Fecha *</label>'),
    (">🕐 Hora inicio *</label>",
     '><Icon icon="lucide:clock" width={13} style={{marginRight:4}} /> Hora inicio *</label>'),
    (">🕐 Hora término</label>",
     '><Icon icon="lucide:clock" width={13} style={{marginRight:4}} /> Hora término</label>'),
    (">📍 Ubicación</label>",
     '><Icon icon="lucide:map-pin" width={13} style={{marginRight:4}} /> Ubicación</label>'),
    (">☰ Descripción</label>",
     '><Icon icon="lucide:align-left" width={13} style={{marginRight:4}} /> Descripción</label>'),
    ("🕐 {p.hora_inicio?.slice(0,5)}{p.hora_fin ? ` — ${p.hora_fin.slice(0,5)}` : ''}",
     '<><Icon icon="lucide:clock" width={11} style={{marginRight:3}} /> {p.hora_inicio?.slice(0,5)}{p.hora_fin ? ` — ${p.hora_fin.slice(0,5)}` : \'\'}</>'),
    ("📍 {p.sede_nombre}",
     '<><Icon icon="lucide:map-pin" width={11} style={{marginRight:3}} /> {p.sede_nombre}</>'),
])

print('\n=== DONE ===')