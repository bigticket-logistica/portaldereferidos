// ═══════════════════════════════════════════════════════════════════════════
// Invitación pública (/r/BT-XXXXX): el referido deja sus datos sin crear
// cuenta. La función fn_ref_registrar_referido valida todo en la base y crea
// su tarjeta en el Kanban de Certificaciones, en Recepción.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { supabase, mensajeError } from './supabase'
import { Campo, Logo, CURP_RE, RFC_RE, soloDigitos } from './comun'

export default function Invitacion({ codigo }) {
  const origen = new URLSearchParams(window.location.search).get('o') === 'qr' ? 'qr' : 'link'
  const [quien, setQuien] = useState(undefined)       // nombre corto de quien invita
  const [d, setD] = useState({ tipo: 'persona_fisica', nombre: '', razon: '', curp: '', rfc: '', telefono: '', correo: '', sc: '', acepto: false })
  const [err, setErr] = useState({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)
  const [listo, setListo] = useState(false)
  const S = (k, v) => setD(x => ({ ...x, [k]: v }))
  const moral = d.tipo === 'persona_moral'

  useEffect(() => {
    supabase.rpc('fn_ref_invitacion', { p_codigo: codigo }).then(({ data }) => setQuien(data || null))
  }, [codigo])

  const validar = () => {
    const e = {}
    if (d.nombre.trim().split(/\s+/).length < 2) e.nombre = 'Escribe nombre y al menos un apellido.'
    if (moral && d.razon.trim().length < 3) e.razon = 'Escribe la razón social como aparece en tu constancia.'
    if (!CURP_RE.test(d.curp)) e.curp = 'Son 18 caracteres.'
    if (!RFC_RE.test(d.rfc) || d.rfc.length !== (moral ? 12 : 13)) e.rfc = moral ? 'El RFC de una persona moral tiene 12 caracteres.' : 'El RFC de una persona física tiene 13 caracteres.'
    if (soloDigitos(d.telefono).length !== 10) e.telefono = 'Son 10 dígitos, sin el 52.'
    if (d.correo && !/^\S+@\S+\.\S+$/.test(d.correo.trim())) e.correo = 'Revisa el correo.'
    if (!d.acepto) e.acepto = 'Para continuar acepta el uso de tus datos.'
    setErr(e)
    return Object.keys(e).length === 0
  }

  const enviar = async (ev) => {
    ev.preventDefault(); setGeneral('')
    if (!validar()) return
    setBusy(true)
    const { error } = await supabase.rpc('fn_ref_registrar_referido', {
      p_codigo: codigo, p_tipo: d.tipo, p_nombre: d.nombre.trim(), p_razon_social: moral ? d.razon.trim() : '',
      p_curp: d.curp, p_rfc: d.rfc, p_telefono: soloDigitos(d.telefono), p_correo: d.correo.trim(), p_sc: d.sc.trim(), p_origen: origen,
    })
    setBusy(false)
    if (error) { setGeneral(mensajeError(error)); return }
    setListo(true)
  }

  return (
    <div className="acceso">
      <header className="acceso-cab">
        <Logo />
        <h1>{quien ? <>{quien} te invita a operar con <span>Bigticket</span></> : <>Opera con <span>Bigticket</span></>}</h1>
        <p className="acceso-p">Buscamos transportistas que facturen, empresas o personas físicas con actividad empresarial, para rutas de última milla con Mercado Libre en México.</p>
        <ul className="acceso-beneficios">
          <li>Pagos semanales por ruta</li>
          <li>Tarifas por zona y tipo de vehículo</li>
          <li>Portal para ver tus pagos, facturas y reclamos</li>
        </ul>
      </header>

      <main className="acceso-hoja">
        {quien === null ? (
          <div className="form">
            <div className="aviso error">Este link de invitación no es válido. Pídele a quien te lo compartió que te lo envíe de nuevo.</div>
          </div>
        ) : listo ? (
          <div className="form">
            <h2 className="form-t">¡Listo, recibimos tus datos!</h2>
            <p className="form-p">Un supervisor de Bigticket te contactará por WhatsApp al {soloDigitos(d.telefono)} para explicarte los siguientes pasos y los documentos que necesitas.</p>
          </div>
        ) : (
          <form onSubmit={enviar} className="form" noValidate>
            <h2 className="form-t">Déjanos tus datos</h2>
            {general && <div className="aviso error">{general}</div>}
            <div className="segmento" role="radiogroup" aria-label="Tipo de contribuyente">
              {[['persona_fisica', 'Persona física'], ['persona_moral', 'Empresa (persona moral)']].map(([k, t]) => (
                <button type="button" key={k} role="radio" aria-checked={d.tipo === k} className={d.tipo === k ? 'on' : ''} onClick={() => S('tipo', k)}>{t}</button>
              ))}
            </div>
            {moral && (
              <Campo label="Razón social" error={err.razon}><input value={d.razon} onChange={e => S('razon', e.target.value)} /></Campo>
            )}
            <Campo label={moral ? 'Nombre del representante legal' : 'Nombre completo'} error={err.nombre}>
              <input value={d.nombre} onChange={e => S('nombre', e.target.value)} autoComplete="name" />
            </Campo>
            <Campo label={moral ? 'CURP del representante legal' : 'CURP'} error={err.curp}>
              <input className="mono" value={d.curp} onChange={e => S('curp', e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 18))} />
            </Campo>
            <Campo label={moral ? 'RFC de la empresa' : 'RFC con homoclave'} error={err.rfc} ayuda={moral ? '12 caracteres.' : '13 caracteres. Debes tener actividad empresarial para facturar.'}>
              <input className="mono" value={d.rfc} onChange={e => S('rfc', e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 13))} />
            </Campo>
            <Campo label="Teléfono celular" error={err.telefono} ayuda="10 dígitos. Te contactaremos por WhatsApp.">
              <input type="tel" inputMode="numeric" value={d.telefono} onChange={e => S('telefono', soloDigitos(e.target.value).slice(0, 10))} autoComplete="tel-national" />
            </Campo>
            <Campo label="Correo (opcional)" error={err.correo}><input type="email" value={d.correo} onChange={e => S('correo', e.target.value)} autoComplete="email" /></Campo>
            <Campo label="¿En qué ciudad o centro te gustaría operar? (opcional)"><input value={d.sc} onChange={e => S('sc', e.target.value)} placeholder="Por ejemplo: CDMX norte, Querétaro" /></Campo>
            <label className={`check${err.acepto ? ' con-error' : ''}`}>
              <input type="checkbox" checked={d.acepto} onChange={e => S('acepto', e.target.checked)} />
              <span>Acepto que Bigticket use estos datos para contactarme y evaluar mi alta como transportista.</span>
            </label>
            {err.acepto && <span className="campo-e">{err.acepto}</span>}
            <button className="btn" disabled={busy || quien === undefined}>{busy ? 'Enviando…' : 'Enviar mis datos'}</button>
          </form>
        )}
      </main>
    </div>
  )
}
