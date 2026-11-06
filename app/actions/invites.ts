"use server"

import crypto from "crypto"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole, getUserContext, logActivity } from "@/lib/auth"

export interface InviteResult {
  success: boolean
  inviteLink?: string
  expiresAt?: string
  error?: string
}

/**
 * Creates an invite token valid for 7 days (Owner or Admin only).
 */
export async function createInvite(
  restaurantId: string,
  email: string,
  role: "owner" | "manager" | "kitchen"
): Promise<InviteResult> {
  try {
    const { context } = await requireRole(restaurantId, ["owner"])
    const admin = createAdminClient()

    // 1. Generate 24-byte cryptographically secure token
    const rawToken = crypto.randomBytes(24).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // 2. Store in invites table
    const { error: insertErr } = await admin.from("invites").insert({
      restaurant_id: restaurantId,
      email: email.trim().toLowerCase(),
      role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: context.user.id,
    })

    if (insertErr) {
      throw new Error(`Failed to store invite: ${insertErr.message}`)
    }

    // 3. Security Activity Log
    await logActivity(
      restaurantId,
      context.isAdmin ? "admin" : "owner",
      context.user.email || "Owner",
      "invite_created",
      { email, role, expiresAt }
    )

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const inviteLink = `${siteUrl}/invite/${rawToken}`

    return {
      success: true,
      inviteLink,
      expiresAt,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create invite",
    }
  }
}

/**
 * Validates an invite token and assigns membership to the active user.
 */
export async function acceptInvite(rawToken: string): Promise<{
  success: boolean
  error?: string
  redirectUrl?: string
  requiresAuth?: boolean
  email?: string
  role?: string
}> {
  try {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    const admin = createAdminClient()

    // 1. Validate invite token
    const { data: invite, error: fetchErr } = await admin
      .from("invites")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()

    if (fetchErr || !invite) {
      return {
        success: false,
        error: "This invitation link is invalid, already used, or has expired.",
      }
    }

    // 2. Check current user
    const context = await getUserContext()
    if (!context) {
      return {
        success: false,
        requiresAuth: true,
        email: invite.email,
        role: invite.role,
      }
    }

    // 3. Create or activate membership
    const { error: memberErr } = await admin.from("memberships").upsert(
      {
        user_id: context.user.id,
        restaurant_id: invite.restaurant_id,
        role: invite.role,
        email: context.user.email,
        display_name: context.user.user_metadata?.full_name || context.user.email?.split("@")[0],
        active: true,
      },
      { onConflict: "user_id,restaurant_id" }
    )

    if (memberErr) {
      throw new Error(`Failed to activate membership: ${memberErr.message}`)
    }

    // 4. Mark invite accepted
    await admin
      .from("invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id)

    // 5. Store selected restaurant cookie
    const cookieStore = await cookies()
    cookieStore.set("selected_restaurant_id", invite.restaurant_id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    })

    // 6. Security Log
    await logActivity(
      invite.restaurant_id,
      invite.role as "owner" | "manager" | "kitchen",
      context.user.email || "Member",
      "invite_accepted",
      { user_id: context.user.id, role: invite.role }
    )

    return {
      success: true,
      redirectUrl: "/app",
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to accept invite",
    }
  }
}

