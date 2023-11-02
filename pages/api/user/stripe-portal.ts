import { NextRequest, NextResponse } from "next/server"
import stripe from "@/lib/stripe"

import { edgeWrapper, jsonResponse } from "@/lib/api/helpers"

export const runtime = "edge"
export const dynamic = "force-dynamic"

// Redirect to Stripe customer portal
export default edgeWrapper(async function handler(req: NextRequest) {
  const { customer, origin } = await req.json()

  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: origin + "/billing",
  })

  return jsonResponse(200, { url: session.url })
})
