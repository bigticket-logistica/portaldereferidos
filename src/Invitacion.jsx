// ═══════════════════════════════════════════════════════════════════════════
// Invitación pública (/r/BT-XXXXX): la postulación completa del referido.
//
//   1. ¿Puede facturar? Si no, se le agradece y no se registra nada.
//   2. Elige el centro y sus vehículos, entre lo que busca Bigticket.
//   3. Ve la propuesta económica de ese centro (ref_propuestas, que el analista
//      crea y edita en el Brain → Referidos → Oportunidades) y la acepta. Sin
//      aceptarla no puede seguir. Un centro sin propuesta no aparece.
//   4. Sus datos y sus documentos.
//   5. Al enviar, fn_ref_registrar_referido crea su tarjeta en el Kanban de
//      Certificaciones, ya en la Etapa 3 (Pre validación Biggy) y marcada como
//      referido, y la ata a quien lo invitó.
//
// Los documentos se suben a documentos-terceros/referidos/<carpeta>/, el mismo
// bucket público que usan las demás tarjetas, para que Biggy y el Brain los lean.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import { supabase, mensajeError } from './supabase'
import { Campo, Logo, CURP_RE, RFC_RE, soloDigitos, TelefonoMX } from './comun'
import { TipoBuscado } from './Panel'
import PropuestaVista from './Propuesta'

const BUCKET = 'documentos-terceros'
const DOCS = [
  { k: 'curp', t: 'CURP', req: true },
  { k: 'ine', t: 'INE por delante', req: true },
  { k: 'ine_2', t: 'INE por detrás', req: true },
  { k: 'rfc', t: 'Constancia de situación fiscal (RFC)', req: true },
  { k: 'licencia', t: 'Licencia de conducir', req: true },
]
const MAX_MB = 10

// Las fotos del teléfono pesan varios MB: se achican a 1600 px antes de subir.
async function prepararArchivo(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bmp = await createImageBitmap(file)
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85))
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file
  } catch { return file }
}

