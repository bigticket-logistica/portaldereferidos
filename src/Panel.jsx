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

  const salir = () => supabase.auth.signOut()

  if (perfil === undefined) return <div className="cargando"><span className="spin" /></div>

  return (
    <div className="panel">
      <header className="panel-cab">
        <div className="panel-cab-in">
          <Logo alto={26} />
          <button className="salir" onClick={salir}>Salir</button>
        </div>
      </header>
      <main className="panel-cuerpo">
        {perfil === null ? (
          <CompletarCuenta error={error} onListo={cargar} />
        ) : (
          <>
            <h1 className="hola">Hola, {perfil.nombre.split(' ')[0]}</h1>
            <MiCodigo codigo={perfil.codigo} />
            <MisPremios premios={premios} nReferidos={(referidos || []).length} />
            <MisReferidos referidos={referidos} premios={premios} />
            <DatosPago perfil={perfil} onGuardado={cargar} />
          </>
        )}
      </main>
    </div>
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
