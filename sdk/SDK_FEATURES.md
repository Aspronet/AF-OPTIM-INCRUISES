# @asprofunnel/sdk — Features

## Hoy (v1.0)
- [x] `createLead()` — Capturar leads desde landing pages

---

## Roadmap

### Lead Management
- [ ] `getLead(id)` — Obtener un lead por ID
- [ ] `getLeads(filters)` — Listar leads con filtros (stage, source, date range)
- [ ] `updateLead(id, data)` — Actualizar stage, notas, campos custom
- [ ] `archiveLead(id)` — Archivar un lead

### Pipeline
- [ ] `getContactManagers()` — Listar contact managers del usuario
- [ ] `createContactManager(data)` — Crear un contact manager (nombre, color)
- [ ] `getPipelineStages(contactManagerId)` — Obtener stages de un pipeline
- [ ] `moveLead(leadId, stageId)` — Mover lead entre stages del pipeline
- [ ] `getLeadsByStage(contactManagerId)` — Leads agrupados por stage (para Kanban)

### Campaigns & Packages
- [ ] `getCampaigns()` — Listar campañas activas
- [ ] `getCampaignMetrics(campaignId)` — Métricas (spend, leads, CPL, clicks)
- [ ] `getPackages()` — Listar paquetes con presupuesto restante

### Meetings
- [ ] `createMeeting(data)` — Agendar reunión (lead, fecha, hora)
- [ ] `getMeetings(filters)` — Listar reuniones (upcoming, past)
- [ ] `updateMeeting(id, status)` — Marcar como completed/cancelled

### WhatsApp
- [ ] `sendMessage(leadId, text)` — Enviar mensaje de WhatsApp
- [ ] `sendTemplate(leadId, templateName, vars)` — Enviar template de WhatsApp
- [ ] `getConversation(leadId)` — Historial de mensajes con un lead

### Analytics
- [ ] `getDashboardStats()` — KPIs (budget, leads, CPL, meetings)
- [ ] `getLeadsByDate(days)` — Leads por día (para gráficos)
- [ ] `getWhatsAppStats()` — Stats de mensajería

### Webhooks (recibir eventos)
- [ ] `onNewLead` — Webhook cuando entra un lead nuevo
- [ ] `onStageChange` — Webhook cuando un lead cambia de stage
- [ ] `onNewMessage` — Webhook cuando llega un mensaje de WhatsApp
- [ ] `onMeetingScheduled` — Webhook cuando se agenda una reunión

### Embeds (componentes drop-in)
- [ ] `<AsproForm />` — Formulario de captura embebible (React/vanilla JS)
- [ ] `<AsproChat />` — Widget de chat embebible para sitios web
