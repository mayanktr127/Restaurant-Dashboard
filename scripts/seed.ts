import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import bcrypt from "bcryptjs"

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
  { email: "kitchen.a@demo.test", role: "kitchen", name: "Lone Star Tablet" },
  { email: "kitchen.b@demo.test", role: "kitchen", name: "Austin Noodle Tablet" },
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

interface RestaurantRecord {
  id: string
  slug: string
  name: string
}

interface SeedCategory {
  name: string
  sort_order: number
  items: {
    name: string
    price_cents: number
    desc: string
    photo_url: string
    tags: string[]
  }[]
}

interface SeedOrderDef {
  order_number: string
  order_type: "table" | "pickup"
  table_label: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  notes: string | null
  status: "new" | "cooking" | "ready" | "collected"
  minutes_ago_created: number
  minutes_ago_started?: number
  minutes_ago_ready?: number
  items: {
    item_index: number
    qty: number
    notes?: string
  }[]
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

  // 3. Clean existing demo data cleanly
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

  // 6. Seed Memberships (Strictly 1 restaurant per human demo user)
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
    {
      user_id: userIds["kitchen.a@demo.test"],
      restaurant_id: restA.id,
      role: "kitchen",
      display_name: "Lone Star Tablet",
      email: "kitchen.a@demo.test",
      active: true,
    },
    {
      user_id: userIds["kitchen.b@demo.test"],
      restaurant_id: restB.id,
      role: "kitchen",
      display_name: "Austin Noodle Tablet",
      email: "kitchen.b@demo.test",
      active: true,
    },
  ])

  // Helper to populate tables, opening hours, categories, menu items, orders & kitchen tickets
  async function seedRestaurantDetails(
    restaurant: RestaurantRecord,
    kitchenUserId: string,
    categoriesData: SeedCategory[],
    orderDefs: SeedOrderDef[]
  ) {
    // 1. Exactly 5 tables per restaurant
    const tables = Array.from({ length: 5 }, (_, i) => ({
      restaurant_id: restaurant.id,
      label: `Table ${i + 1}`,
      sort_order: i + 1,
      active: true,
    }))
    await supabase.from("tables").insert(tables)

    // 2. Opening hours (all 7 weekdays: 0=Sunday to 6=Saturday)
    const openingHours = [
      { weekday: 0, opens_at: "11:00:00", closes_at: "21:00:00" },
      { weekday: 1, opens_at: "10:30:00", closes_at: "22:00:00" },
      { weekday: 2, opens_at: "10:30:00", closes_at: "22:00:00" },
      { weekday: 3, opens_at: "10:30:00", closes_at: "22:00:00" },
      { weekday: 4, opens_at: "10:30:00", closes_at: "22:00:00" },
      { weekday: 5, opens_at: "10:30:00", closes_at: "23:00:00" },
      { weekday: 6, opens_at: "11:00:00", closes_at: "23:00:00" },
    ].map((h) => ({
      restaurant_id: restaurant.id,
      ...h,
    }))
    await supabase.from("opening_hours").insert(openingHours)

    // 3. Billing row
    await supabase.from("billing").insert({
      restaurant_id: restaurant.id,
      plan_name: "Pro",
      amount_cents: 4900,
      status: "paid",
      next_due_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
    })

    // 4. Staff PIN and Paired Kitchen Device
    const pinHash = await bcrypt.hash("1234", 10)
    await supabase.from("staff_pins").insert({
      restaurant_id: restaurant.id,
      display_name: restaurant.slug === "lone-star-tacos" ? "Chef Marco" : "Chef Kenji",
      pin_hash: pinHash,
      active: true,
    })

    await supabase.from("kitchen_devices").insert({
      restaurant_id: restaurant.id,
      user_id: kitchenUserId,
      name: "Expediter Station (iPad Pro)",
      last_seen_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    })

    // 5. Categories and 6-8 Menu Items with prices
    const createdItems: { id: string; name: string; price_cents: number }[] = []
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

      if (!cat) continue

      for (const item of catData.items) {
        const { data: mItem } = await supabase
          .from("menu_items")
          .insert({
            restaurant_id: restaurant.id,
            category_id: cat.id,
            name: item.name,
            description: item.desc,
            price_cents: item.price_cents,
            photo_url: item.photo_url,
            available: true,
            visible: true,
            tags: item.tags,
          })
          .select()
          .single()

        if (mItem) {
          createdItems.push(mItem)
        }
      }
    }

    // 6. Sample Orders with Kitchen Tickets
    for (const oDef of orderDefs) {
      const now = Date.now()
      const createdAt = new Date(now - oDef.minutes_ago_created * 60 * 1000).toISOString()
      const startedAt = oDef.minutes_ago_started
        ? new Date(now - oDef.minutes_ago_started * 60 * 1000).toISOString()
        : null
      const readyAt = oDef.minutes_ago_ready
        ? new Date(now - oDef.minutes_ago_ready * 60 * 1000).toISOString()
        : null

      // Calculate totals from items
      let subtotalCents = 0
      const orderItemsPayload = oDef.items.map((it) => {
        const menuItem = createdItems[it.item_index % createdItems.length]
        const unitPrice = menuItem ? menuItem.price_cents : 500
        const lineTotal = unitPrice * it.qty
        subtotalCents += lineTotal

        return {
          menu_item_id: menuItem?.id,
          name: menuItem ? menuItem.name : "Menu Item",
          unit_price_cents: unitPrice,
          qty: it.qty,
          notes: it.notes || "",
        }
      })

      const taxCents = Math.round(subtotalCents * 0.0825)
      const totalCents = subtotalCents + taxCents

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurant.id,
          order_number: oDef.order_number,
          order_type: oDef.order_type,
          table_label: oDef.table_label,
          customer_name: oDef.customer_name,
          customer_email: oDef.customer_email,
          customer_phone: oDef.customer_phone,
          notes: oDef.notes,
          subtotal_cents: subtotalCents,
          tax_cents: taxCents,
          total_cents: totalCents,
          payment_mode: "counter",
          payment_status: "paid",
          status: oDef.status,
          created_at: createdAt,
          started_at: startedAt,
          ready_at: readyAt,
        })
        .select()
        .single()

      if (orderErr || !order) {
        console.error(`Failed to insert order ${oDef.order_number}:`, orderErr)
        continue
      }

      // Insert order items
      await supabase.from("order_items").insert(
        orderItemsPayload.map((oi) => ({
          order_id: order.id,
          restaurant_id: restaurant.id,
          menu_item_id: oi.menu_item_id,
          name: oi.name,
          unit_price_cents: oi.unit_price_cents,
          qty: oi.qty,
          notes: oi.notes,
        }))
      )

      // Ensure kitchen_tickets has matching ticket with timestamps
      const customerFirstName = oDef.customer_name.split(" ")[0] || "Customer"
      const ticketItems = orderItemsPayload.map((oi) => ({
        name: oi.name,
        qty: oi.qty,
        notes: oi.notes || undefined,
      }))

      await supabase.from("kitchen_tickets").upsert(
        {
          order_id: order.id,
          restaurant_id: restaurant.id,
          order_number: oDef.order_number,
          order_type: oDef.order_type,
          table_label: oDef.table_label,
          customer_first_name: customerFirstName,
          notes: oDef.notes,
          items: ticketItems,
          status: oDef.status,
          created_at: createdAt,
          started_at: startedAt,
          ready_at: readyAt,
        },
        { onConflict: "order_id" }
      )
    }
  }

  // 7. Seed Lone Star Tacos: 3 categories, 8 items, 5 tables, 7 opening hours, 3 sample orders
  console.log("Populating Lone Star Tacos demo data...")
  await seedRestaurantDetails(
    restA,
    userIds["kitchen.a@demo.test"],
    [
      {
        name: "Signature Tacos",
        sort_order: 1,
        items: [
          {
            name: "Smoked Brisket Taco",
            price_cents: 450,
            desc: "14-hour Texas oak smoked prime brisket, pickled red onion, salsa verde",
            photo_url: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&auto=format&fit=crop&q=80",
            tags: ["gluten-free", "popular"],
          },
          {
            name: "Baja Crispy Fish Taco",
            price_cents: 500,
            desc: "Beer-battered cod, chipotle crema, shredded purple cabbage, fresh lime",
            photo_url: "https://images.unsplash.com/photo-1512838243191-e81e88cc8f54?w=600&auto=format&fit=crop&q=80",
            tags: ["popular"],
          },
          {
            name: "Slow-Roasted Carnitas Taco",
            price_cents: 450,
            desc: "Citrus-braised pork shoulder, diced white onion, charred salsa, fresh cilantro",
            photo_url: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80",
            tags: ["gluten-free"],
          },
          {
            name: "Charred Avocado & Black Bean Taco",
            price_cents: 400,
            desc: "Grilled Hass avocado, seasoned black beans, pico de gallo, lime cilantro",
            photo_url: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80",
            tags: ["vegan", "vegetarian", "gluten-free"],
          },
        ],
      },
      {
        name: "Starters & Dips",
        sort_order: 2,
        items: [
          {
            name: "Chips & Hand-Crushed Guacamole",
            price_cents: 550,
            desc: "Fresh corn tortilla chips with smashed avocado, serrano peppers, lime",
            photo_url: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=600&auto=format&fit=crop&q=80",
            tags: ["vegan", "gluten-free"],
          },
          {
            name: "Warm Queso Blanco Dip",
            price_cents: 550,
            desc: "Melted cheese dip with green chiles, roasted poblanos, warm chips",
            photo_url: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=600&auto=format&fit=crop&q=80",
            tags: ["popular"],
          },
        ],
      },
      {
        name: "Sides & Drinks",
        sort_order: 3,
        items: [
          {
            name: "House-Made Cinnamon Horchata",
            price_cents: 400,
            desc: "Traditional rice milk drink, Ceylon cinnamon, piloncillo sugar",
            photo_url: "https://images.unsplash.com/photo-1546173159-315724a31696?w=600&auto=format&fit=crop&q=80",
            tags: ["vegetarian"],
          },
          {
            name: "Mexican Coca-Cola",
            price_cents: 300,
            desc: "Classic glass bottle sweetened with pure cane sugar",
            photo_url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80",
            tags: [],
          },
        ],
      },
    ],
    [
      {
        order_number: "ORD-01",
        order_type: "table",
        table_label: "Table 1",
        customer_name: "Carlos Rivera",
        customer_email: "carlos@example.com",
        customer_phone: "+1 (512) 555-0191",
        notes: "ALLERGY: No cilantro on tacos",
        status: "new",
        minutes_ago_created: 4,
        items: [
          { item_index: 0, qty: 2, notes: "Corn tortilla" },
          { item_index: 4, qty: 1 },
          { item_index: 6, qty: 2 },
        ],
      },
      {
        order_number: "ORD-02",
        order_type: "table",
        table_label: "Table 3",
        customer_name: "Sarah Jenkins",
        customer_email: "sarah.j@example.com",
        customer_phone: "+1 (512) 555-0192",
        notes: "Extra spicy house salsa on the side",
        status: "cooking",
        minutes_ago_created: 12,
        minutes_ago_started: 6,
        items: [
          { item_index: 1, qty: 3, notes: "Extra chipotle slaw" },
          { item_index: 5, qty: 1 },
        ],
      },
      {
        order_number: "ORD-03",
        order_type: "pickup",
        table_label: null,
        customer_name: "David Kim",
        customer_email: "david.k@example.com",
        customer_phone: "+1 (512) 555-0193",
        notes: "Please include extra napkins and utensils",
        status: "ready",
        minutes_ago_created: 18,
        minutes_ago_started: 11,
        minutes_ago_ready: 2,
        items: [
          { item_index: 2, qty: 4 },
          { item_index: 7, qty: 2 },
        ],
      },
    ]
  )

  // 8. Seed Austin Noodle Bar: 3 categories, 8 items, 5 tables, 7 opening hours, 3 sample orders
  console.log("Populating Austin Noodle Bar demo data...")
  await seedRestaurantDetails(
    restB,
    userIds["kitchen.b@demo.test"],
    [
      {
        name: "Ramen & Noodles",
        sort_order: 1,
        items: [
          {
            name: "Tonkotsu Rich Garlic Ramen",
            price_cents: 1450,
            desc: "20-hour pork bone broth, braised chashu pork, nitamago egg, black garlic oil",
            photo_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80",
            tags: ["popular"],
          },
          {
            name: "Spicy Dan Dan Noodles",
            price_cents: 1350,
            desc: "Sichuan chili broth, seasoned minced pork, tender bok choy, scallions",
            photo_url: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&auto=format&fit=crop&q=80",
            tags: ["spicy"],
          },
          {
            name: "Tokyo Shoyu Classic Ramen",
            price_cents: 1250,
            desc: "Clear soy dashi broth, bamboo shoots, chashu pork, nori seaweed",
            photo_url: "https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=600&auto=format&fit=crop&q=80",
            tags: ["classic"],
          },
          {
            name: "Wild Mushroom Veggie Ramen",
            price_cents: 1250,
            desc: "Rich shiitake kombu vegetable broth, grilled organic tofu, wood ear mushrooms",
            photo_url: "https://images.unsplash.com/photo-1547928576-b6cf1b0451a9?w=600&auto=format&fit=crop&q=80",
            tags: ["vegan", "vegetarian"],
          },
        ],
      },
      {
        name: "Small Plates",
        sort_order: 2,
        items: [
          {
            name: "Pan-Seared Pork Gyoza",
            price_cents: 750,
            desc: "Handcrafted Japanese dumplings with scallion ponzu dipping sauce",
            photo_url: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&auto=format&fit=crop&q=80",
            tags: ["popular"],
          },
          {
            name: "Steamed Garlic Edamame",
            price_cents: 500,
            desc: "Tender young soybeans with Maldon sea salt and roasted garlic oil",
            photo_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
            tags: ["vegan", "gluten-free"],
          },
        ],
      },
      {
        name: "Beverages",
        sort_order: 3,
        items: [
          {
            name: "Cold Brew Iced Matcha",
            price_cents: 450,
            desc: "Organic ceremonial Uji green tea over slow-melted ice",
            photo_url: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80",
            tags: ["vegan"],
          },
          {
            name: "Japanese Ramune Lychee",
            price_cents: 350,
            desc: "Refreshing fizzy marble bottle soda with natural lychee flavor",
            photo_url: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=600&auto=format&fit=crop&q=80",
            tags: [],
          },
        ],
      },
    ],
    [
      {
        order_number: "ORD-01",
        order_type: "table",
        table_label: "Table 2",
        customer_name: "Elena Rostova",
        customer_email: "elena@example.com",
        customer_phone: "+1 (512) 555-0291",
        notes: "Medium spice on noodles",
        status: "new",
        minutes_ago_created: 5,
        items: [
          { item_index: 0, qty: 1, notes: "Extra nitamago egg" },
          { item_index: 4, qty: 1 },
          { item_index: 6, qty: 1 },
        ],
      },
      {
        order_number: "ORD-02",
        order_type: "table",
        table_label: "Table 4",
        customer_name: "Marcus Lee",
        customer_email: "marcus@example.com",
        customer_phone: "+1 (512) 555-0292",
        notes: "Vegetarian order - please use clean tongs",
        status: "cooking",
        minutes_ago_created: 14,
        minutes_ago_started: 7,
        items: [
          { item_index: 3, qty: 2 },
          { item_index: 5, qty: 1 },
        ],
      },
      {
        order_number: "ORD-03",
        order_type: "pickup",
        table_label: null,
        customer_name: "Rachel Green",
        customer_email: "rachel@example.com",
        customer_phone: "+1 (512) 555-0293",
        notes: "Pickup order - call when outside",
        status: "ready",
        minutes_ago_created: 22,
        minutes_ago_started: 15,
        minutes_ago_ready: 3,
        items: [
          { item_index: 1, qty: 2 },
          { item_index: 7, qty: 2 },
        ],
      },
    ]
  )

  // 9. Seed security activity log samples
  console.log("Seeding security activity log entries...")
  const securityEvents = [
    { action: "invite_created", actor_type: "owner", actor_name: "Alice Owner", details: { email: "manager.invite@demo.test", role: "manager" } },
    { action: "invite_accepted", actor_type: "manager", actor_name: "Bob Manager", details: { email: "manager.a@demo.test" } },
    { action: "pairing_code_created", actor_type: "owner", actor_name: "Alice Owner", details: { code: "123456" } },
    { action: "device_paired", actor_type: "kitchen", actor_name: "Kitchen Tablet 1", details: { device_name: "Expediter Station (iPad Pro)" } },
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
