// ═══════════════════════════════════════════════════════════════════════════
// Portal de Referidos · Bigticket MX
//
//   /            acceso del referidor (ingresar o crear cuenta) y su panel
//   /r/BT-XXXXX  invitación pública: el referido deja sus datos sin cuenta
//   /c/camioneta postulación por un canal de Bigticket (la camioneta, un
//                volante…): el referido queda registrado con ese canal y sin
//                referidor, así que no genera bonos.
//
// Sin librería de rutas: son dos pantallas y se distinguen por la dirección.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Acceso from './Acceso'
import Panel from './Panel'
import Invitacion from './Invitacion'

export default function App() {
  const ruta = window.location.pathname
  const invitacion = ruta.match(/^\/r\/([A-Za-z0-9-]+)/)
  if (invitacion) return <Invitacion codigo={invitacion[1].toUpperCase()} />
  const canal = ruta.match(/^\/c\/([A-Za-z0-9_-]+)/)
  if (canal) return <Invitacion codigo={canal[1].toLowerCase()} canal />
  // /a/comercio → link de anfitrión (supervisor o comercio aliado): lleva a la
  // inscripción de REFERIDORES y deja guardado quién invitó.
  const anfitrion = ruta.match(/^\/a\/([A-Za-z0-9_-]+)/)
  if (anfitrion) {
    window.history.replaceState(null, '', '/?a=' + anfitrion[1].toUpperCase() + window.location.search.replace(/^\?/, '&'))
  }
  return <ZonaReferidor />
}

function ZonaReferidor() {
  const [session, setSession] = useState(undefined)
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="cargando"><span className="spin" /></div>
  if (!session || recuperando) return <Acceso recuperando={recuperando && !!session} onListo={() => setRecuperando(false)} onRecuperando={setRecuperando} />
  return <Panel session={session} />
}
