// ═══════════════════════════════════════════════════════════════════════════
// Acceso del referidor: ingresar, crear cuenta y recuperar la contraseña.
//
// Al crear la cuenta, los datos del referidor viajan en los metadatos del
// usuario. Si Supabase pide confirmar el correo, la cuenta de referidor se
// completa sola en el primer ingreso (Panel), con esos mismos datos.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { supabase, mensajeError } from './supabase'
import { Campo, Clave, Logo, CURP_RE, soloDigitos, TelefonoMX } from './comun'

export default function Acceso({ recuperando, onListo, onRecuperando }) {
  // Se abre en la inscripción, como la maqueta: la mayoría llega a inscribirse.
  const [modo, setModo] = useState(recuperando ? 'nueva' : 'registro')
  // Al validar el código de recuperación se abre la sesión: ahí toca crear la
  // contraseña nueva, en esta misma pantalla.
  useEffect(() => { if (recuperando) setModo('nueva') }, [recuperando])

  return (
    <div className="acceso">
      <header className="acceso-cab">
        <Logo />
        <h1>Presenta a un transportista y gana <span>$2,000</span></h1>
        <p className="acceso-p">Por cada persona o empresa que facture y entre a rutear con Bigticket.</p>
      </header>

      <main className="acceso-hoja">
        {modo === 'ingresar' && <Ingresar onOlvide={() => setModo('recuperar')} onInscribirme={() => setModo('registro')} />}
        {modo === 'registro' && <Registro onYaTengo={() => setModo('ingresar')} />}
        {(modo === 'recuperar' || modo === 'codigo') && (
          <Recuperar paso={modo} setPaso={setModo} onRecuperando={onRecuperando} />
        )}
        {modo === 'nueva' && <ClaveNueva onListo={onListo} />}
      </main>
    </div>
  )
}

function Ingresar({ onOlvide, onInscribirme }) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const entrar = async (e) => {
    e.preventDefault(); setErr('')
    if (!correo.trim() || !clave) { setErr('Escribe tu correo y tu contraseña.'); return }
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password: clave })
    setBusy(false)
    if (error) setErr(mensajeError(error))
  }

  return (
    <form onSubmit={entrar} className="form">
      <h2 className="form-t">Entra a tu cuenta</h2>
      <p className="form-p">Si ya usas el Portal del Transportista, entra con ese mismo correo y contraseña: es una sola cuenta para los dos.</p>
      {err && <div className="aviso error">{err}</div>}
      <Campo label="Tu correo"><input type="email" value={correo} onChange={e => setCorreo(e.target.value)} autoComplete="email" placeholder="tucorreo@ejemplo.com" /></Campo>
      <Campo label="Contraseña"><Clave value={clave} onChange={setClave} placeholder="Tu contraseña" /></Campo>
      <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      <button type="button" className="link" onClick={onOlvide}>¿Olvidaste tu contraseña?</button>
      <div className="cambio-modo"><span>¿Todavía no estás inscrito?</span>
        <button type="button" onClick={onInscribirme}>Inscríbete aquí ›</button></div>
    </form>
  )
}

