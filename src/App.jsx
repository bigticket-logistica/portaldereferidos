// ═══════════════════════════════════════════════════════════════════════════
// Portal de Referidos · Bigticket MX
//
//   /            acceso del referidor (ingresar o crear cuenta) y su panel
//   /r/BT-XXXXX  invitación pública: el referido deja sus datos sin cuenta
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
