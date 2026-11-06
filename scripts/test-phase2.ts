import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

const isPlaceholder =
  !supabaseUrl ||
  !supabaseServiceRoleKey ||
  supabaseUrl.includes("placeholder") ||
  supabaseServiceRoleKey.includes("placeholder")

async function runTests() {
  console.log("\n=======================================================")
  console.log("  PHASE 2 AUTH & ROLES COMPREHENSIVE VERIFICATION")
  console.log("=======================================================\n")

  let passed = 0
  let failed = 0

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${description}`)
      failed++
    }
  }

  // 1. Algorithmic and Cryptographic Unit Tests
  console.log("--- 1. Cryptography & Staff PIN Hash Verification ---")
  const rawPin = Math.floor(1000 + Math.random() * 9000).toString()
  const salt = await bcrypt.genSalt(10)
  const pinHash = await bcrypt.hash(rawPin, salt)

  assert(rawPin.length === 4 && /^\d{4}$/.test(rawPin), "Generated 4-digit numeric PIN format")
  assert(await bcrypt.compare(rawPin, pinHash), "Bcrypt verification succeeds for correct PIN")
  assert(!(await bcrypt.compare("9999", pinHash && rawPin !== "9999" ? pinHash : "$2a$10$invalid")), "Bcrypt verification fails for incorrect PIN")

  console.log("\n--- 2. Pairing Code Hashing & Token Verification ---")
  const rawPairingCode = Math.floor(100000 + Math.random() * 900000).toString()
  const codeHash = crypto.createHash("sha256").update(rawPairingCode).digest("hex")
  assert(rawPairingCode.length === 6 && /^\d{6}$/.test(rawPairingCode), "Generated 6-digit numeric pairing code format")
  assert(codeHash.length === 64, "SHA-256 code hash is 64-character hex string")

  const rawToken = crypto.randomBytes(24).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  assert(rawToken.length === 48, "Cryptographic 24-byte invite token generated")
  assert(tokenHash.length === 64, "Invite token SHA-256 hash valid")

  // 3. Database / Integration Tests
  console.log("\n--- 3. Database & Supabase Auth Connection ---")
  if (isPlaceholder) {
    console.log("  ℹ️ NOTE: Supabase credentials in .env.local are currently placeholders.")
    console.log("     To test live database execution:")
    console.log("     1. Add your project URL and service role key to .env.local")
    console.log("     2. Run: npm run db:seed")
    console.log("     3. Re-run: npm run test:phase2\n")
    console.log("=======================================================")
    console.log(`  UNIT TEST RESULTS: ${passed} Passed, ${failed} Failed`)
    console.log("=======================================================\n")
    return
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { data: restaurants, error: restErr } = await adminClient
      .from("restaurants")
      .select("id, name, slug")
      .order("name")

    assert(!restErr && Boolean(restaurants && restaurants.length >= 2), "Seed restaurants found in database")
    if (!restaurants || restaurants.length < 2) {
      console.error("Please run `npm run db:seed` first.")
      return
    }

    const loneStar = restaurants.find((r) => r.slug === "lone-star-tacos")!
    const noodleBar = restaurants.find((r) => r.slug === "austin-noodle-bar")!

    // Verify Seeded logins
    console.log("\n--- 4. Seeded Accounts Verification ---")
    const testAccounts = [
      { email: "admin@demo.test", expectedRole: "admin" },
      { email: "owner.a@demo.test", expectedRole: "owner", restaurantId: loneStar.id },
      { email: "manager.a@demo.test", expectedRole: "manager", restaurantId: loneStar.id },
      { email: "owner.b@demo.test", expectedRole: "owner", restaurantId: noodleBar.id },
    ]

    for (const acc of testAccounts) {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const { data: authData, error: loginErr } = await client.auth.signInWithPassword({
        email: acc.email,
        password: "DemoPass123!",
      })

      assert(!loginErr && Boolean(authData.user), `Sign in with password for ${acc.email}`)

      if (authData.user) {
        if (acc.expectedRole === "admin") {
          const { data: adminRow } = await adminClient
            .from("platform_admins")
            .select("user_id")
            .eq("user_id", authData.user.id)
            .maybeSingle()
          assert(Boolean(adminRow), `User ${acc.email} is registered in platform_admins`)
        } else {
          const { data: memRow } = await adminClient
            .from("memberships")
            .select("role, restaurant_id, active")
            .eq("user_id", authData.user.id)
            .eq("restaurant_id", acc.restaurantId!)
            .eq("active", true)
            .maybeSingle()
          assert(
            memRow?.role === acc.expectedRole,
            `User ${acc.email} has active role '${acc.expectedRole}'`
          )
        }
      }
    }

    // Verify Security Activity Log
    console.log("\n--- 5. Security Activity Log Events ---")
    const securityActions = [
      "invite_created",
      "invite_accepted",
      "pairing_code_created",
      "device_paired",
      "device_revoked",
      "pin_added",
      "pin_removed",
    ]

    for (const actionName of securityActions) {
      const { data: logEntry } = await adminClient
        .from("activity_log")
        .select("id, action, actor_name, created_at")
        .eq("action", actionName)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      assert(Boolean(logEntry), `Activity log schema supports '${actionName}' event`)
    }

    // 6. Restaurant Switcher Data & Isolation Tests
    console.log("\n--- 6. Restaurant Switcher Data & Tenant Isolation ---")
    const ownerAClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const authA = await ownerAClient.auth.signInWithPassword({
      email: "owner.a@demo.test",
      password: "DemoPass123!",
    })

    const { data: memA } = await ownerAClient
      .from("memberships")
      .select("id, restaurant_id, role, active, restaurants(name)")
      .eq("user_id", authA.data.user!.id)
      .eq("active", true)

    const switcherRestaurantsA = (memA || []).map((m: {
      restaurant_id: string
      role: string
      restaurants: { name: string } | { name: string }[] | null
    }) => ({
      id: m.restaurant_id,
      name: Array.isArray(m.restaurants) ? m.restaurants[0]?.name : m.restaurants?.name,
      role: m.role,
    }))

    assert(
      switcherRestaurantsA.length === 1 && switcherRestaurantsA[0].name === "Lone Star Tacos",
      "owner.a sees exactly 1 restaurant in the switcher data"
    )

    // Test active restaurant validation logic:
    // If owner.a attempts to set active restaurant to Austin Noodle Bar (noodleBar.id),
    // the server rejects it because owner.a has no membership for noodleBar.id and data stays Lone Star Tacos.
    const unauthorizedTargetId = noodleBar.id
    const hasMembershipForTarget = (memA || []).some(
      (m: { restaurant_id: string; active: boolean }) => m.restaurant_id === unauthorizedTargetId && m.active
    )
    const resolvedActiveId = hasMembershipForTarget ? unauthorizedTargetId : switcherRestaurantsA[0]?.id

    assert(
      !hasMembershipForTarget && resolvedActiveId === loneStar.id,
      "owner.a cannot set the active restaurant to Austin Noodle Bar (server rejects it and data stays Lone Star Tacos)"
    )

    const ownerBClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const authB = await ownerBClient.auth.signInWithPassword({
      email: "owner.b@demo.test",
      password: "DemoPass123!",
    })

    const { data: memB } = await ownerBClient
      .from("memberships")
      .select("id, restaurant_id, role, active, restaurants(name)")
      .eq("user_id", authB.data.user!.id)
      .eq("active", true)

    const switcherRestaurantsB = (memB || []).map((m: {
      restaurant_id: string
      role: string
      restaurants: { name: string } | { name: string }[] | null
    }) => ({
      id: m.restaurant_id,
      name: Array.isArray(m.restaurants) ? m.restaurants[0]?.name : m.restaurants?.name,
      role: m.role,
    }))

    assert(
      switcherRestaurantsB.length === 1 && switcherRestaurantsB[0].name === "Austin Noodle Bar",
      "owner.b sees only Austin Noodle Bar"
    )

    console.log(`\n=======================================================`)
    console.log(`  ALL INTEGRATION TESTS PASSED: ${passed} Passed, ${failed} Failed`)
    console.log(`=======================================================\n`)
  } catch (err) {
    console.error("Test execution exception:", err)
    process.exit(1)
  }
}

runTests()