function Registro({ onYaTengo }) {
  const [d, setD] = useState({ nombre: '', curp: '', correo: '', telefono: '', clave: '', clave2: '' })
  const [err, setErr] = useState({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const S = (k, v) => setD(x => ({ ...x, [k]: v }))

  const validar = () => {
    const e = {}
    if (d.nombre.trim().split(/\s+/).length < 2) e.nombre = 'Escribe tu nombre y al menos un apellido.'
    if (!CURP_RE.test(d.curp)) e.curp = 'Son 18 caracteres. Revísalo en tu INE o en gob.mx/curp.'
    if (!/^\S+@\S+\.\S+$/.test(d.correo.trim())) e.correo = 'Revisa el correo.'
    if (soloDigitos(d.telefono).length !== 10) e.telefono = 'Son 10 dígitos, sin el 52.'
    if (d.clave.length < 8) e.clave = 'Mínimo 8 caracteres.'
    else if (d.clave !== d.clave2) e.clave2 = 'Las contraseñas no coinciden.'
    setErr(e)
    return Object.keys(e).length === 0
  }

  const crear = async (ev) => {
    ev.preventDefault(); setGeneral('')
    if (!validar()) return
    setBusy(true)
    const datos = { nombre: d.nombre.trim(), curp: d.curp, telefono: soloDigitos(d.telefono) }
    const { data, error } = await supabase.auth.signUp({
      email: d.correo.trim().toLowerCase(), password: d.clave,
      options: { data: { referidor: datos }, emailRedirectTo: window.location.origin },
    })
    if (error) { setBusy(false); setGeneral(mensajeError(error)); return }
    if (data.session) {
      // Sin confirmación de correo: la cuenta de referidor se crea en el acto.
      const { error: e2 } = await supabase.rpc('fn_ref_crear_referidor', { p_nombre: datos.nombre, p_curp: datos.curp, p_telefono: datos.telefono })
      setBusy(false)
      if (e2) setGeneral(mensajeError(e2))
      return
    }
    setBusy(false); setEnviado(true)
  }

  if (enviado) return (
    <div className="form">
      <div className="aviso ok">Te enviamos un correo a <b>{d.correo.trim().toLowerCase()}</b>. Abre el enlace para confirmar tu cuenta y después ingresa con tu contraseña.</div>
      <button className="btn sec" onClick={onYaTengo}>Ir a entrar</button>
    </div>
  )

  return (
    <form onSubmit={crear} className="form" noValidate>
      <h2 className="form-t">Inscríbete y recibe tu QR</h2>
      <button type="button" className="aviso-cuenta-bt" onClick={onYaTengo}>
        <b>¿Ya tienes cuenta en el Portal del Transportista?</b> No te inscribas de nuevo: entra con el mismo correo y la misma contraseña. ›
      </button>
      {general && <div className="aviso error">{general}</div>}
      <Campo label="Tu nombre" error={err.nombre}><input value={d.nombre} onChange={e => S('nombre', e.target.value)} autoComplete="name" placeholder="Nombre y apellido" /></Campo>
      <Campo label="Tu WhatsApp" error={err.telefono}>
        <TelefonoMX value={d.telefono} onChange={v => S('telefono', v)} />
      </Campo>
      <Campo label="Tu CURP" error={err.curp} ayuda="Con ella evitamos cuentas duplicadas.">
        <input value={d.curp} onChange={e => S('curp', e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 18))} autoCapitalize="characters" className="mono" placeholder="18 caracteres" />
      </Campo>
      <Campo label="Tu correo" error={err.correo}><input type="email" value={d.correo} onChange={e => S('correo', e.target.value)} autoComplete="email" placeholder="tucorreo@ejemplo.com" /></Campo>
      <div className="dos">
        <Campo label="Crea una contraseña" error={err.clave}><Clave value={d.clave} onChange={v => S('clave', v)} placeholder="Mínimo 8" autoComplete="new-password" /></Campo>
        <Campo label="Repítela" error={err.clave2}><Clave value={d.clave2} onChange={v => S('clave2', v)} autoComplete="new-password" /></Campo>
      </div>
      <button className="btn" disabled={busy}>{busy ? 'Creando tu QR…' : 'Recibir mi QR'}</button>
      <div className="cambio-modo"><span>¿Ya estás inscrito?</span>
        <button type="button" onClick={onYaTengo}>Entra aquí ›</button></div>
      <div className="nota-caja">
        <span className="nota-i">i</span>
        <span>No necesitas trabajar con Bigticket. Al inscribirte aceptas las{' '}
          <a href="#condiciones" onClick={e => { e.preventDefault(); document.getElementById('condiciones')?.showModal() }}>reglas del programa</a>
          {' '}y el uso de tus datos. No participa el personal de Bigticket.</span>
      </div>
      <Condiciones />
    </form>
  )
}

// Las condiciones en una ventana, para leerlas sin salir del registro.
export function Condiciones() {
  return (
    <dialog id="condiciones" className="dialogo">
      <h2>Condiciones del programa de referidos</h2>
      <ul>
        <li>Pueden participar choferes, empresas y cualquier persona mayor de edad, excepto trabajadores de Bigticket.</li>
        <li>Solo cuentan referidos que puedan facturar a Bigticket: personas morales o personas físicas con actividad empresarial, con RFC. Un RFC se puede referir una sola vez; vale la primera invitación con la que se registra.</li>
        <li>No cuentan los RFC que ya trabajan con Bigticket, ni referirte a ti mismo.</li>
        <li>Premio de $500 MXN cuando el referido tiene su contrato firmado y su primera ruta pagada.</li>
        <li>Premio de $1,500 MXN cuando completa al menos 15 rutas pagadas dentro de los 30 días siguientes a su primera ruta.</li>
        <li>Bigticket valida cada premio antes de pagarlo y puede anularlo si detecta registros falsos o duplicados. Los pagos se hacen por transferencia a la CLABE que registres.</li>
      </ul>
      <form method="dialog"><button className="btn">Entendido</button></form>
    </dialog>
  )
}

function Recuperar({ paso, setPaso, onRecuperando }) {
  const [correo, setCorreo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const pedir = async (e) => {
    e?.preventDefault(); setErr('')
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) { setErr('Escribe el correo de tu cuenta.'); return }
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim().toLowerCase())
    setBusy(false)
    if (error) { setErr(mensajeError(error)); return }
    setPaso('codigo')
  }

  const verificar = async (e) => {
    e.preventDefault(); setErr('')
    if (soloDigitos(codigo).length !== 6) { setErr('El código tiene 6 dígitos.'); return }
    setBusy(true)
    onRecuperando(true)
    const { error } = await supabase.auth.verifyOtp({ email: correo.trim().toLowerCase(), token: soloDigitos(codigo), type: 'recovery' })
    setBusy(false)
    if (error) { onRecuperando(false); setErr(mensajeError(error)) }
  }

  return paso === 'recuperar' ? (
    <form onSubmit={pedir} className="form">
      <h2 className="form-t">Recupera tu contraseña</h2>
      <p className="form-p">Te enviaremos un código de 6 dígitos a tu correo.</p>
      {err && <div className="aviso error">{err}</div>}
      <Campo label="Correo"><input type="email" value={correo} onChange={e => setCorreo(e.target.value)} autoComplete="email" /></Campo>
      <button className="btn" disabled={busy}>{busy ? 'Enviando…' : 'Enviar código'}</button>
      <button type="button" className="link" onClick={() => setPaso('ingresar')}>Volver a ingresar</button>
    </form>
  ) : (
    <form onSubmit={verificar} className="form">
      <h2 className="form-t">Escribe el código</h2>
      <p className="form-p">Llegó a <b>{correo.trim().toLowerCase()}</b> y dura 1 hora.</p>
      {err && <div className="aviso error">{err}</div>}
      <input className="codigo" inputMode="numeric" maxLength={6} value={codigo} onChange={e => setCodigo(soloDigitos(e.target.value))} placeholder="000000" autoComplete="one-time-code" />
      <button className="btn" disabled={busy}>{busy ? 'Verificando…' : 'Continuar'}</button>
      <button type="button" className="link" onClick={pedir}>Enviar otro código</button>
    </form>
  )
}

function ClaveNueva({ onListo }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const guardar = async (e) => {
    e.preventDefault(); setErr('')
    if (p1.length < 8) { setErr('Mínimo 8 caracteres.'); return }
    if (p1 !== p2) { setErr('Las contraseñas no coinciden.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: p1 })
    setBusy(false)
    if (error) { setErr(mensajeError(error)); return }
    onListo()
  }
  return (
    <form onSubmit={guardar} className="form">
      <h2 className="form-t">Crea tu contraseña nueva</h2>
      {err && <div className="aviso error">{err}</div>}
      <Campo label="Contraseña nueva"><Clave value={p1} onChange={setP1} autoComplete="new-password" placeholder="Mínimo 8 caracteres" /></Campo>
      <Campo label="Repite la contraseña"><Clave value={p2} onChange={setP2} autoComplete="new-password" /></Campo>
      <button className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Guardar y entrar'}</button>
    </form>
  )
}
