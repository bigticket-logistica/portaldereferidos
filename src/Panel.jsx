// ═══════════════════════════════════════════════════════════════════════════
// Panel del referidor: su código con el link y el QR, sus premios y el avance
// de cada referido. Todo se lee con su propia sesión: la base solo le devuelve
// lo suyo (RLS en ref_referidores y ref_premios, filtro por usuario en la vista
// vw_ref_mis_referidos).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { supabase, mensajeError } from './supabase'
import { Campo, Logo, CURP_RE, soloDigitos, pesos, fechaCorta } from './comun'

// El orden en que avanza un referido. Las etapas salen de vw_ref_avance.
const PASOS = [
  { k: 'registrado', t: 'Registrado' },
  { k: 'en_revision', t: 'En revisión' },
  { k: 'entrevista_alta', t: 'Entrevista y alta' },
  { k: 'firma_contrato', t: 'Firma de contrato' },
  { k: 'contrato_firmado', t: 'Contrato firmado' },
  { k: 'primera_ruta', t: 'Primera ruta', premio: 500 },
  { k: 'quince_rutas', t: '15 rutas en 30 días', premio: 1500 },
]
const indice = (etapa) => (etapa === 'sin_meta_30_dias' ? 5 : PASOS.findIndex(p => p.k === etapa))
// Hasta la firma, la etapa es la que está en curso; desde el contrato firmado,
// es la última meta lograda y la siguiente queda en curso.
function clasePaso(n, i, sinMeta) {
  const logrado = i >= 4 ? i : Math.max(0, i - 1)
  const enCurso = i >= 4 ? i + 1 : Math.max(1, i)
  if (n <= logrado) return 'hecho'
  if (n === enCurso) return sinMeta ? 'fallido' : 'actual'
  return ''
}

const ESTADO_PREMIO = {
  por_validar: { t: 'Por validar', c: 'amarillo' }, aprobado: { t: 'Aprobado', c: 'azul' },
  pagado: { t: 'Pagado', c: 'verde' }, rechazado: { t: 'No procede', c: 'rojo' },
}

