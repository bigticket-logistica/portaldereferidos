// ═══════════════════════════════════════════════════════════════════════════
// Reglas del programa de referidos (maquetas de marketing, copiadas tal cual):
//   · ModalReglas: vista pública, se abre sin sesión desde el link "reglas del
//     programa" del formulario de inscripción (o directo con #reglas).
//   · PantallaReglas: pantalla 7 de la inscripción. Hay que marcar la casilla
//     para continuar; la fecha y hora de aceptación viajan con la inscripción.
// Los 7 puntos son el mismo texto en las dos vistas.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'

export const REGLAS = [
  ['Quién participa', 'Cualquier persona, excepto colaboradores de BigTicket.'],
  ['A quién puedes referir', 'Drivers con unidad propia que hoy no estén activos con BigTicket.'],
  ['Registro con tu QR', 'Tu referido debe registrarse con tu QR. Si dos personas lo refieren, el bono es para quien lo registró primero.'],
  ['Cuánto ganas por cada driver', '$500 MXN cuando hace su primera ruta + $1,500 MXN al cumplir 30 días activo, con mínimo 20 rutas y los indicadores DS, VS y PNR en meta.'],
  ['Cómo se cuentan los 30 días', 'Desde su primera ruta. Debe seguir activo el día del pago.'],
  ['Cuenta de pago', 'La cuenta bancaria para recibir tus bonos debe estar a tu nombre.'],
  ['Sin tope', 'Refiere a todos los drivers que quieras.'],
]

const Info = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
  </svg>
)

function Lista() {
  return (
    <>
      <ol className="rules-list">
        {REGLAS.map(([t, d], i) => (
          <li key={t} className="rules-item">
            <span className="rules-num">{i + 1}</span>
            <div><div className="rules-item-title">{t}</div><div className="rules-item-desc">{d}</div></div>
          </li>
        ))}
      </ol>
      <div className="rules-note"><Info /><span><strong>DS · VS · PNR</strong> son los indicadores de calidad de ruta.</span></div>
    </>
  )
}

// Link que abre el modal; el formulario conserva lo escrito.
export function LinkReglas({ children = 'reglas del programa', className = 'rules-link' }) {
  const [abierto, setAbierto] = useState(() => window.location.hash === '#reglas')
  const link = useRef(null)
  const cerrar = () => {
    setAbierto(false)
    if (window.location.hash === '#reglas') history.replaceState(null, '', window.location.pathname + window.location.search)
    setTimeout(() => link.current?.focus(), 0)
  }
  return (
    <>
      <a ref={link} href="#reglas" className={className} onClick={e => { e.preventDefault(); setAbierto(true) }}>{children}</a>
      {abierto && <ModalReglas onCerrar={cerrar} />}
    </>
  )
}

export function ModalReglas({ onCerrar }) {
  const ok = useRef(null)
  useEffect(() => {
    document.body.classList.add('rules-open')
    ok.current?.focus()
    const esc = e => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', esc)
    return () => { document.body.classList.remove('rules-open'); window.removeEventListener('keydown', esc) }
  }, [onCerrar])
  return (
    <div className="rules-overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title"
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="rules-modal">
        <div className="rules-head">
          <div style={{ flex: 1 }}>
            <h2 id="rules-title" className="rules-title">Reglas del programa de referidos</h2>
            <div className="rules-sub">Hasta $2,000 MXN por cada driver · Sin tope</div>
          </div>
          <button type="button" className="rules-close" aria-label="Cerrar" onClick={onCerrar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="rules-body"><Lista /></div>
        <div className="rules-foot"><button ref={ok} type="button" className="rules-ok" onClick={onCerrar}>Entendido</button></div>
      </div>
    </div>
  )
}

// Pantalla 7: paso de reglas de la inscripción.
export function PantallaReglas({ onVolver, onContinuar, busy }) {
  const [acepto, setAcepto] = useState(false)
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <div className="rules-screen">
      <div className="rules-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="rules-back" aria-label="Volver" onClick={onVolver}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div>
            <div className="rules-step">Programa de referidos · Paso 1 de 2</div>
            <h2 className="rules-title rules-title-hero">Reglas del programa</h2>
          </div>
        </div>
        <div className="rules-amounts">
          <div className="rules-amount"><b>$500</b><span>en su primera ruta</span></div>
          <div className="rules-amount"><b>+$1,500</b><span>a los 30 días activo</span></div>
        </div>
        <div className="rules-line">Hasta $2,000 MXN por cada driver · Sin tope de referidos</div>
      </div>
      <div className="rules-content">
        <div className="rules-eyebrow">LEE ANTES DE PARTICIPAR</div>
        <div className="rules-card"><Lista /></div>
        <label className="rules-accept">
          <input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)} />
          <span>Leí y acepto las reglas del programa de referidos.</span>
        </label>
        <button type="button" className="rules-continue" disabled={!acepto || busy}
          onClick={() => onContinuar(new Date().toISOString())}>
          {!acepto ? 'Acepta las reglas para continuar' : busy ? 'Creando tu QR…' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
