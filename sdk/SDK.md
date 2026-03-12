# @asprofunnel/sdk

SDK para capturar leads desde cualquier landing page y asignarlos automáticamente a usuarios de AsproFunnel.

---

## Modelo de uso

Aspronet (agencia) instala el SDK en las landings de cada cliente/marca.
El SDK usa una **API key** (de la agencia) y un **campaign_id** (de la campaña).
El lead se asigna automáticamente al usuario con paquete activo **proporcional a su budget** (el que más presupuesto tiene, más leads recibe).

```
Landing → SDK (apiKey + campaignId)
    ↓
lead-optin edge function
    ↓
campaign → community → packages (pool de usuarios activos con budget > 0)
    ↓
Distribución proporcional al budget → asigna al más "underserved"
    ↓
Insert lead + deducir costo del paquete + push notification
```

---

## Instalación

```bash
# Desde el monorepo (local)
npm install ../asprofunnel-app/sdk

# Futuro: desde npm
npm install @asprofunnel/sdk
```

---

## Configuración

### Variables de entorno del landing

```env
AF_API_KEY=af_live_c67e6bf2e7607c1f75ed338e8482e49d41890e6db9c5123d
AF_CAMPAIGN_ID=f0b74fdf-4a2f-4438-b7d2-9c7088630375
```

- `AF_API_KEY` — API key de la agencia (tabla `api_keys`)
- `AF_CAMPAIGN_ID` — ID de la campaña, determina la pool de usuarios

### Inicializar el SDK

```typescript
import { createAsproFunnel } from "@asprofunnel/sdk";

const af = createAsproFunnel({
  apiKey: process.env.AF_API_KEY!,
});
```

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `apiKey` | string | Si | API key de la agencia (`af_live_xxx`) |
| `baseUrl` | string | No | URL base de la API (solo para dev/testing) |

---

## Métodos

### `createLead(data)`

Crea un lead y lo asigna automáticamente al usuario correspondiente.

```typescript
const response = await af.createLead({
  campaignId: "f0b74fdf-4a2f-4438-b7d2-9c7088630375",
  name: "Juan Pérez",
  firstName: "Juan",
  lastName: "Pérez",
  email: "juan@email.com",
  phone: "+5491155551234",
  country: "AR",
  source: "landing",
  metadata: { utm_source: "google", utm_medium: "cpc" },
});

console.log(response.lead.id);      // UUID del lead
console.log(response.assignedTo);   // UUID del usuario asignado
```

#### Parámetros (LeadData)

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `campaignId` | string | **Si** | UUID de la campaña — determina la pool de usuarios |
| `name` | string | **Si** | Nombre completo |
| `firstName` | string | No | Nombre de pila |
| `lastName` | string | No | Apellido |
| `email` | string | No | Email del lead |
| `phone` | string | No | Teléfono con código de país (ej: `+5491155551234`) |
| `country` | string | No | Código ISO del país (ej: `AR`, `MX`, `CO`) |
| `source` | string | No | Origen del lead (default: `"landing"`) |
| `metadata` | object | No | Datos extra (UTMs, variante de landing, etc.) |

#### Respuesta (LeadResponse)

```json
{
  "ok": true,
  "lead": {
    "id": "a2020226-b48a-43b2-88d8-784431fbe62d",
    "name": "Juan Pérez",
    "email": "juan@email.com",
    "created_at": "2026-03-10T19:33:48.181Z"
  },
  "assignedTo": "c0256632-c2fc-41f2-8433-5569feb8d663",
  "cost": 500,
  "remainingBudget": 39500
}
```

#### Errores

| Status | Error | Causa |
|--------|-------|-------|
| 400 | `name is required` | Falta el campo `name` |
| 400 | `campaign_id is required` | Falta el campo `campaignId` |
| 401 | `Missing API key` | No se envió el header `x-af-key` |
| 403 | `Invalid API key` | Key inexistente o desactivada |
| 404 | `Campaign not found` | El `campaignId` no existe |
| 404 | `No active packages with budget` | No hay usuarios con paquete activo en esa campaña |
| 500 | `Failed to create lead` | Error al insertar en la base de datos |

---

## Routing automático de leads

### Cadena de tablas

```
campaign_id (del SDK)
    ↓
campaigns → community_id
    ↓
packages WHERE community_id = X AND status = 'active' AND remaining_budget > 0
    ↓
Pool de usuarios elegibles
    ↓
Distribución proporcional al budget (weighted)
```

### Tablas involucradas

| Tabla | Campo clave | Función |
|-------|-------------|---------|
| `api_keys` | `key`, `is_active` | Autenticar la agencia |
| `campaigns` | `id`, `community_id` | Vincular campaña con comunidad |
| `communities` | `id` | Agrupar usuarios por marca |
| `packages` | `user_id`, `community_id`, `status`, `remaining_budget` | **Pool de usuarios** — quiénes pueden recibir leads |
| `campaign_metrics` | `total_spend`, `total_leads` | Calcular CPL para deducir costo |
| `leads` | `user_id`, `campaign_id` | Conteo para distribución proporcional |

### Algoritmo de distribución

La distribución es **proporcional al budget** de cada usuario:

- Usuario A: $1200 budget → target 75% de los leads
- Usuario B: $400 budget → target 25% de los leads

El sistema asigna al usuario más "underserved" — el que tiene la mayor diferencia entre su share objetivo (por budget) y su share real (por leads recibidos).

**Ejemplo con 3 usuarios:**

| Usuario | Budget | Target share | Leads actuales | Share real | Gap |
|---------|--------|-------------|----------------|-----------|-----|
| A | $1200 | 60% | 2 | 40% | **+20%** ← recibe el siguiente |
| B | $400 | 20% | 2 | 40% | -20% |
| C | $400 | 20% | 1 | 20% | 0% |

