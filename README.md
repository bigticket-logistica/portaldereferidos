# Portal de Referidos · Bigticket MX

Portal donde cualquier persona (menos trabajadores de Bigticket) se registra
como referidor, recibe un código con link y QR, y sigue el avance de los
transportistas que refiere. Mismo proyecto de Supabase que el portal de
terceros y el Brain; las tablas del programa llevan el prefijo `ref_`.

## Pantallas
- `/` acceso del referidor (ingresar, crear cuenta, recuperar contraseña) y su panel.
- `/r/BT-XXXXX` invitación pública: el referido deja sus datos sin crear cuenta.
  Con `?o=qr` queda registrado que llegó por el QR.

## Base de datos (Supabase)
- `ref_referidores`, `ref_trabajadores_bt`, `ref_referidos`, `ref_premios` (con RLS).
- `fn_ref_crear_referidor`, `fn_ref_registrar_referido`, `fn_ref_invitacion`, `fn_ref_guardar_clabe`.
- `vw_ref_avance` (interna) y `vw_ref_mis_referidos` (lo que ve cada referidor).
- `fn_ref_generar_premios`, cada noche por cron (tarea `ref_generar_premios`).

## Variables de entorno (Vercel y `.env` local)
```
VITE_SUPABASE_URL=https://psvdtgjvognbmxfvqbaa.supabase.co
VITE_SUPABASE_ANON_KEY=...la misma anon key del portal de terceros...
```

## Comandos
```
npm install
npm run dev     # local
npm run build   # lo corre Vercel
```
