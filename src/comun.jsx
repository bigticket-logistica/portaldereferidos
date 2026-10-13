// Piezas que se repiten en las tres pantallas.
import { useState } from 'react'

export const CURP_RE = /^[A-Z]{4}[0-9]{6}[HMX][A-Z]{5}[A-Z0-9][0-9]$/
export const RFC_RE = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/
export const soloDigitos = (v) => String(v || '').replace(/\D/g, '')
export const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const fechaCorta = (v) => {
  if (!v) return ''
  const d = new Date(String(v).length <= 10 ? v + 'T12:00:00' : v)
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export function Campo({ label, ayuda, error, children }) {
  return (
    <label className={`campo${error ? ' con-error' : ''}`}>
      <span className="campo-l">{label}</span>
      {children}
      {error ? <span className="campo-e">{error}</span> : ayuda && <span className="campo-a">{ayuda}</span>}
    </label>
  )
}

// Contraseña con ojo para mostrarla u ocultarla.
export function Clave({ value, onChange, placeholder, autoComplete = 'current-password' }) {
  const [ver, setVer] = useState(false)
  return (
    <div className="clave">
      <input type={ver ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" className="ojo" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}>
        {ver ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.1 6.1C4 7.5 2.6 9.6 2 12c1 2.5 5 7 10 7 1.8 0 3.4-.5 4.8-1.3" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}

export function Logo({ blanco = true, alto = 30 }) {
  return <img src={blanco ? '/logo-bigticket-blanco.png' : '/logo-bt-naranjo-negro.png'} alt="Bigticket" style={{ height: alto }} />
}

// Teléfono de México: la bandera y el +52 van fijos y la persona escribe solo
// sus 10 dígitos. La bandera es un dibujo y no un emoji, porque en Windows los
// emojis de banderas se ven como las letras "MX".
// Si pegan el número completo (+52, +52 1 o 52 1…), se queda con los 10 dígitos.
function soloDiezMX(v) {
  let d = String(v || '').replace(/\D/g, '')
  if (d.length > 10 && d.startsWith('52')) d = d.slice(2)
  if (d.length > 10 && d.startsWith('1')) d = d.slice(1)
  return d.slice(0, 10)
}

export function TelefonoMX({ value, onChange, placeholder = '10 dígitos' }) {
  return (
    <div className="tel-mx">
      <span className="tel-pref" aria-hidden="true">
        <svg width="22" height="15" viewBox="0 0 3 2" role="img">
          <rect width="1" height="2" fill="#006847" />
          <rect x="1" width="1" height="2" fill="#fff" />
          <rect x="2" width="1" height="2" fill="#CE1126" />
          <circle cx="1.5" cy="1" r=".22" fill="#8C5A2B" />
        </svg>
        +52
      </span>
      <input type="tel" inputMode="numeric" value={value} placeholder={placeholder} autoComplete="tel-national"
        aria-label="Teléfono de México, 10 dígitos después del +52"
        onChange={e => onChange(soloDiezMX(e.target.value))} />
    </div>
  )
}
