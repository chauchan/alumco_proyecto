import { useState, useEffect } from 'react'

function leer() {
  return {
    textoGrande:   localStorage.getItem('acc-texto-grande')   === '1',
    altoContraste: localStorage.getItem('acc-alto-contraste') === '1',
  }
}

export function useAccesibilidad() {
  const [acc, setAcc] = useState(leer)

  useEffect(() => {
    const html = document.documentElement
    html.classList.toggle('texto-grande',   acc.textoGrande)
    html.classList.toggle('alto-contraste', acc.altoContraste)
    localStorage.setItem('acc-texto-grande',   acc.textoGrande   ? '1' : '0')
    localStorage.setItem('acc-alto-contraste', acc.altoContraste ? '1' : '0')
  }, [acc])

  // Aplica las clases guardadas al montar (para rutas que no pasan por Login)
  useEffect(() => {
    const saved = leer()
    const html = document.documentElement
    html.classList.toggle('texto-grande',   saved.textoGrande)
    html.classList.toggle('alto-contraste', saved.altoContraste)
  }, [])

  const toggle = (key) => setAcc(prev => ({ ...prev, [key]: !prev[key] }))

  return { acc, toggle }
}