#!/usr/bin/env node
// Crea un usuario de desarrollo con rol, vía la Admin API de Supabase local.
// Uso: pnpm db:user <email> <admin|broker_internal|broker_external|client> [brokerage_uuid] [password]
// (brokerage_uuid es obligatorio para broker_external)
import { createClient } from '@supabase/supabase-js'

const [email, role = 'client', brokerageId, password = 'celsius-dev-123'] = process.argv.slice(2)
const VALID_ROLES = ['admin', 'broker_internal', 'broker_external', 'client']

if (!email || !VALID_ROLES.includes(role)) {
  console.error('Uso: pnpm db:user <email> <admin|broker_internal|broker_external|client> [brokerage_uuid] [password]')
  process.exit(1)
}
if (role === 'broker_external' && !brokerageId) {
  console.error('Un broker_external requiere brokerage_uuid (ver tabla brokerage).')
  process.exit(1)
}

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceKey) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY (la imprime `pnpm db:start`).')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role, ...(brokerageId ? { brokerage_id: brokerageId } : {}) }, // leído por handle_new_user()
  user_metadata: { full_name: email.split('@')[0] },
})

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}
console.log(`✓ Usuario creado: ${data.user.email} · rol ${role} · password: ${password}`)
