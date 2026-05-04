export default function MascotaFoye({ size = 80, estado = 'neutral', animate = false }) {
  const bounce = animate
    ? { animation: 'foyeBounce 2s ease-in-out infinite' }
    : {}

  const petaloColors = ['#E8505B', '#2B4BA0', '#F5A623', '#7BC67A', '#E8505B', '#2B4BA0']

  return (
    <>
      <style>{`
        @keyframes foyeBounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-5px); }
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={bounce}
      >
        {/* Sombra */}
        <ellipse cx="40" cy="77" rx="14" ry="3.5" fill="rgba(0,0,0,.12)" />

        {/* Tallo */}
        <path d="M40 60 Q38 70 37 74" stroke="#5aaf59" strokeWidth="3" strokeLinecap="round" />

        {/* Hoja izquierda */}
        <ellipse cx="32" cy="66" rx="7" ry="3" fill="#7BC67A" transform="rotate(-35 32 66)" />

        {/* Hoja derecha */}
        <ellipse cx="46" cy="68" rx="6" ry="2.5" fill="#7BC67A" transform="rotate(25 46 68)" />

        {/* 6 pétalos en colores del logo */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const rad = (deg * Math.PI) / 180
          const cx = 40 + 19 * Math.cos(rad)
          const cy = 38 + 19 * Math.sin(rad)
          return (
            <ellipse
              key={i}
              cx={cx}
              cy={cy}
              rx="7"
              ry="9.5"
              fill={petaloColors[i]}
              opacity={estado === 'activo' ? 1 : 0.85}
              transform={`rotate(${deg} ${cx} ${cy})`}
            />
          )
        })}

        {/* Cuerpo central blanco + azul oscuro */}
        <circle cx="40" cy="38" r="17" fill="white" />
        <circle cx="40" cy="38" r="15" fill="#1E3A6E" />

        {/* Brillo */}
        <ellipse
          cx="35" cy="32" rx="5" ry="3"
          fill="rgba(255,255,255,.18)"
          transform="rotate(-15 35 32)"
        />

        {/* Ojos */}
        <circle cx="34.5" cy="37" r={estado === 'activo' ? 3.5 : 3} fill="white" />
        <circle cx="45.5" cy="37" r={estado === 'activo' ? 3.5 : 3} fill="white" />
        <circle cx="35"   cy="37" r="1.6" fill="#0D2B5E" />
        <circle cx="46"   cy="37" r="1.6" fill="#0D2B5E" />
        <circle cx="35.5" cy="36" r=".7"  fill="white" />
        <circle cx="46.5" cy="36" r=".7"  fill="white" />

        {/* Boca */}
        {estado === 'activo' ? (
          <path d="M33 43 Q40 51 47 43" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M34 43 Q40 47 46 43" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        )}

        {/* Cachetes y detalles cuando está activo */}
        {estado === 'activo' && (
          <>
            <ellipse cx="27" cy="43" rx="4" ry="2.5" fill="rgba(232,80,91,.3)" />
            <ellipse cx="53" cy="43" rx="4" ry="2.5" fill="rgba(232,80,91,.3)" />
            <circle cx="14" cy="22" r="5" fill="#F5A623" opacity=".5" />
            <circle cx="14" cy="22" r="2.5" fill="white" opacity=".8" />
            <circle cx="66" cy="22" r="5" fill="#E8505B" opacity=".5" />
            <circle cx="66" cy="22" r="2.5" fill="white" opacity=".8" />
            <circle cx="14" cy="56" r="4" fill="#7BC67A" opacity=".4" />
            <circle cx="66" cy="56" r="4" fill="#2B4BA0" opacity=".4" />
          </>
        )}
      </svg>
    </>
  )
}
