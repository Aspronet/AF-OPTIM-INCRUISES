# `lead_filter_answers.answers` — guía rápida

Doc para consultar / mostrar las respuestas del form de pre-agendamiento (Step 3).

A partir de este commit, las respuestas viven en una columna `JSONB` única
(`answers`) en lugar de las 7 columnas explícitas viejas (`q1_nombre_completo`,
`q3_situacion_actual`, etc.). Las columnas viejas siguen existiendo para no
romper registros históricos, pero los inserts nuevos solo escriben `answers`.

---

## Estructura del JSONB

```json
{
  "nombre_completo": "Alejandro",
  "pais": "Argentina",
  "perfil": "Tengo un negocio de servicios y quiero vender más",
  "aplicar": "En mi propio negocio para vender más",
  "objetivo": "Generar una nueva fuente de ingresos"
}
```

### Keys (estables — no renombrar sin migrar consumidores)

| key                | pregunta del form                                                     | tipo            |
|--------------------|-----------------------------------------------------------------------|-----------------|
| `nombre_completo`  | ¿Cuál es tu nombre completo?                                          | texto libre     |
| `pais`             | ¿En qué país te encuentras?                                           | dropdown        |
| `perfil`           | ¿Cuál de estas opciones te describe mejor hoy?                        | single-choice   |
| `aplicar`          | ¿Dónde te gustaría aplicar lo que aprendas en la Certificación?       | single-choice   |
| `objetivo`         | ¿Qué es lo que más te interesa lograr con esto?                       | single-choice   |

Las keys están definidas en `src/app/step/3/page.tsx` como `ANSWER_KEYS`.

---

## Opciones válidas por pregunta

### `perfil`
- Tengo un negocio de servicios y quiero vender más
- Trabajo en marketing digital, ventas o tecnología
- Tengo empleo en otra área y busco una habilidad nueva con salida real
- Estoy empezando desde cero

### `aplicar`
- En mi propio negocio para vender más
- Ofrecer este servicio a otros negocios como profesional independiente
- Operar dentro del ecosistema comercial de Nexfy
- Todavía no estoy seguro

### `objetivo`
- Generar una nueva fuente de ingresos
- Mejorar las ventas de mi negocio actual
- Dejar de depender de un empleo tradicional
- Aprender una habilidad con demanda real en el mercado
- Todavía no estoy seguro

---

## Queries de ejemplo (Postgres)

### Última respuesta de cada lead

```sql
SELECT DISTINCT ON (lead_email)
  lead_email,
  answers ->> 'nombre_completo' AS nombre,
  answers ->> 'pais'            AS pais,
  answers ->> 'perfil'          AS perfil,
  answers ->> 'aplicar'         AS aplicar,
  answers ->> 'objetivo'        AS objetivo,
  created_at
FROM lead_filter_answers
WHERE answers <> '{}'::jsonb
ORDER BY lead_email, created_at DESC;
```

### Filtrar por respuesta concreta

```sql
-- Quienes quieren vender más en su propio negocio
SELECT lead_email, owner_id, created_at
FROM lead_filter_answers
WHERE answers ->> 'aplicar' = 'En mi propio negocio para vender más'
ORDER BY created_at DESC;

-- Quienes están "empezando desde cero" + no están seguros del objetivo
SELECT lead_email, answers
FROM lead_filter_answers
WHERE answers ->> 'perfil'   = 'Estoy empezando desde cero'
  AND answers ->> 'objetivo' = 'Todavía no estoy seguro';
```

### Distribución por opción (para dashboards)

```sql
SELECT answers ->> 'objetivo' AS objetivo, COUNT(*) AS n
FROM lead_filter_answers
WHERE answers ? 'objetivo'
GROUP BY 1
ORDER BY n DESC;
```

### JOIN con `leads` para enriquecer

```sql
SELECT
  l.id              AS lead_id,
  l.name,
  l.email,
  l.phone,
  l.country,
  lfa.answers,
  lfa.created_at    AS form_filled_at
FROM lead_filter_answers lfa
JOIN leads l ON l.email = lfa.lead_email
WHERE lfa.answers <> '{}'::jsonb
ORDER BY lfa.created_at DESC;
```

---

## Lectura desde JS / TS (cliente o server)

```ts
type Answers = {
  nombre_completo?: string;
  pais?: string;
  perfil?: string;
  aplicar?: string;
  objetivo?: string;
};

const labels: Record<keyof Answers, string> = {
  nombre_completo: "Nombre",
  pais: "País",
  perfil: "Perfil",
  aplicar: "Dónde aplicaría",
  objetivo: "Objetivo principal",
};

// Render
function FilterAnswers({ answers }: { answers: Answers }) {
  return (
    <dl>
      {Object.entries(answers).map(([k, v]) => (
        <div key={k}>
          <dt>{labels[k as keyof Answers]}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
```

### Vía Supabase REST

```ts
const r = await fetch(
  `${SUPABASE_URL}/rest/v1/lead_filter_answers?lead_email=eq.${email}&select=answers,created_at&order=created_at.desc&limit=1`,
  { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
);
const [row] = await r.json();
const answers: Answers = row?.answers ?? {};
```

---

## Índice GIN

Hay un índice GIN sobre `answers` para que las queries con operadores JSONB
(`?`, `?|`, `@>`, `->>` con filtro) sean rápidas:

```sql
CREATE INDEX idx_lfa_answers_gin ON lead_filter_answers USING GIN (answers);
```

Operadores que aprovechan el índice:

```sql
-- Existe la key
WHERE answers ? 'objetivo'

-- Contiene un sub-objeto
WHERE answers @> '{"perfil": "Estoy empezando desde cero"}'::jsonb

-- Cualquiera de estas keys
WHERE answers ?| ARRAY['perfil', 'aplicar']
```

Los `answers ->> 'key' = 'valor'` también funcionan pero usan el índice
solo si la query lo permite — para alta cardinalidad considerá un índice
expression dedicado.

---

## Migración futura (opcional)

Cuando confirmes que ningún reporte / export depende de las columnas viejas,
se pueden droppear:

```sql
ALTER TABLE lead_filter_answers
  DROP COLUMN q1_nombre_completo,
  DROP COLUMN q2_pais,
  DROP COLUMN q3_situacion_actual,
  DROP COLUMN q4_experiencia_negocios,
  DROP COLUMN q5_atencion_video,
  DROP COLUMN q6_tiempo_disponible,
  DROP COLUMN q7_disposicion_inversion;
```

Antes de hacerlo, si hay rows viejos con datos en esas columnas y los
querés conservar, backfilleá el JSONB:

```sql
UPDATE lead_filter_answers
SET answers = jsonb_strip_nulls(jsonb_build_object(
  'nombre_completo',         q1_nombre_completo,
  'pais',                    q2_pais,
  'situacion_actual_legacy', q3_situacion_actual,
  'experiencia_legacy',      q4_experiencia_negocios,
  'atencion_video_legacy',   q5_atencion_video,
  'tiempo_legacy',           q6_tiempo_disponible,
  'disposicion_legacy',      q7_disposicion_inversion
))
WHERE answers IS NULL OR answers = '{}'::jsonb;
```

(Notar el sufijo `_legacy` para no chocar con las keys nuevas.)
