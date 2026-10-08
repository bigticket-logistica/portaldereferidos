// Mismo proyecto de Supabase que el portal de terceros y el Brain. Las tablas
// del programa llevan el prefijo ref_ y cada referidor solo puede leer lo suyo.
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// Los errores de las funciones de la base llegan con el texto pensado para el
// usuario; los de Supabase Auth, en inglés. Se traducen los más comunes.
export function mensajeError(e) {
  const m = String(e?.message || e || '')
  if (/Invalid login credentials/i.test(m)) return 'El correo o la contraseña no son correctos.'
  if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene una cuenta. Ingresa con tu contraseña.'
  if (/Email not confirmed/i.test(m)) return 'Primero confirma tu correo: te enviamos un enlace al registrarte.'
  if (/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.'
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
  if (/expired|invalid.*otp|token/i.test(m)) return 'El código no es válido o ya venció.'
  return m || 'Algo salió mal. Vuelve a intentarlo.'
}