### Deducción de costo

- Cada lead descuenta del `remaining_budget` del paquete asignado
- El costo se calcula como **CPL** desde `campaign_metrics` (total_spend / total_leads)
- Si no hay métricas aún, se usa un fallback de **$5 (500 centavos)** por lead
- Cuando `remaining_budget` llega a 0 → el paquete pasa a `status: 'finished'` y sale de la pool automáticamente

### ¿Dónde ver los integrantes de una campaña?

En la tabla **`packages`** filtrando por `community_id` de la campaña:

```sql
-- Ver pool de usuarios de la campaña "Incruises Landing"
SELECT p.user_id, up.first_name, up.last_name, p.status, p.remaining_budget
FROM packages p
JOIN user_profiles up ON up.id = p.user_id
WHERE p.community_id = (
  SELECT community_id FROM campaigns WHERE id = 'f0b74fdf-4a2f-4438-b7d2-9c7088630375'
)
AND p.status = 'active'
AND p.remaining_budget > 0;
```

### Qué pasa cuando entra un lead

1. SDK envía POST con `x-af-key` + `campaign_id`
2. Valida API key en `api_keys`
3. Busca `campaign` → obtiene `community_id`
4. Busca `packages` activos con budget en esa community → la **pool**
5. Calcula CPL desde `campaign_metrics` (fallback: $5)
6. Calcula share objetivo (budget) vs share real (leads) por usuario → **distribución proporcional**
7. Asigna al usuario más "underserved"
8. Inserta lead con el `user_id` ganador
9. Deduce costo del paquete via `deduct_lead_cost()` (auto-finish si llega a 0)
10. Loguea actividad en `activities`
11. Envía push notification via Expo Push API al usuario asignado
12. Retorna `{ ok, lead, assignedTo, cost, remainingBudget }`

---

## Ejemplo completo: Next.js Server Action

```typescript
// src/app/actions.ts
"use server";

import { createAsproFunnel } from "@asprofunnel/sdk";

const af = createAsproFunnel({
  apiKey: process.env.AF_API_KEY!,
});

export async function submitLead(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const countryCode = formData.get("countryCode") as string;
  const countryIso = formData.get("countryIso") as string;

  const fullPhone = phone ? `${countryCode}${phone.replace(/^0+/, "")}` : undefined;

  await af.createLead({
    campaignId: process.env.AF_CAMPAIGN_ID!,
    name,
    firstName: name.split(" ")[0],
    lastName: name.split(" ").slice(1).join(" ") || undefined,
    email,
    phone: fullPhone,
    country: countryIso || undefined,
    source: "landing",
  });
}
```

---

## Ejemplo: Vanilla JS / HTML

```html
<script type="module">
  import { createAsproFunnel } from "https://cdn.jsdelivr.net/npm/@asprofunnel/sdk/dist/index.mjs";

  const af = createAsproFunnel({ apiKey: "af_live_xxx" });

  document.getElementById("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    await af.createLead({
      campaignId: "uuid-de-la-campaña",
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      source: "landing",
    });

    window.location.href = "/gracias";
  });
</script>
```

---

## API Keys

La API key identifica a la **agencia**, no al usuario final. Una key puede servir para todas las campañas.

### Generar una key

```sql
INSERT INTO api_keys (user_id, key, label)
VALUES (
  'uuid-del-admin-agencia',
  'af_live_' || encode(gen_random_bytes(24), 'hex'),
  'Agencia Aspronet'
);
```

### Estructura de la tabla `api_keys`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | Admin de la agencia (owner de la key) |
| `key` | text | Key única `af_live_xxx` |
| `label` | text | Nombre descriptivo |
| `is_active` | boolean | Se puede desactivar sin borrar |
| `created_at` | timestamp | Fecha de creación |

---

## Edge Function: lead-optin

- **URL**: `https://pcmuwwfivmstqnoiyqur.supabase.co/functions/v1/lead-optin`
- **Método**: POST
- **Auth**: Header `x-af-key` (no JWT, es público)
- **Deploy**: `supabase functions deploy lead-optin --project-ref pcmuwwfivmstqnoiyqur --no-verify-jwt`

---

## Cómo configurar una nueva campaña para el SDK

1. **Crear la comunidad** (si no existe) en tabla `communities`
2. **Crear la campaña** en tabla `campaigns` con `community_id`
3. **Crear paquetes** para cada usuario que debe recibir leads:
   ```sql
   INSERT INTO packages (user_id, community_id, total_budget, remaining_budget, status)
   VALUES ('uuid-usuario', 'uuid-community', 50000, 50000, 'active');
   ```
4. **Configurar el landing**:
   ```env
   AF_API_KEY=af_live_xxx
   AF_CAMPAIGN_ID=uuid-de-la-campaña
   ```
5. Los leads se asignan automáticamente **proporcional al budget** entre los usuarios con paquete activo
6. Cada lead descuenta del budget del usuario asignado. Cuando llega a $0 → sale de la pool

---

## Archivos clave

```
asprofunnel-app/
├── sdk/
│   ├── src/index.ts              ← Código fuente del SDK
│   ├── dist/                     ← Build (CJS + ESM + types)
│   ├── package.json              ← @asprofunnel/sdk v1.0.0
│   ├── SDK.md                    ← Este archivo
│   └── SDK_FEATURES.md           ← Roadmap de features
├── supabase/
│   ├── functions/
│   │   └── lead-optin/index.ts   ← Edge function (routing + push)
│   └── migrations/
│       └── 016_api_keys.sql      ← Tabla api_keys
```

---

## Build del SDK

```bash
cd sdk/
npm run build     # Genera dist/ (CJS + ESM + types)
npm run dev       # Watch mode
```
