import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// Load .env.local if present
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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes("placeholder")) {
  console.error("Error: Please set valid NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before running seed.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const DEMO_USERS = [
  { email: "admin@demo.test", role: "admin", name: "System Admin" },
  { email: "owner.a@demo.test", role: "owner", name: "Alice Owner" },
  { email: "manager.a@demo.test", role: "manager", name: "Bob Manager" },
  { email: "owner.b@demo.test", role: "owner", name: "Charlie Owner" },
]
const PASSWORD = "DemoPass123!"

async function getOrCreateUser(email: string) {
  const { data: listData } = await supabase.auth.admin.listUsers()
  const existing = listData?.users.find((u) => u.email === email)
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    })
    return existing.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })

  if (error || !data.user) {
    throw new Error(`Failed to create user ${email}: ${error?.message}`)
  }
  return data.user.id
}

async function seed() {
  console.log("🌱 Starting database seed...")

  // 1. Create or get test users
  console.log("Creating/updating test users...")
  const userIds: Record<string, string> = {}
  for (const u of DEMO_USERS) {
    userIds[u.email] = await getOrCreateUser(u.email)
    console.log(`  ✓ ${u.email} (${userIds[u.email]})`)
  }

  // 2. Set admin in platform_admins
  await supabase.from("platform_admins").upsert({
    user_id: userIds["admin@demo.test"],
  })
  console.log("  ✓ admin@demo.test set in platform_admins")

  // 3. Clean existing demo restaurants and memberships to be safe to re-run
  console.log("Cleaning previous demo data...")
  const allUserIds = Object.values(userIds)
  if (allUserIds.length > 0) {
    await supabase.from("memberships").delete().in("user_id", allUserIds)
  }
  await supabase.from("memberships").delete().in("email", DEMO_USERS.map((u) => u.email))
  await supabase.from("restaurants").delete().in("slug", ["lone-star-tacos", "austin-noodle-bar"])

  // 4. Create Restaurant A: Lone Star Tacos
  console.log("Seeding Restaurant A: Lone Star Tacos...")
  const { data: restA, error: errA } = await supabase
    .from("restaurants")
    .insert({
      name: "Lone Star Tacos",
      slug: "lone-star-tacos",
      status: "active",
      brand_color: "#166534",
      address: "101 Congress Ave, Austin, TX",
      phone: "+1 512-555-0101",
      website: "https://lonestartacos.demo",
      timezone: "America/Chicago",
      tax_rate: 8.25,
      prep_minutes: 15,
      is_open: true,
      pay_mode: "counter",
      table_contact: "none",
      pickup_contact: "email_or_phone",
      kitchen_can_soldout: true,
      manager_can_edit_menu: true,
    })
    .select()
    .single()

  if (errA || !restA) throw new Error(`Failed to create Restaurant A: ${errA?.message}`)

  // 5. Create Restaurant B: Austin Noodle Bar
  console.log("Seeding Restaurant B: Austin Noodle Bar...")
  const { data: restB, error: errB } = await supabase
    .from("restaurants")
    .insert({
      name: "Austin Noodle Bar",
      slug: "austin-noodle-bar",
      status: "active",
      brand_color: "#dc2626",
      address: "204 S Lamar Blvd, Austin, TX",
      phone: "+1 512-555-0202",
      website: "https://austinnoodlebar.demo",
      timezone: "America/Chicago",
      tax_rate: 8.25,
      prep_minutes: 20,
      is_open: true,
      pay_mode: "counter",
      table_contact: "optional",
      pickup_contact: "email_or_phone",
      kitchen_can_soldout: true,
      manager_can_edit_menu: false,
    })
    .select()
    .single()

  if (errB || !restB) throw new Error(`Failed to create Restaurant B: ${errB?.message}`)

  // 6. Memberships
  console.log("Seeding memberships...")
  await supabase.from("memberships").insert([
    {
      user_id: userIds["owner.a@demo.test"],
      restaurant_id: restA.id,
      role: "owner",
      display_name: "Alice Owner",
      email: "owner.a@demo.test",
      active: true,
    },
    {
      user_id: userIds["manager.a@demo.test"],
      restaurant_id: restA.id,
      role: "manager",
      display_name: "Bob Manager",
      email: "manager.a@demo.test",
      active: true,
    },
    {
      user_id: userIds["owner.b@demo.test"],
      restaurant_id: restB.id,
      role: "owner",
      display_name: "Charlie Owner",
      email: "owner.b@demo.test",
      active: true,
    },
  ])

  interface RestaurantRecord {
    id: string
    slug: string
    name: string
  }

  interface CreatedMenuItem {
    id: string
    name: string
    price_cents: number
  }

  // 7. Seed Data Helper for each restaurant
  async function seedRestaurantDetails(
    restaurant: RestaurantRecord,
    categoriesData: { name: string; sort_order: number; items: { name: string; price_cents: number; desc: string; tags: string[] }[] }[]
  ) {
    // Tables 1-10
    const tables = Array.from({ length: 10 }, (_, i) => ({
      restaurant_id: restaurant.id,
      label: `Table ${i + 1}`,
      sort_order: i + 1,
      active: true,
    }))
    await supabase.from("tables").insert(tables)

    // Billing
    await supabase.from("billing").insert({
      restaurant_id: restaurant.id,
      plan_name: "Pro",
      amount_cents: 4900,
      status: "paid",
      next_due_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
    })

    // Categories & Menu Items
    const createdMenuItems: CreatedMenuItem[] = []
    for (const catData of categoriesData) {
      const { data: cat } = await supabase
        .from("categories")
        .insert({
          restaurant_id: restaurant.id,
          name: catData.name,
          sort_order: catData.sort_order,
          visible: true,
        })
        .select()
        .single()

      for (const item of catData.items) {
        const { data: mItem } = await supabase
          .from("menu_items")
          .insert({
            restaurant_id: restaurant.id,
            category_id: cat.id,
            name: item.name,
            description: item.desc,
            price_cents: item.price_cents,
            available: true,
            visible: true,
            tags: item.tags,
          })
          .select()
          .single()
        createdMenuItems.push(mItem)
      }
    }

    // 6 Orders in various statuses
    const orderDefinitions = [
      { status: "new", type: "table", table: "Table 1", customer: "John Doe", email: "john@example.com", phone: "555-0111", notes: "Extra spicy" },
      { status: "cooking", type: "table", table: "Table 2", customer: "Sarah Smith", email: "sarah@example.com", phone: "555-0122", notes: "" },
      { status: "ready", type: "pickup", table: null, customer: "Mike Johnson", email: "mike@example.com", phone: "555-0133", notes: "Utensils please" },
      { status: "collected", type: "table", table: "Table 3", customer: "Emily Davis", email: "emily@example.com", phone: "555-0144", notes: "" },
      { status: "problem", type: "table", table: "Table 4", customer: "David Brown", email: "david@example.com", phone: "555-0155", notes: "Gluten free note", problem_reason: "Kitchen ingredient shortage" },
      { status: "pending_payment", type: "pickup", table: null, customer: "Lisa Taylor", email: "lisa@example.com", phone: "555-0166", notes: "" },
    ]

    for (let i = 0; i < orderDefinitions.length; i++) {
      const def = orderDefinitions[i]
      const item1 = createdMenuItems[i % createdMenuItems.length]
      const item2 = createdMenuItems[(i + 1) % createdMenuItems.length]
      const subtotal = item1.price_cents + item2.price_cents
      const tax = Math.round(subtotal * 0.0825)
      const total = subtotal + tax

      const { data: order } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurant.id,
          order_number: `ORD${i + 1}${restaurant.slug.slice(0, 2).toUpperCase()}`,
          order_type: def.type,
          table_label: def.table,
          customer_name: def.customer,
          customer_email: def.email,
          customer_phone: def.phone,
          notes: def.notes,
          subtotal_cents: subtotal,
          tax_cents: tax,
          total_cents: total,
          payment_mode: "counter",
          payment_status: def.status === "pending_payment" ? "pending" : "paid",
          status: def.status,
          problem_reason: def.problem_reason || null,
        })
        .select()
        .single()

      if (order) {
        await supabase.from("order_items").insert([
          {
            order_id: order.id,
            restaurant_id: restaurant.id,
            menu_item_id: item1.id,
            name: item1.name,
            unit_price_cents: item1.price_cents,
            qty: 1,
            notes: "",
          },
          {
            order_id: order.id,
            restaurant_id: restaurant.id,
            menu_item_id: item2.id,
            name: item2.name,
            unit_price_cents: item2.price_cents,
            qty: 1,
            notes: "",
          },
        ])
      }
    }
  }

  // Seed Lone Star Tacos
  await seedRestaurantDetails(restA, [
    {
      name: "Tacos",
      sort_order: 1,
      items: [
        { name: "Smoked Brisket Taco", price_cents: 550, desc: "Texas smoked brisket with house salsa", tags: ["beef", "popular"] },
        { name: "Crispy Carnitas Taco", price_cents: 450, desc: "Slow cooked pork with pickled onion", tags: ["pork"] },
        { name: "Baja Fish Taco", price_cents: 500, desc: "Beer battered cod with chipotle slaw", tags: ["fish"] },
        { name: "Charred Avocado Taco", price_cents: 400, desc: "Vegetarian taco with roasted corn", tags: ["vegan"] },
      ],
    },
    {
      name: "Sides",
      sort_order: 2,
      items: [
        { name: "Chips & Fresh Guac", price_cents: 650, desc: "Hand-smashed avocado with sea salt chips", tags: ["vegetarian"] },
        { name: "Warm Queso Dip", price_cents: 550, desc: "Melted cheese dip with green chiles", tags: ["popular"] },
      ],
    },
    {
      name: "Drinks",
      sort_order: 3,
      items: [
        { name: "House Horchata", price_cents: 350, desc: "Cinnamon rice milk beverage", tags: ["sweet"] },
        { name: "Mexican Coke", price_cents: 300, desc: "Made with pure cane sugar", tags: ["soda"] },
      ],
    },
  ])

  // Seed Austin Noodle Bar
  await seedRestaurantDetails(restB, [
    {
      name: "Noodles & Ramen",
      sort_order: 1,
      items: [
        { name: "Tonkotsu Rich Ramen", price_cents: 1450, desc: "Pork bone broth, chashu pork, nitamago egg", tags: ["pork", "popular"] },
        { name: "Spicy Dan Dan Noodles", price_cents: 1350, desc: "Sichuan chili broth, minced pork, bok choy", tags: ["spicy"] },
        { name: "Tokyo Shoyu Ramen", price_cents: 1250, desc: "Soy dashi broth, bamboo shoots, scallions", tags: ["classic"] },
        { name: "Mushroom Veggie Ramen", price_cents: 1250, desc: "Shiitake kombu broth with grilled tofu", tags: ["vegan"] },
      ],
    },
    {
      name: "Appetizers",
      sort_order: 2,
      items: [
        { name: "Pan-Fried Gyoza", price_cents: 750, desc: "Crispy pork and garlic chive dumplings", tags: ["popular"] },
        { name: "Edamame with Sea Salt", price_cents: 500, desc: "Steamed soybeans with maldon salt", tags: ["vegan"] },
      ],
    },
    {
      name: "Beverages",
      sort_order: 3,
      items: [
        { name: "Cold Brew Matcha", price_cents: 450, desc: "Ceremonial grade unsweetened matcha", tags: ["tea"] },
        { name: "Ramune Lychee Soda", price_cents: 350, desc: "Japanese marble bottle soda", tags: ["soda"] },
      ],
    },
  ])

  // Seed security activity log samples
  console.log("Seeding security activity log entries...")
  const securityEvents = [
    { action: "invite_created", actor_type: "owner", actor_name: "Alice Owner", details: { email: "manager.invite@demo.test", role: "manager" } },
    { action: "invite_accepted", actor_type: "manager", actor_name: "Bob Manager", details: { email: "manager.a@demo.test" } },
    { action: "pairing_code_created", actor_type: "owner", actor_name: "Alice Owner", details: { code: "123456" } },
    { action: "device_paired", actor_type: "kitchen", actor_name: "Kitchen Tablet 1", details: { device_name: "Expediter Display" } },
    { action: "device_revoked", actor_type: "owner", actor_name: "Alice Owner", details: { device_id: "demo-revoked-device" } },
    { action: "pin_added", actor_type: "owner", actor_name: "Alice Owner", details: { staff_name: "Chef Marco" } },
    { action: "pin_removed", actor_type: "owner", actor_name: "Alice Owner", details: { staff_name: "Former Staff" } },
  ]

  for (const evt of securityEvents) {
    await supabase.from("activity_log").insert({
      restaurant_id: restA.id,
      actor_type: evt.actor_type,
      actor_name: evt.actor_name,
      action: evt.action,
      details: evt.details,
    })
  }

  console.log("✅ Seed completed successfully!")
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})

