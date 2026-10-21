// ═══════════════════════════════════════════════════════════════════════════
// Propuesta económica de un centro (ref_propuestas), tal como la arma el
// analista en el Brain → Referidos → Oportunidades. Es la misma "Vista del
// conductor" del Brain y de la propuesta de campañas, copiada sin cambios.
// ═══════════════════════════════════════════════════════════════════════════
const TRAMOS = ["0-100", "101-150", "151-200", "201-250", "251+"];

export default function PropuestaVista({ p }) {
  const titulo = (t) => (
    <div style={{ fontSize: 14, fontWeight: 700, color: "#1a3a6b", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 4, height: 18, background: "#F47B20", borderRadius: 2 }} />{t}
    </div>
  );
  const check = (items) => (
    <div style={{ fontSize: 13, color: "#444", display: "flex", flexDirection: "column", gap: 8 }}>
      {items.filter(Boolean).map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ color: "#27ae60", fontWeight: 700, flexShrink: 0 }}>✓</span><span>{item}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ border: "1px solid #e4e7ec", borderRadius: 14, overflow: "hidden", background: "#fff", color: "#1a1a1a" }}>
      <div>
        <div style={{ background: "#002f5d", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src="https://psvdtgjvognbmxfvqbaa.supabase.co/storage/v1/object/public/assets/LOGO%20ENCUESTA%20Y%20PROPUESTA.png" alt="Bigticket" style={{ height: 34, objectFit: "contain" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Vista del Conductor</span>
          </div>
        </div>
        <div>
          <div style={{ padding: "20px 16px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>Propuesta Económica</div>
            <div style={{ width: 48, height: 3, background: "#F47B20", borderRadius: 2 }} />
          </div>
          <div style={{ padding: "0 16px 18px" }}>
            {titulo("Condiciones Generales de la Operación")}
            <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, border: "0.5px solid #e4e7ec" }}>
              {[["📍", "Dirección CEDIS", p.cedis], ["🕐", "Horario", p.horario], ["📦", "Entregas estimadas", p.entregas], ["🗓", "Devolución", p.devolucion]].map(([ic, l, v]) => v && (
                <div key={l}>
                  <div style={{ fontSize: 10, color: "#1a1a1a", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>{ic} {l}</div>
                  <div style={{ fontSize: 13, fontWeight: 400, color: "#1a1a1a" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {p.tarifas?.length > 0 && (
            <div style={{ padding: "0 16px 18px" }}>
              {titulo("Tarifas por Jornada")}
              <div style={{ overflowX: "auto", borderRadius: 10, border: "0.5px solid #e4e7ec" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ background: "#1a3a6b", color: "#fff" }}>
                    <th style={{ padding: "9px 12px", textAlign: "left" }}>Categoría</th>
                    {TRAMOS.map((t) => <th key={t} style={{ padding: "9px 8px", textAlign: "center" }}>{t} km</th>)}
                  </tr></thead>
                  <tbody>
                    {p.tarifas.map((t, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#f8f9fa" : "#fff", borderBottom: "0.5px solid #e4e7ec" }}>
                        <td style={{ padding: "9px 12px", fontWeight: 700, color: "#1a1a1a" }}>{t.categoria}</td>
                        {TRAMOS.map((k) => <td key={k} style={{ padding: "9px 8px", textAlign: "center", fontWeight: 600, color: "#1a1a1a" }}>{t.tramos?.[k] ? `$ ${t.tramos[k]}` : "—"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>*Valores netos + IVA{p.auxiliar ? ` | Auxiliar: ${p.auxiliar}` : ""}</div>
            </div>
          )}
          <div style={{ padding: "0 16px 18px" }}>
            {titulo("Nivel de Servicio")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ background: "#f0f2f5", borderRadius: 10, padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#888", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Mínimo exigido</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a3a6b" }}>{p.ns_minimo || "99.00%"}</div>
              </div>
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "14px", textAlign: "center", border: "1.5px solid #86efac" }}>
                <div style={{ fontSize: 10, color: "#166534", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Excelente 🏆</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#166534" }}>{p.ns_excelente}</div>
                <div style={{ fontSize: 11, color: "#166534", marginTop: 4 }}>Premio: {p.ns_premio}</div>
              </div>
            </div>
            <div style={{ background: "#fffbeb", borderRadius: 10, padding: "12px 16px", border: "1px solid #fde68a", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: "#F47B20", flexShrink: 0 }}>⚠️</span>
              <div style={{ fontSize: 12, color: "#92400e" }}><strong>Castigo:</strong> {p.ns_castigo}</div>
            </div>
          </div>
          <div style={{ padding: "0 16px 18px" }}>
            {titulo("Condiciones de Pago")}
            {check(["Pago semanal cada viernes", "Transferencia bancaria, previa emisión de CFDI",
              p.semana_retenida ? "Semana retenida al inicio como garantía" : null,
              `Vigencia del contrato: ${p.vigencia || "12 meses"} condicionado al cumplimiento de los niveles de servicio.`])}
          </div>
          {p.requisitos && (
            <div style={{ padding: "0 16px 18px" }}>
              {titulo("Requisitos del Prestador")}
              {check(p.requisitos.split("\n").filter(Boolean))}
            </div>
          )}
          {p.notas && (
            <div style={{ padding: "0 16px 18px" }}>
              <div style={{ background: "#f0f9ff", borderRadius: 10, padding: "12px 16px", border: "1px solid #bae6fd", fontSize: 12, color: "#0369a1" }}>
                <strong>📌 Nota:</strong> {p.notas}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

