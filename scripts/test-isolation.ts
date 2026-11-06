import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !anonKey || supabaseUrl.includes("placeholder")) {
  console.error("Error: Please set valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local before running test.")
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, serviceRoleKey || anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = "DemoPass123!"

async function createAuthenticatedClient(email: string) {
  const client = createClient(supabaseUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  })
  if (error || !data.session) {
    throw new Error(`Failed to sign in as ${email}: ${error?.message}`)
  }
  return client
}

function createAnonymousClient() {
  return createClient(supabaseUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function runTests() {
  console.log("==========================================")
  console.log("🛡️  RUNNING DATABASE ISOLATION & RLS TESTS")
  console.log("==========================================\n")

  // Fetch restaurant IDs
  const { data: restA } = await adminClient.from("restaurants").select("id, slug").eq("slug", "lone-star-tacos").single()
  const { data: restB } = await adminClient.from("restaurants").select("id, slug").eq("slug", "austin-noodle-bar").single()

  if (!restA || !restB) {
    console.error("❌ Seed data not found. Please run 'npm run db:seed' first.")
    process.exit(1)
  }

  let failedCount = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`)
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` (${detail})` : ""}`)
      failedCount++
    }
  }

  // 1. owner.a can read A's orders; cannot read B's orders, menu edits, customers, memberships
  console.log("[Test Suite 1] Testing Owner A isolation...")
  const ownerA = await createAuthenticatedClient("owner.a@demo.test")

  const { data: aOrders } = await ownerA.from("orders").select("id").eq("restaurant_id", restA.id)
  assert((aOrders?.length ?? 0) > 0, "owner.a can read A's orders")

  const { data: bOrdersSeenByA } = await ownerA.from("orders").select("id").eq("restaurant_id", restB.id)
  assert((bOrdersSeenByA?.length ?? 0) === 0, "owner.a cannot read B's orders")

  const { data: bMenuItemsSeenByA } = await ownerA.from("menu_items").select("id").eq("restaurant_id", restB.id)
  assert((bMenuItemsSeenByA?.length ?? 0) === 0, "owner.a cannot read B's menu items")

  const { data: bCustomersSeenByA } = await ownerA.from("customers").select("id").eq("restaurant_id", restB.id)
  assert((bCustomersSeenByA?.length ?? 0) === 0, "owner.a cannot read B's customers")

  const { data: bMembershipsSeenByA } = await ownerA.from("memberships").select("id").eq("restaurant_id", restB.id)
  assert((bMembershipsSeenByA?.length ?? 0) === 0, "owner.a cannot read B's memberships")

  // 2. owner.a cannot update B's menu_items or insert orders for B
  console.log("\n[Test Suite 2] Testing Owner A modification restrictions on Restaurant B...")
  const { data: updateBMenuResult } = await ownerA
    .from("menu_items")
    .update({ name: "Hacked Item" })
    .eq("restaurant_id", restB.id)
    .select()
  assert((updateBMenuResult?.length ?? 0) === 0, "owner.a cannot update B's menu_items")

  const { error: insertBOrderError } = await ownerA.from("orders").insert({
    restaurant_id: restB.id,
    order_number: "HACK01",
    order_type: "table",
    subtotal_cents: 100,
    tax_cents: 10,
    total_cents: 110,
  })
  assert(insertBOrderError !== null, "owner.a cannot insert orders for B")

  // 3. manager.a cannot read customers or billing; can toggle menu_items.available for A
  console.log("\n[Test Suite 3] Testing Manager A permissions & restrictions...")
  const managerA = await createAuthenticatedClient("manager.a@demo.test")

  const { data: managerCustomers } = await managerA.from("customers").select("id").eq("restaurant_id", restA.id)
  assert((managerCustomers?.length ?? 0) === 0, "manager.a cannot read customers")

  const { data: managerBilling } = await managerA.from("billing").select("plan_name").eq("restaurant_id", restA.id)
  assert((managerBilling?.length ?? 0) === 0, "manager.a cannot read billing")

  // Manager toggles available
  const { data: aItem } = await adminClient.from("menu_items").select("id, available").eq("restaurant_id", restA.id).limit(1).single()
  if (aItem) {
    const newAvailableState = !aItem.available
    const { data: toggleResult, error: toggleErr } = await managerA
      .from("menu_items")
      .update({ available: newAvailableState })
      .eq("id", aItem.id)
      .select()
    assert(!toggleErr && toggleResult?.length === 1 && toggleResult[0].available === newAvailableState, "manager.a can toggle menu_items.available for A")
  } else {
    assert(false, "manager.a can toggle menu_items.available for A", "No menu item found to toggle")
  }

  // 4. owner.b cannot read anything of A
  console.log("\n[Test Suite 4] Testing Owner B total isolation from Restaurant A...")
  const ownerB = await createAuthenticatedClient("owner.b@demo.test")

  const { data: bReadingAOrders } = await ownerB.from("orders").select("id").eq("restaurant_id", restA.id)
  assert((bReadingAOrders?.length ?? 0) === 0, "owner.b cannot read A's orders")

  const { data: bReadingACustomers } = await ownerB.from("customers").select("id").eq("restaurant_id", restA.id)
  assert((bReadingACustomers?.length ?? 0) === 0, "owner.b cannot read A's customers")

  const { data: bReadingABilling } = await ownerB.from("billing").select("plan_name").eq("restaurant_id", restA.id)
  assert((bReadingABilling?.length ?? 0) === 0, "owner.b cannot read A's billing")

  const { data: bReadingAMemberships } = await ownerB.from("memberships").select("id").eq("restaurant_id", restA.id)
  assert((bReadingAMemberships?.length ?? 0) === 0, "owner.b cannot read A's memberships")

  const { data: bReadingATables } = await ownerB.from("tables").select("id").eq("restaurant_id", restA.id)
  assert((bReadingATables?.length ?? 0) === 0, "owner.b cannot read A's tables")

  // 5. anonymous cannot select any table; get_public_menu('lone-star-tacos') works and contains no private fields
  console.log("\n[Test Suite 5] Testing Anonymous restrictions & public menu function...")
  const anon = createAnonymousClient()

  const { data: anonTables } = await anon.from("tables").select("id")
  assert((anonTables?.length ?? 0) === 0, "anonymous cannot select any table directly")

  const { data: anonOrders } = await anon.from("orders").select("id")
  assert((anonOrders?.length ?? 0) === 0, "anonymous cannot select any orders directly")

  const { data: menuData, error: menuErr } = await anon.rpc("get_public_menu", { p_slug: "lone-star-tacos" })
  const hasMenu = !menuErr && menuData && menuData.slug === "lone-star-tacos" && Array.isArray(menuData.categories)
  assert(Boolean(hasMenu), "get_public_menu('lone-star-tacos') returns public menu data")

  const hasPrivateFields =
    menuData &&
    ("telegram_chat_id" in menuData ||
      "telegram_enabled" in menuData ||
      "customer_email_reply_to" in menuData ||
      "onboarding" in menuData)
  assert(!hasPrivateFields, "get_public_menu contains no private fields (telegram, internal settings)")

  // 6. admin can read both restaurants
  console.log("\n[Test Suite 6] Testing Platform Admin omni-access...")
  const admin = await createAuthenticatedClient("admin@demo.test")

  const { data: adminOrdersA } = await admin.from("orders").select("id").eq("restaurant_id", restA.id)
  const { data: adminOrdersB } = await admin.from("orders").select("id").eq("restaurant_id", restB.id)
  assert((adminOrdersA?.length ?? 0) > 0 && (adminOrdersB?.length ?? 0) > 0, "admin can read orders from both Restaurant A and Restaurant B")

  const { data: allRestaurants } = await admin.from("restaurants").select("id")
  assert((allRestaurants?.length ?? 0) >= 2, "admin can read all restaurants")

  console.log("\n==========================================")
  if (failedCount === 0) {
    console.log("🎉 ALL ISOLATION & RLS TESTS PASSED!")
    console.log("==========================================")
    process.exit(0)
  } else {
    console.error(`💥 ${failedCount} TEST(S) FAILED!`)
    console.log("==========================================")
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err)
  process.exit(1)
})