export default function Panel({ session }) {
  const [perfil, setPerfil] = useState(undefined)      // undefined: cargando · null: sin cuenta de referidor
  const [referidos, setReferidos] = useState(null)
  const [premios, setPremios] = useState([])
  const [error, setError] = useState('')
  const [vista, setVista] = useState('inicio')

  const cargar = useCallback(async () => {
    const { data: p } = await supabase.from('ref_referidores').select('*').eq('id', session.user.id).maybeSingle()
    if (!p) {
      // Cuenta recién confirmada: se completa con los datos del registro.
      const datos = session.user.user_metadata?.referidor
      if (datos?.curp) {
        const { error: e } = await supabase.rpc('fn_ref_crear_referidor', { p_nombre: datos.nombre, p_curp: datos.curp, p_telefono: datos.telefono })
        if (!e) return cargar()
        setError(mensajeError(e))
      }
      setPerfil(null); return
    }
    setPerfil(p)
    const [r, pr] = await Promise.all([
      supabase.from('vw_ref_mis_referidos').select('*').order('creado_at', { ascending: false }),
      supabase.from('ref_premios').select('*'),
    ])
    setReferidos(r.data || []); setPremios(pr.data || [])
  }, [session])

  useEffect(() => { cargar() }, [cargar])
  const ir = (v) => { setVista(v); window.scrollTo(0, 0) }

  if (perfil === undefined) return <div className="cargando"><span className="spin" /></div>
  if (perfil === null) return (
    <div className="panel">
      <main className="panel-cuerpo"><CompletarCuenta error={error} onListo={cargar} /></main>
    </div>
  )

  const avisos = armarAvisos(perfil, referidos || [], premios)
  const TITULOS = { qr: 'Mi QR personal', referidos: 'Mis referidos', pagos: 'Mis pagos', cuenta: 'Mi cuenta' }

  return (
    <div className="app">
      <header className="app-cab">
        <div className="app-cab-in">
          <div className="app-cab-t">
            <span className="app-saludo">{vista === 'inicio' ? 'Hola,' : perfil.nombre}</span>
            <span className="app-nombre">{vista === 'inicio' ? perfil.nombre.toUpperCase() : TITULOS[vista]}</span>
          </div>
          <button className="app-campana" onClick={() => ir('inicio')} aria-label={`Avisos: ${avisos.length}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {avisos.length > 0 && <span className="app-badge">{avisos.length}</span>}
          </button>
        </div>
        {vista === 'inicio' && (
          <button className="app-banda" onClick={() => ir('qr')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4" />
            </svg>
            <span><b>Tu QR</b> está activo</span>
            <em>Compartir ›</em>
          </button>
        )}
      </header>

      <main className="app-cuerpo">
        {vista === 'inicio' && <Inicio perfil={perfil} referidos={referidos} premios={premios} avisos={avisos} ir={ir} />}
        {vista === 'qr' && <MiCodigo codigo={perfil.codigo} />}
        {vista === 'referidos' && <MisReferidos referidos={referidos} premios={premios} />}
        {vista === 'pagos' && <MisPremios premios={premios} nReferidos={(referidos || []).length} />}
        {vista === 'cuenta' && (
          <>
            <DatosPago perfil={perfil} onGuardado={cargar} />
            <button className="btn sec ancho" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
          </>
        )}
      </main>

      <nav className="app-tabs" aria-label="Secciones">
        {PESTANAS.map(t => (
          <button key={t.k} className={`app-tab${vista === t.k ? ' on' : ''}`} onClick={() => ir(t.k)} aria-current={vista === t.k ? 'page' : undefined}>
            <span className="app-tab-ico" dangerouslySetInnerHTML={{ __html: t.svg }} />
            {t.t}
          </button>
        ))}
      </nav>
    </div>
  )
}

const ICO = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const PESTANAS = [
  { k: 'inicio', t: 'Inicio', svg: ICO('<path d="M3 10a2 2 0 0 1 .7-1.53l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M10 21v-5a2 2 0 0 1 4 0v5"/>') },
  { k: 'qr', t: 'Mi QR', svg: ICO('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4"/>') },
  { k: 'referidos', t: 'Referidos', svg: ICO('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>') },
  { k: 'pagos', t: 'Pagos', svg: ICO('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>') },
  { k: 'cuenta', t: 'Cuenta', svg: ICO('<path d="M3 21h18"/><path d="M5 21V10M19 21V10M9 21V10M15 21V10"/><path d="M12 3 3 8h18Z"/>') },
]

// Grupos de etapas para los contadores del Inicio.
const EN_RUTA = ['primera_ruta', 'quince_rutas']
const NO_AVANZO = ['no_aprobado', 'sin_meta_30_dias']
// "Pedro R.": nombre y la inicial del apellido, como en la maqueta.
const corto = (r) => { const [n, a] = String(r.nombre || r.razon_social || '').trim().split(/\s+/); return a ? `${n} ${a[0]}.` : (n || '') }

// Avisos del Inicio: lo que pide una acción del referidor va primero.
function armarAvisos(perfil, referidos, premios) {
  const a = []
  const hayPremios = premios.some(p => p.estado !== 'rechazado')
  if (hayPremios && !perfil.clabe) a.push({ tipo: 'atencion', t: 'Registra tu cuenta para cobrar tus bonos', ir: 'cuenta' })
  for (const r of referidos) {
    if (r.etapa === 'firma_contrato') a.push({ tipo: 'avance', t: `${corto(r)}: firma de contrato`, ir: 'referidos' })
    else if (r.etapa === 'entrevista_alta') a.push({ tipo: 'avance', t: `${corto(r)}: entrevista y alta`, ir: 'referidos' })
    else if (r.etapa === 'primera_ruta') a.push({ tipo: 'avance', t: `${corto(r)}: ${r.rutas_30} de 15 rutas`, ir: 'referidos' })
  }
  return a.slice(0, 4)
}

// ── Inicio ──────────────────────────────────────────────────────────────────
function Inicio({ referidos, premios, avisos, ir }) {
  const validos = premios.filter(p => p.estado !== 'rechazado')
  const suma = (xs) => xs.reduce((t, p) => t + Number(p.monto || 0), 0)
  const pagado = suma(validos.filter(p => p.estado === 'pagado'))
  const porCobrar = suma(validos) - pagado
  const lista = referidos || []
  const enRuta = lista.filter(r => EN_RUTA.includes(r.etapa)).length
  const noAvanzo = lista.filter(r => NO_AVANZO.includes(r.etapa)).length
  const enProceso = lista.length - enRuta - noAvanzo
  const ultimoPago = validos.filter(p => p.pagado_at).sort((a, b) => b.pagado_at.localeCompare(a.pagado_at))[0]

  return (
    <>
      {avisos.length > 0 && (
        <>
          <span className="app-eyebrow">Avisos</span>
          <div className="avisos">
            {avisos.map((x, i) => (
              <button key={i} className="aviso-fila" onClick={() => ir(x.ir)}>
                <span className={`aviso-tag ${x.tipo}`}>{x.tipo === 'atencion' ? 'ATENCIÓN' : 'AVANCE'}</span>
                <span className="aviso-t">{x.t}</span>
                <span className="aviso-f" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      <span className="app-eyebrow">Mis bonos</span>
      <section className="tarjeta bonos">
        <div className="bonos-fecha"><b>Depositado</b>{ultimoPago ? ` · al ${fechaCorta(ultimoPago.pagado_at)}` : ' · todavía sin pagos'}</div>
        <div className="bonos-montos">
          <b className="bonos-grande">{pesos(pagado)}</b>
          <span className="bonos-cobrar"><b>{pesos(porCobrar)}</b> por cobrar</span>
        </div>
        <div className="cifras cuatro">
          <div><b>{lista.length}</b><span>Referidos</span></div>
          <div><b>{enRuta}</b><span>En ruta</span></div>
          <div><b>{enProceso}</b><span>En proceso</span></div>
          <div><b>{noAvanzo}</b><span>No avanzó</span></div>
        </div>
        <button className="link-fuerte" onClick={() => ir('referidos')}>Ver mis referidos ›</button>
      </section>

      <section className="cta">
        <b>¿Conoces a alguien que pueda facturar?</b>
        <button className="btn" onClick={() => ir('qr')}>Compartir mi QR</button>
      </section>
    </>
  )
}

// ── El código, el link y el QR ──────────────────────────────────────────────
function MiCodigo({ codigo }) {
  const link = `${window.location.origin}/r/${codigo}`
  const linkQr = `${link}?o=qr`                      // así se sabe si llegó por el QR
  const [qr, setQr] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(linkQr, { width: 720, margin: 2, color: { dark: '#002E5D', light: '#FFFFFF' } }).then(setQr)
  }, [linkQr])

  const mensaje = `Bigticket busca transportistas que facturen (empresa o persona física con actividad empresarial) para rutas de última milla. Regístrate con mi invitación: ${link}`
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sin portapapeles */ }
  }
  const compartir = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Invitación Bigticket', text: mensaje }) } catch { /* cancelado */ } return }
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  return (
    <section className="tarjeta codigo-t">
      <div className="codigo-izq">
        <span className="rotulo">Tu código</span>
        <div className="codigo-v">{codigo}</div>
        <div className="link-caja">
          <span className="link-t">{link.replace(/^https?:\/\//, '')}</span>
          <button className="mini" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
        </div>
        <div className="botones">
          <button className="btn" onClick={compartir}>Compartir invitación</button>
          {qr && <a className="btn sec" href={qr} download={`QR-${codigo}.png`}>Descargar QR</a>}
        </div>
      </div>
      <div className="qr">{qr ? <img src={qr} alt={`Código QR de la invitación ${codigo}`} /> : <span className="spin" />}</div>
    </section>
  )
}

// ── Premios ganados, por cobrar y pagados ───────────────────────────────────
function MisPremios({ premios, nReferidos }) {
  const validos = premios.filter(p => p.estado !== 'rechazado')
  const suma = (xs) => xs.reduce((t, p) => t + Number(p.monto || 0), 0)
  const ganado = suma(validos)
  const pagado = suma(validos.filter(p => p.estado === 'pagado'))
  const conPremio = new Set(validos.map(p => p.referido_id)).size
  return (
    <section className="tarjeta">
      <span className="rotulo">Tus premios</span>
      {/* La suma es de todos los referidos: se dice de cuántos, para que no se
          lea como lo que paga uno solo (el máximo por referido es $2,000). */}
      <p className="premios-de">
        Suma de <b>{conPremio} {conPremio === 1 ? 'referido' : 'referidos'}</b> con premio
        {nReferidos > conPremio && <> · {nReferidos} en total</>}
      </p>
      <div className="cifras">
        <div><b>{pesos(ganado)}</b><span>Ganado</span></div>
        <div><b className="naranja">{pesos(ganado - pagado)}</b><span>Por cobrar</span></div>
        <div><b className="verde">{pesos(pagado)}</b><span>Pagado</span></div>
      </div>
      <p className="nota">Por <b>cada referido</b> ganas hasta <b>$2,000</b>: <b>$500</b> cuando firma su contrato y hace su primera ruta, y <b>$1,500</b> cuando completa 15 rutas en sus primeros 30 días. Cada premio lo valida Bigticket antes de pagarlo.</p>
    </section>
  )
}

// ── Referidos y su avance ───────────────────────────────────────────────────
function MisReferidos({ referidos, premios }) {
  const porReferido = useMemo(() => {
    const m = {}
    for (const p of premios) (m[p.referido_id] = m[p.referido_id] || []).push(p)
    return m
  }, [premios])

  return (
    <section>
      <h2 className="seccion-t">Tus referidos {referidos && referidos.length > 0 && <span className="cuenta">{referidos.length}</span>}</h2>
      {referidos === null ? <div className="tarjeta vacia"><span className="spin" /></div>
        : referidos.length === 0 ? (
          <div className="tarjeta vacia">
            <b>Todavía no tienes referidos.</b>
            <span>Comparte tu código con personas o empresas que puedan facturar. Cuando se registren, aparecerán aquí con su avance.</span>
          </div>
        ) : referidos.map(r => <Referido key={r.referido_id} r={r} premios={porReferido[r.referido_id] || []} />)}
    </section>
  )
}

function Referido({ r, premios }) {
  const i = indice(r.etapa)
  const noAprobado = r.etapa === 'no_aprobado'
  const sinMeta = r.etapa === 'sin_meta_30_dias'
  const diasRestantes = r.primera_ruta
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(r.primera_ruta + 'T12:00:00').getTime()) / 86400000))
    : null
  const titulo = r.razon_social || r.nombre
  const actual = noAprobado ? 'No aprobado' : sinMeta ? 'No alcanzó las 15 rutas' : PASOS[i]?.t

  return (
    <article className="tarjeta ref">
      <header className="ref-cab">
        <div style={{ minWidth: 0 }}>
          <h3>{titulo}</h3>
          <span className="ref-sub">{r.tipo === 'persona_moral' ? 'Persona moral' : 'Persona física'} · RFC {r.rfc} · desde {fechaCorta(r.creado_at)}</span>
        </div>
        <span className={`estado ${noAprobado ? 'rojo' : i >= 5 ? 'verde' : 'azul'}`}>{actual}</span>
      </header>

      {!noAprobado && (
        <ol className="pasos" aria-label="Avance del referido">
          {PASOS.map((p, n) => (
            <li key={p.k} className={clasePaso(n, i, sinMeta)} aria-current={clasePaso(n, i, sinMeta) === 'actual' ? 'step' : undefined}>
              <span className="punto" />
              <span className="paso-t">{p.t}{p.premio ? <em> · {pesos(p.premio)}</em> : null}</span>
            </li>
          ))}
        </ol>
      )}

      <dl className="ref-datos">
        {r.firmado_at && <div><dt>Contrato firmado</dt><dd>{fechaCorta(r.firmado_at)}</dd></div>}
        {r.primera_ruta && <div><dt>Primera ruta</dt><dd>{fechaCorta(r.primera_ruta)}</dd></div>}
        {r.primera_ruta && (
          <div className="ancho">
            <dt>Rutas en sus primeros 30 días</dt>
            <dd>
              <div className="barra"><span style={{ width: `${Math.min(100, (r.rutas_30 / 15) * 100)}%` }} /></div>
              <span className="barra-t"><b>{r.rutas_30} de 15</b>{!sinMeta && r.rutas_30 < 15 && diasRestantes !== null && ` · quedan ${diasRestantes} días`}</span>
            </dd>
          </div>
        )}
      </dl>

      <div className="ref-total">
        <span>Ganado con este referido</span>
        <b>{pesos(premios.filter(p => p.estado !== 'rechazado').reduce((t, p) => t + Number(p.monto || 0), 0))} <small>de $2,000</small></b>
      </div>

      {premios.length > 0 && (
        <div className="premios-ref">
          {premios.sort((a, b) => a.monto - b.monto).map(p => {
            const e = ESTADO_PREMIO[p.estado] || ESTADO_PREMIO.por_validar
            return <span key={p.id} className={`chip ${e.c}`}>{pesos(p.monto)} · {e.t}</span>
          })}
        </div>
      )}
    </article>
  )
}

// ── CLABE para recibir los premios ──────────────────────────────────────────
function DatosPago({ perfil, onGuardado }) {
  const [clabe, setClabe] = useState(perfil.clabe || '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const guardar = async (e) => {
    e.preventDefault(); setMsg('')
    if (soloDigitos(clabe).length !== 18) { setMsg('La CLABE tiene 18 dígitos.'); return }
    setBusy(true)
    const { error } = await supabase.rpc('fn_ref_guardar_clabe', { p_clabe: soloDigitos(clabe) })
    setBusy(false)
    if (error) { setMsg(mensajeError(error)); return }
    setMsg('ok'); onGuardado()
  }
  return (
    <section className="tarjeta">
      <span className="rotulo">Dónde recibes tus premios</span>
      <form onSubmit={guardar} className="clabe-form">
        <Campo label="CLABE interbancaria" ayuda="18 dígitos, a tu nombre.">
          <input inputMode="numeric" className="mono" value={clabe} onChange={e => setClabe(soloDigitos(e.target.value).slice(0, 18))} />
        </Campo>
        <button className="btn sec" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </form>
      {msg && <div className={`aviso ${msg === 'ok' ? 'ok' : 'error'}`}>{msg === 'ok' ? 'CLABE guardada.' : msg}</div>}
    </section>
  )
}

// ── Cuenta sin datos de referidor (por ejemplo, un usuario del portal de
// terceros que entra por primera vez): se completan aquí. ────────────────────
function CompletarCuenta({ error, onListo }) {
  const [d, setD] = useState({ nombre: '', curp: '', telefono: '' })
  const [err, setErr] = useState(error || '')
  const [busy, setBusy] = useState(false)
  const S = (k, v) => setD(x => ({ ...x, [k]: v }))
  const crear = async (e) => {
    e.preventDefault(); setErr('')
    if (d.nombre.trim().split(/\s+/).length < 2) { setErr('Escribe tu nombre y al menos un apellido.'); return }
    if (!CURP_RE.test(d.curp)) { setErr('Revisa tu CURP: son 18 caracteres.'); return }
    if (soloDigitos(d.telefono).length !== 10) { setErr('El teléfono son 10 dígitos.'); return }
    setBusy(true)
    const { error: e2 } = await supabase.rpc('fn_ref_crear_referidor', { p_nombre: d.nombre.trim(), p_curp: d.curp, p_telefono: soloDigitos(d.telefono) })
    setBusy(false)
    if (e2) { setErr(mensajeError(e2)); return }
    onListo()
  }
  return (
    <section className="tarjeta" style={{ maxWidth: 480, margin: '24px auto' }}>
      <h1 className="form-t">Completa tu registro</h1>
      <p className="form-p">Necesitamos estos datos para crear tu código de referidor.</p>
      <form onSubmit={crear} className="form">
        {err && <div className="aviso error">{err}</div>}
        <Campo label="Nombre completo"><input value={d.nombre} onChange={e => S('nombre', e.target.value)} /></Campo>
        <Campo label="CURP"><input className="mono" value={d.curp} onChange={e => S('curp', e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 18))} /></Campo>
        <Campo label="Teléfono celular"><input type="tel" inputMode="numeric" value={d.telefono} onChange={e => S('telefono', soloDigitos(e.target.value).slice(0, 10))} /></Campo>
        <button className="btn" disabled={busy}>{busy ? 'Creando…' : 'Crear mi código'}</button>
        <button type="button" className="link" onClick={() => supabase.auth.signOut()}>Salir</button>
      </form>
    </section>
  )
}
