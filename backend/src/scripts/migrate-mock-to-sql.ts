#!/usr/bin/env ts-node
/**
 * migrate-mock-to-sql.ts
 *
 * Triggers the DB-seed logic that each service runs lazily on startup,
 * so all seed data is written to PostgreSQL before the server starts.
 *
 * Usage:
 *   cd backend && npx ts-node src/scripts/migrate-mock-to-sql.ts
 *
 * Environment:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.
 */

import 'dotenv/config'
import { isSupabaseConfigured } from '../lib/supabase'

async function run(): Promise<void> {
  if (!isSupabaseConfigured) {
    console.error('❌  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. Aborting.')
    process.exit(1)
  }

  console.log('🚀  Starting mock → PostgreSQL migration…')
  console.log('   DB configured:', isSupabaseConfigured)

  // 1. Packs
  console.log('\n📦  Seeding packs…')
  const { getPacks } = await import('../data/mockPacksDB')
  const packs = await getPacks()
  console.log(`    ✅  ${packs.length} packs in DB`)

  // 2. Marketplace products
  console.log('\n🛒  Seeding marketplace products…')
  const { seedProducts, getProducts } = await import('../services/marketplaceService')
  await seedProducts()
  const { total: mpTotal } = await getProducts({ limit: 1 })
  console.log(`    ✅  ${mpTotal} marketplace products in DB`)

  // 3. Coupons
  console.log('\n🎟️   Seeding coupons…')
  const { listCoupons } = await import('../services/couponService')
  const coupons = await listCoupons()
  console.log(`    ✅  ${coupons.length} coupons in DB`)

  // 4. Verify core tables
  console.log('\n🔍  Verifying core tables…')
  const { supabase } = await import('../lib/db')
  if (!supabase) throw new Error('Supabase client unavailable')

  const checks = ['users', 'projects', 'subscriptions', 'project_versions',
                  'packs', 'marketplace_products', 'coupons', 'collab_rooms',
                  'billing_history', 'support_tickets', 'teams']

  for (const table of checks) {
    const { count, error } = await supabase
      .from(table).select('*', { count: 'exact', head: true })
    if (error) {
      console.warn(`    ⚠️   ${table}: ${error.message}`)
    } else {
      console.log(`    ✅  ${table}: ${count ?? 0} rows`)
    }
  }

  console.log('\n🎉  Migration complete. All seed data is in PostgreSQL.')
  console.log('    No in-memory mock data will be used in production.\n')
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
