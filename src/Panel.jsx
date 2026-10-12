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
  const [detalle, setDetalle] = useState(null)        // id del referido abierto

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
  const ir = (v) => { setVista(v); setDetalle(null); window.scrollTo(0, 0) }
  const abrir = (id) => { setVista('referidos'); setDetalle(id); window.scrollTo(0, 0) }

  if (perfil === undefined) return <div className="cargando"><span className="spin" /></div>
  if (perfil === null) return (
    <div className="panel">
      <main className="panel-cuerpo"><CompletarCuenta error={error} onListo={cargar} /></main>
    </div>
  )

  const avisos = armarAvisos(perfil, referidos || [], premios)
  const abierto = detalle ? (referidos || []).find(r => r.referido_id === detalle) : null
  const TITULOS = { qr: 'Mi QR personal', referidos: 'Mis referidos', pagos: 'Mis pagos', cuenta: 'Mi cuenta' }

  return (
    <div className="app">
      <header className="app-cab">
        <div className="app-cab-in">
          {abierto && (
            <button className="app-volver" onClick={() => { setDetalle(null); window.scrollTo(0, 0) }} aria-label="Volver a mis referidos">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          )}
          {abierto ? (
            <div className="app-cab-t">
              <span className="app-saludo">Tu referido</span>
              <span className="app-nombre">{corto(abierto)}</span>
            </div>
          ) : (
          <div className="app-cab-t">
            <span className="app-saludo">{vista === 'inicio' ? 'Hola,' : perfil.nombre}</span>
            <span className="app-nombre">{vista === 'inicio' ? perfil.nombre.toUpperCase() : TITULOS[vista]}</span>
          </div>
          )}
          {abierto && <span className={`pill blanco`}>{etapaDe(abierto).pill}</span>}
          {!abierto && <button className="app-campana" onClick={() => ir('inicio')} aria-label={`Avisos: ${avisos.length}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {avisos.length > 0 && <span className="app-badge">{avisos.length}</span>}
          </button>}
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
        {vista === 'qr' && <MiCodigo codigo={perfil.codigo} nombre={perfil.nombre} />}
        {vista === 'referidos' && !abierto && <MisReferidos referidos={referidos} onAbrir={abrir} />}
        {vista === 'referidos' && abierto && <Detalle r={abierto} premios={premios.filter(p => p.referido_id === abierto.referido_id)} />}
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

// ── Mi QR personal ─────────────────────────────────────────────────────────
function MiCodigo({ codigo, nombre }) {
  const link = `${window.location.origin}/r/${codigo}`
  const linkQr = `${link}?o=qr`                      // así se sabe si llegó por el QR
  const [qr, setQr] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(linkQr, { width: 720, margin: 1, color: { dark: '#002E5D', light: '#FFFFFF' } }).then(setQr)
  }, [linkQr])

  const mensaje = `Hola. Bigticket busca transportistas que facturen para rutas de última milla con Mercado Libre: pagos semanales por ruta. Postúlate con mi invitación: ${link}`
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank')
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sin portapapeles */ }
  }

  return (
    <>
      <section className="tarjeta qr-tarjeta">
        <div className="qr-marco">{qr ? <img src={qr} alt={`Código QR de la invitación ${codigo}`} /> : <span className="spin" />}</div>
        <b className="qr-nombre">{nombre}</b>
        <span className="qr-codigo">Código {codigo} · único para ti</span>
      </section>
      <button className="btn ancho con-ico" onClick={whatsapp}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
        Compartir por WhatsApp
      </button>
      <div className="dos-botones">
        {qr && (
          <a className="btn sec con-ico" href={qr} download={`QR-${codigo}.png`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            Descargar
          </a>
        )}
        <button className="btn sec con-ico" onClick={copiar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          {copiado ? 'Copiado' : 'Copiar link'}
        </button>
      </div>
      <div className="nota-caja">
        <span className="nota-i">i</span>
        <span>Quien se postule con este QR o este link queda registrado a tu nombre. La invitación ya va escrita: solo eliges a quién mandarla.</span>
      </div>
    </>
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

// ── Etapas tal como las ve el referidor ─────────────────────────────────────
// pill: la etiqueta corta · tono: color · texto: qué está pasando y qué puede
// hacer quien lo refirió.
function etapaDe(r) {
  const T = {
    registrado: { pill: 'REGISTRADO', tono: 'gris', texto: 'Recibimos su postulación. Un supervisor lo contactará en menos de 24 horas.' },
    en_revision: { pill: 'EN REVISIÓN', tono: 'naranja', texto: 'Estamos revisando sus documentos y validándolo con Mercado Libre.' },
    entrevista_alta: { pill: 'ENTREVISTA', tono: 'azul', texto: 'Tiene entrevista con Operaciones. Recuérdale llevar su INE, su licencia y la tarjeta de circulación.' },
    firma_contrato: { pill: 'FIRMA', tono: 'azul', texto: 'Le enviamos su contrato. Recuérdale firmarlo para que pueda empezar a rutear.' },
    contrato_firmado: { pill: 'CONTRATO FIRMADO', tono: 'azul', texto: 'Ya firmó. Con su primera ruta ganas tus primeros $500.' },
    primera_ruta: { pill: 'EN RUTA', tono: 'navy', texto: null },
    quince_rutas: { pill: 'META CUMPLIDA', tono: 'verde', texto: 'Cumplió 15 rutas en sus primeros 30 días. Ganaste los $2,000 completos.' },
    sin_meta_30_dias: { pill: 'SIN META', tono: 'gris', texto: 'No llegó a 15 rutas en sus primeros 30 días. Los $500 de su primera ruta siguen siendo tuyos.' },
    no_aprobado: { pill: 'NO AVANZÓ', tono: 'gris', texto: 'No pasó la validación. Puedes referir a otra persona con tu mismo QR.' },
  }
  return T[r.etapa] || T.registrado
}
const diasActivo = (r) => r.primera_ruta
  ? Math.min(30, Math.max(1, Math.floor((Date.now() - new Date(r.primera_ruta + 'T12:00:00').getTime()) / 86400000) + 1))
  : 0

// ── Mis referidos ───────────────────────────────────────────────────────────
function MisReferidos({ referidos, onAbrir }) {
  if (referidos === null) return <div className="tarjeta vacia"><span className="spin" /></div>
  if (referidos.length === 0) return (
    <div className="tarjeta vacia">
      <b>Todavía no tienes referidos.</b>
      <span>Comparte tu QR con personas o empresas que puedan facturar. Cuando se postulen, aparecerán aquí con su avance.</span>
    </div>
  )
  return (
    <>
      <span className="app-eyebrow">{referidos.length} {referidos.length === 1 ? 'persona' : 'personas'} con tu QR</span>
      {referidos.map(r => {
        const e = etapaDe(r)
        const dias = diasActivo(r)
        return (
          <button key={r.referido_id} className="tarjeta ref-fila" onClick={() => onAbrir(r.referido_id)}>
            <span className="ref-fila-cab">
              <b>{corto(r)}</b>
              <span className={`pill ${e.tono}`}>{e.pill}</span>
            </span>
            {r.etapa === 'primera_ruta' ? (
              <>
                <span className="barra"><span style={{ width: `${Math.min(100, (r.rutas_30 / 15) * 100)}%` }} /></span>
                <span className="ref-fila-pie"><span>Día {dias} de 30 · {r.rutas_30} de 15 rutas</span><em>Ver detalle ›</em></span>
              </>
            ) : (
              <>
                <span className="ref-fila-t">{e.texto}</span>
                <span className="ref-fila-pie"><span>Desde el {fechaCorta(r.creado_at)}</span><em>Ver detalle ›</em></span>
              </>
            )}
          </button>
        )
      })}
    </>
  )
}

// ── Detalle de un referido: su avance a los 30 días y el paso a paso ────────
function Detalle({ r, premios }) {
  const dias = diasActivo(r)
  const premio = (tramo) => premios.find(p => p.tramo === tramo)
  const ESTADO = { por_validar: 'por validar', aprobado: 'aprobado', pagado: 'pagado', rechazado: 'no procede' }
  const etapas = ['registrado', 'en_revision', 'entrevista_alta', 'firma_contrato', 'contrato_firmado', 'primera_ruta', 'quince_rutas']
  const i = r.etapa === 'sin_meta_30_dias' ? 5 : r.etapa === 'no_aprobado' ? -1 : etapas.indexOf(r.etapa)
  const cumple = r.primera_ruta ? new Date(new Date(r.primera_ruta + 'T12:00:00').getTime() + 29 * 86400000) : null
  const p1 = premio('firma_y_primera_ruta'), p2 = premio('quince_rutas_30_dias')

  // Cada paso: hecho, en curso o pendiente, con su fecha o su explicación.
  const pasos = [
    { t: 'Registro', d: `${fechaCorta(r.creado_at)} · con tu QR`, ok: true },
    { t: 'Revisión de documentos', d: i > 1 ? 'Documentos validados' : 'Revisamos sus documentos con Mercado Libre', ok: i > 1, cur: i === 1 },
    { t: 'Entrevista y alta', d: i > 2 ? 'Entrevista aprobada' : 'Con un supervisor de Operaciones', ok: i > 2, cur: i === 2 },
    { t: 'Contrato firmado', d: r.firmado_at ? fechaCorta(r.firmado_at) : 'Le enviaremos su contrato para firmar', ok: !!r.firmado_at, cur: i === 3 },
    { t: 'Primera ruta', d: r.primera_ruta ? `${fechaCorta(r.primera_ruta)} · $500${p1 ? ` ${ESTADO[p1.estado]}` : ''}` : 'Con su primera ruta ganas $500', ok: !!r.primera_ruta, cur: i === 4 },
    { t: '30 días activo', d: r.etapa === 'primera_ruta' ? `Va en el día ${dias}. Se cumple el ${fechaCorta(cumple)}.` : r.etapa === 'quince_rutas' ? 'Completado' : r.etapa === 'sin_meta_30_dias' ? 'No llegó a 15 rutas' : 'Se cuentan desde su primera ruta', ok: r.etapa === 'quince_rutas', cur: r.etapa === 'primera_ruta', mal: r.etapa === 'sin_meta_30_dias' },
    { t: 'Meta cumplida', d: p2 ? `$1,500 ${ESTADO[p2.estado]}` : '$1,500 al llegar a 15 rutas en 30 días', ok: r.etapa === 'quince_rutas' },
  ]

  return (
    <>
      {r.primera_ruta && (
        <>
          <span className="app-eyebrow">Avance a los 30 días</span>
          <section className="tarjeta avance">
            <div className="avance-fila"><span>Días activo</span><b>{dias} de 30</b></div>
            <span className="barra"><span style={{ width: `${(dias / 30) * 100}%` }} /></span>
            <div className="avance-fila"><span>Rutas ejecutadas</span><b>{r.rutas_30} de 15</b></div>
            <span className="barra"><span style={{ width: `${Math.min(100, (r.rutas_30 / 15) * 100)}%` }} /></span>
          </section>
        </>
      )}
      {r.etapa === 'no_aprobado' && <div className="nota-caja"><span className="nota-i">i</span><span>{etapaDe(r).texto}</span></div>}
      <span className="app-eyebrow">Paso a paso</span>
      <ol className="tarjeta linea">
        {pasos.map((p, n) => (
          <li key={n} className={p.ok ? 'hecho' : p.mal ? 'mal' : p.cur ? 'actual' : ''}>
            <span className="linea-punto">{p.ok ? '✓' : ''}</span>
            <span className="linea-t"><b>{p.t}</b><span>{p.d}</span></span>
          </li>
        ))}
      </ol>
      <span className="ref-rfc">{r.razon_social || r.nombre} · RFC {r.rfc}</span>
    </>
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