export default function Invitacion({ codigo, canal = false }) {
  const origen = new URLSearchParams(window.location.search).get('o') === 'qr' ? 'qr' : 'link'
  const carpeta = useMemo(() => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), [])
  const [quien, setQuien] = useState(undefined)        // nombre corto de quien invita
  const [scs, setScs] = useState([])
  const [oportTodas, setOportTodas] = useState(null)    // lo que define el analista en el Brain
  const [propuestas, setPropuestas] = useState(null)    // una propuesta económica por centro
  // factura → centro → propuesta → datos ('no' si no puede facturar)
  const [paso, setPaso] = useState('factura')
  const [aceptoProp, setAceptoProp] = useState(false)
  const [d, setD] = useState({ nombre: '', empresa: '', curp: '', rfc: '', ine: '', sc: '', correo: '', telefono: '', acepto: false })
  const [vehiculos, setVehiculos] = useState(['Small Van'])
  const [docs, setDocs] = useState({})                 // k → { url, nombre } | { subiendo: true } | { error }
  const [err, setErr] = useState({})
  const [general, setGeneral] = useState('')
  const [busy, setBusy] = useState(false)
  const [listo, setListo] = useState(false)
  const S = (k, v) => setD(x => ({ ...x, [k]: v }))

  useEffect(() => {
    // Por un canal (la camioneta) no hay persona que invite: el encabezado
    // queda "Opera con Bigticket" y solo se revisa que el canal exista.
    if (canal) supabase.rpc('fn_ref_canal', { p_codigo: codigo }).then(({ data }) => setQuien(data ? '' : null))
    else supabase.rpc('fn_ref_invitacion', { p_codigo: codigo }).then(({ data }) => setQuien(data || null))
    // Cada centro llega con su nombre: en la lista se ve "Playa del Carmen (SPY1)".
    supabase.rpc('fn_ref_scs').then(({ data }) => setScs((data || []).map(r => (typeof r === 'string' ? { sc: r, nombre: r } : r))))
    // Dónde se buscan transportistas hoy (lo administra Bigticket desde el Brain).
    supabase.from('vw_ref_oportunidades').select('*').then(({ data }) => setOportTodas(data || []))
    supabase.from('ref_propuestas').select('*').then(({ data }) => setPropuestas(data || []))
  }, [codigo])

  // Centros y tipos de vehículo que define el analista en el Brain (Referidos →
  // Oportunidades). Si no hay ninguna campaña activa, no se recibe postulación:
  // se muestra un aviso, y la página se abre sola en cuanto se crea una.
  // Solo se ofrecen los centros que ya tienen su propuesta económica.
  // Los tipos de vehículo de un centro son los de sus oportunidades más los que
  // estén en la tabla de tarifas de su propuesta (con la tarifa de 0-100 km).
  const numero = (v) => Number(String(v ?? '').replace(/\D/g, '')) || null
  const oport = oportTodas && propuestas ? oportTodas.filter(o => propuestas.some(p => p.sc === o.sc)).concat(
    propuestas.flatMap(p => {
      const delCentro = oportTodas.filter(o => o.sc === p.sc)
      if (!delCentro.length) return []
      return (p.tarifas || [])
        .filter(t => (t.categoria || '').trim() && !delCentro.some(o => o.tipo_vehiculo.toLowerCase() === t.categoria.trim().toLowerCase()))
        .map(t => ({ sc: p.sc, nombre: delCentro[0].nombre, tipo_vehiculo: t.categoria.trim(), cantidad: null, tarifa: numero(t.tramos?.['0-100']), nota: null }))
    })) : null
  const propActual = (propuestas || []).find(p => p.sc === d.sc)
  const hayOport = (oport || []).length > 0
  const centrosOpciones = hayOport
    ? Object.values((oport || []).reduce((m, o) => { m[o.sc] = m[o.sc] || { sc: o.sc, nombre: o.nombre }; return m }, {}))
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
    : scs
  const buscadosEn = (sc) => (oport || []).filter(o => o.sc === sc)
  const tiposPara = (sc) => {
    const t = hayOport ? [...new Set((sc ? buscadosEn(sc) : oport).map(o => o.tipo_vehiculo))] : []
    return t.length ? t : ['Small Van', 'Large Van']
  }
  const tipos = tiposPara(d.sc)

  // Al cambiar de centro, cada vehículo queda con un tipo que ese centro busca.
  useEffect(() => {
    setVehiculos(v => v.map(t => (tipos.includes(t) ? t : tipos[0])))
  }, [d.sc, oportTodas, propuestas])  // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarCantidad = (n) => {
    const total = Math.max(1, Math.min(10, n))
    setVehiculos(v => total > v.length ? [...v, ...Array(total - v.length).fill(tipos[0])] : v.slice(0, total))
  }

  const subir = async (k, file) => {
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) { setDocs(x => ({ ...x, [k]: { error: `Pesa más de ${MAX_MB} MB.` } })); return }
    if (!/^image\/|application\/pdf/.test(file.type)) { setDocs(x => ({ ...x, [k]: { error: 'Sube una foto o un PDF.' } })); return }
    setDocs(x => ({ ...x, [k]: { subiendo: true } }))
    const f = await prepararArchivo(file)
    const ext = f.type === 'application/pdf' ? 'pdf' : (f.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const ruta = `referidos/${carpeta}/${k}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(ruta, f, { contentType: f.type, upsert: false })
    if (error) { setDocs(x => ({ ...x, [k]: { error: 'No se pudo subir. Vuelve a intentarlo.' } })); return }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
    setDocs(x => ({ ...x, [k]: { url: data.publicUrl, nombre: file.name, foto: f.type.startsWith('image/') } }))
  }

  const validar = () => {
    const e = {}
    const rfcLen = d.rfc.length
    if (d.nombre.trim().split(/\s+/).length < 2) e.nombre = 'Escribe nombre y al menos un apellido.'
    if (d.empresa.trim().length < 3) e.empresa = 'Escribe la razón social o el nombre con el que facturas.'
    if (!CURP_RE.test(d.curp)) e.curp = 'Son 18 caracteres.'
    if (!RFC_RE.test(d.rfc) || (rfcLen !== 12 && rfcLen !== 13)) e.rfc = '12 caracteres si es empresa, 13 si es persona física.'
    if (!/^[A-Z0-9]{10,18}$/.test(d.ine)) e.ine = 'El número que aparece al reverso de tu INE.'
    if (!/^\S+@\S+\.\S+$/.test(d.correo.trim())) e.correo = 'Revisa el correo.'
    if (soloDigitos(d.telefono).length !== 10) e.telefono = 'Son 10 dígitos, sin el 52.'
    for (const doc of DOCS) if (doc.req && !docs[doc.k]?.url) e[`doc_${doc.k}`] = 'Falta este documento.'
    if (!d.acepto) e.acepto = 'Para continuar acepta el uso de tus datos.'
    setErr(e)
    if (Object.keys(e).length) setGeneral('Revisa los campos marcados en rojo.')
    return Object.keys(e).length === 0
  }

  // Lo que se le paga en el centro elegido, solo por los tipos que eligió.
  const propuesta = buscadosEn(d.sc).filter(o => vehiculos.includes(o.tipo_vehiculo))
  const nombreCentro = (centrosOpciones.find(c => c.sc === d.sc) || {}).nombre || d.sc
  const resumenVeh = Object.entries(vehiculos.reduce((m, t) => ({ ...m, [t]: (m[t] || 0) + 1 }), {})).map(([t, n]) => `${n} ${t}`).join(' y ')

  const irPropuesta = () => {
    if (!d.sc) { setErr({ sc: 'Elige dónde te gustaría operar.' }); return }
    setErr({}); setAceptoProp(false); setPaso('propuesta'); window.scrollTo(0, 0)
  }
  const aceptarPropuesta = () => { setPaso('datos'); window.scrollTo(0, 0) }
  const cambiarCentro = () => { setAceptoProp(false); setPaso('centro'); window.scrollTo(0, 0) }

  const enviar = async (ev) => {
    ev.preventDefault(); setGeneral('')
    if (!validar()) return
    if (Object.values(docs).some(x => x.subiendo)) { setGeneral('Espera a que terminen de subir los documentos.'); return }
    setBusy(true)
    const conteo = vehiculos.reduce((m, t) => ({ ...m, [t]: (m[t] || 0) + 1 }), {})
    const { error } = await supabase.rpc('fn_ref_registrar_referido', {
      p_codigo: codigo,
      p_datos: {
        nombre: d.nombre.trim(), empresa: d.empresa.trim(), curp: d.curp, rfc: d.rfc, ine: d.ine,
        sc: d.sc, correo: d.correo.trim().toLowerCase(), telefono: soloDigitos(d.telefono), origen,
        cantidad_vehiculos: vehiculos.length,
        tipo_vehiculo: Object.entries(conteo).map(([t, n]) => `${n} ${t}`).join(', '),
        vehiculos,
        url_curp: docs.curp?.url, url_ine: docs.ine?.url, url_ine_2: docs.ine_2?.url,
        url_rfc: docs.rfc?.url, url_licencia: docs.licencia?.url,
        // La propuesta que vio y aceptó (la función guarda su copia desde ref_oportunidades).
        propuesta_aceptada: true,
        propuesta: propuesta.map(o => ({ tipo_vehiculo: o.tipo_vehiculo, tarifa: o.tarifa, nota: o.nota || null })),
      },
    })
    setBusy(false)
    if (error) { setGeneral(mensajeError(error)); return }
    setListo(true)
    window.scrollTo(0, 0)
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

      <main className="acceso-hoja ancha">
        {quien === null ? (
          <div className="form"><div className="aviso error">Este link de invitación no es válido. Pídele a quien te lo compartió que te lo envíe de nuevo.</div></div>
        ) : oport !== null && oport.length === 0 && !listo ? (
          <div className="form">
            <h2 className="form-t">Por ahora no hay campañas activas</h2>
            <div className="nota-caja">
              <span className="nota-i">i</span>
              <span>Por ahora no tenemos campañas de referidos activas en ningún SC. Vuelve a abrir esta invitación más adelante: apenas se abra una, podrás postular desde aquí.</span>
            </div>
          </div>
        ) : listo ? (
          <div className="form">
            <h2 className="form-t">¡Listo, recibimos tu postulación!</h2>
            <p className="form-p">Nuestro equipo revisará tus documentos y un supervisor de Bigticket te contactará por WhatsApp al {soloDigitos(d.telefono)} con los siguientes pasos.</p>
          </div>
        ) : paso === 'no' ? (
          <div className="form">
            <h2 className="form-t">Gracias por tu interés</h2>
            <p className="form-p">Por ahora trabajamos solo con transportistas que pueden emitir factura: empresas (persona moral) o personas físicas con actividad empresarial. Cuando te des de alta en el SAT para facturar, vuelve a abrir esta invitación.</p>
            <button className="btn sec" onClick={() => setPaso('factura')}>Volver</button>
          </div>
        ) : paso === 'factura' ? (
          <div className="form">
            <h2 className="form-t">¿Puedes emitir factura?</h2>
            <p className="form-p">Para operar con Bigticket necesitas facturar tus servicios, como empresa (persona moral) o como persona física con actividad empresarial.</p>
            <div className="opciones">
              <button className="btn" onClick={() => setPaso('centro')}>Sí, puedo facturar</button>
              <button className="btn sec" onClick={() => setPaso('no')}>No, todavía no</button>
            </div>
          </div>
        ) : paso === 'centro' ? (
          <div className="form">
            <h2 className="form-t">¿Dónde te gustaría operar?</h2>
            <p className="form-p">Elige el centro y los vehículos con los que operarías. En el siguiente paso verás cuánto se paga.</p>
            <fieldset className="bloque">
              <legend>Tu operación</legend>
              <Campo label="¿En qué centro te gustaría operar?" error={err.sc}>
                <select value={d.sc} onChange={e => S('sc', e.target.value)}>
                  <option value="">Elige un centro</option>
                  {centrosOpciones.map(c => (
                    <option key={c.sc} value={c.sc}>{c.nombre && c.nombre !== c.sc ? `${c.nombre} (${c.sc})` : c.sc}</option>
                  ))}
                </select>
              </Campo>
              {d.sc && buscadosEn(d.sc).length > 0 && (
                <div className="buscados">
                  <span>En este centro se buscan:</span>
                  <div className="oport-tipos izq">{buscadosEn(d.sc).map(o => <TipoBuscado key={o.tipo_vehiculo} t={o} />)}</div>
                </div>
              )}
              <Campo label="¿Cuántos vehículos tienes para operar?">
                <div className="contador">
                  <button type="button" onClick={() => cambiarCantidad(vehiculos.length - 1)} aria-label="Uno menos">−</button>
                  <b>{vehiculos.length}</b>
                  <button type="button" onClick={() => cambiarCantidad(vehiculos.length + 1)} aria-label="Uno más">+</button>
                </div>
              </Campo>
              <div className="vehiculos">
                {vehiculos.map((t, i) => (
                  <div key={i} className="vehiculo">
                    <span>Vehículo {i + 1}</span>
                    <div className="tipos-v">
                      {tipos.map(op => (
                        <button type="button" key={op} className={t === op ? 'on' : ''} aria-pressed={t === op}
                          onClick={() => setVehiculos(v => v.map((x, j) => (j === i ? op : x)))}>{op}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
            <button className="btn" onClick={irPropuesta}>Ver la propuesta económica</button>
          </div>
        ) : paso === 'propuesta' ? (
          <div className="form">
            <h2 className="form-t">Propuesta económica</h2>
            <p className="form-p">Estas son las condiciones para operar en {nombreCentro} con {resumenVeh}. Léelas antes de dejar tus datos.</p>
            {propActual && <PropuestaVista p={propActual} />}
            <label className="check">
              <input type="checkbox" checked={aceptoProp} onChange={e => setAceptoProp(e.target.checked)} />
              <span>Leí la propuesta económica y estoy de acuerdo con estas condiciones.</span>
            </label>
            <div className="opciones">
              <button className="btn" disabled={!aceptoProp} onClick={aceptarPropuesta}>Aceptar y continuar</button>
              <button className="btn sec" onClick={cambiarCentro}>Cambiar centro o vehículos</button>
            </div>
          </div>
        ) : (
          <form onSubmit={enviar} className="form" noValidate>
            <h2 className="form-t">Tu postulación</h2>

            <div className="nota-caja">
              <span className="nota-i">i</span>
              <span>Operarías en <b>{nombreCentro}</b> con {resumenVeh}, y aceptaste la propuesta económica de este centro. <a href="#" onClick={e => { e.preventDefault(); cambiarCentro() }}>Cambiar</a></span>
            </div>

            <fieldset className="bloque">
              <legend>Tus datos</legend>
              <Campo label="Nombre completo" error={err.nombre}><input value={d.nombre} onChange={e => S('nombre', e.target.value)} autoComplete="name" /></Campo>
              <Campo label="Nombre de la empresa" error={err.empresa} ayuda="Razón social, o tu nombre si facturas como persona física.">
                <input value={d.empresa} onChange={e => S('empresa', e.target.value)} autoComplete="organization" />
              </Campo>
              <div className="dos">
                <Campo label="CURP" error={err.curp}><input className="mono" value={d.curp} onChange={e => S('curp', e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 18))} /></Campo>
                <Campo label="RFC con homoclave" error={err.rfc}><input className="mono" value={d.rfc} onChange={e => S('rfc', e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 13))} /></Campo>
              </div>
              <Campo label="Número de INE" error={err.ine} ayuda="El número que aparece al reverso de tu credencial.">
                <input className="mono" value={d.ine} onChange={e => S('ine', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18))} />
              </Campo>
              <div className="dos">
                <Campo label="Correo" error={err.correo}><input type="email" value={d.correo} onChange={e => S('correo', e.target.value)} autoComplete="email" /></Campo>
                <Campo label="Teléfono celular" error={err.telefono} ayuda="10 dígitos, para WhatsApp.">
                  <TelefonoMX value={d.telefono} onChange={v => S('telefono', v)} />
                </Campo>
              </div>
            </fieldset>

            <fieldset className="bloque">
              <legend>Tus documentos</legend>
              <p className="form-p">Foto clara o PDF, de hasta {MAX_MB} MB. Desde el teléfono puedes tomar la foto en el momento.</p>
              <div className="docs">
                {DOCS.map(doc => {
                  const x = docs[doc.k] || {}
                  return (
                    <label key={doc.k} className={`doc${x.url ? ' ok' : ''}${err[`doc_${doc.k}`] || x.error ? ' con-error' : ''}`}>
                      <input type="file" accept="image/*,application/pdf" hidden onChange={e => { subir(doc.k, e.target.files?.[0]); e.target.value = '' }} />
                      <span className="doc-vista">
                        {x.subiendo ? <span className="spin" /> : x.url && x.foto ? <img src={x.url} alt="" /> : x.url ? <b>PDF</b> : <span className="doc-mas">+</span>}
                      </span>
                      <span className="doc-t">{doc.t}{!doc.req && <em> (opcional)</em>}</span>
                      <span className="doc-e">{x.subiendo ? 'Subiendo…' : x.error || err[`doc_${doc.k}`] || (x.url ? 'Listo · toca para cambiar' : 'Toca para subir')}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <label className={`check${err.acepto ? ' con-error' : ''}`}>
              <input type="checkbox" checked={d.acepto} onChange={e => S('acepto', e.target.checked)} />
              <span>Acepto que Bigticket use estos datos y documentos para evaluar mi alta como transportista y contactarme.</span>
            </label>
            {general && <div className="aviso error">{general}</div>}
            <button className="btn" disabled={busy || quien === undefined}>{busy ? 'Enviando…' : 'Enviar mi postulación'}</button>
          </form>
        )}
      </main>
    </div>
  )
}
