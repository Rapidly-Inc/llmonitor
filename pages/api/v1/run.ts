import { Ratelimit } from "@upstash/ratelimit"
import { NextApiRequest, NextApiResponse } from "next"
import { kv } from "@vercel/kv"
import postgres from "postgres"
import { ensureHasAccessToApp } from "../../../lib/api/ensureAppIsLogged"

const sql = postgres(process.env.DB_URI, { transform: postgres.camel })

const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(30, "1s"),
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    await ensureHasAccessToApp(req, res)

    const apiKey = (req.query.api_key ||
      req.headers["x-api-key"] ||
      req.cookies.api_key) as string

    const { success } = await ratelimit.limit(apiKey)

    if (!success) {
      console.error("Rate limit exceeded")
      return res.status(429).send("Rate limit exceeded")
    }

    const appId = req.query.app_id
    const { search, models, tags, type } = req.query
    const limit = parseInt(req.query.limit as string) || 1000
    const page = parseInt(req.query.page as string) || 0
    const order = req.query.order === "asc" ? sql`asc` : sql`desc`
    const minDuration = parseFloat(req.query.min_duration as string)
    const maxDuration = parseFloat(req.query.max_duration as string)

    const startTime = req.query.start_time as string
    const endTime = req.query.end_time as string

    if (!startTime || !endTime) {
      console.error("Missing startTime or endTime")
      return res.status(422).send("Missing startTime or endTime")
    }

    const startDate = new Date(startTime)
    const endDate = new Date(endTime)
    if (startDate >= endDate) {
      console.error("Invalid time window")
      return res.status(422).send("Invalid time window")
    }
    const timeWindowFilter = sql`and r.created_at between ${startDate} and ${endDate}`

    if (!appId) {
      console.error("Missing appId")
      return res.status(422).send("Missing appId")
    }

    const [org] = await sql`select * from org where api_key = ${apiKey}`
    const [app] = await sql`select * from app where id = ${appId}`

    if (org.id !== app.orgId || org.plan === "free") {
      console.error("Forbidden")
      return res
        .status(403)
        .send(
          "Forbidden. Please make sure you are using the correct API key and app ID, and that you are on a paid plan.",
        )
    }

    let typeFilter = sql``
    if (type) {
      typeFilter = sql`and r.type = ${type}`
    }

    let searchFilter = sql``
    if (search) {
      searchFilter = sql`and (
        r.input::text ilike ${"%" + search + "%"}
        or r.output::text ilike ${"%" + search + "%"}
        or r.error::text ilike ${"%" + search + "%"}
      )`
    }

    let modelsFilter = sql``
    if (models?.length > 0) {
      modelsFilter = sql`and r.name =  any(${models})`
    }

    let tagsFilter = sql``
    if (tags?.length > 0) {
      tagsFilter = sql`and r.tags && ${tags}`
    }

    let durationFilter = sql``
    if (minDuration && maxDuration) {
      durationFilter = sql`and extract(epoch from (r.ended_at - r.created_at)) between ${minDuration} and ${maxDuration}`
    } else if (minDuration) {
      durationFilter = sql`and extract(epoch from (r.ended_at - r.created_at)) >= ${minDuration}`
    } else if (maxDuration) {
      durationFilter = sql`and extract(epoch from (r.ended_at - r.created_at)) <= ${maxDuration}`
    }

    const rows = await sql`
      select
        r.created_at as time,
        r.name as model,
        case 
          when r.ended_at is not null then extract(epoch from (r.ended_at - r.created_at)) 
          else null 
        end as duration,
        coalesce(completion_tokens, 0) + coalesce(prompt_tokens, 0) as tokens,
        tags as tags,
        input as prompt,
        coalesce(output, error) as result
      from
        run r 
      where
        r.app = ${appId}
        ${typeFilter}
        ${modelsFilter}
        ${tagsFilter}
        ${searchFilter}
        ${durationFilter}
        ${timeWindowFilter}
      order by
        r.created_at ${order} 
      limit ${limit} 
      offset ${page * limit};`

    const [{ count }] = await sql`
      select count(*) from run r
      where
        r.app = ${appId}
        and r.type = 'llm'
        ${modelsFilter}
        ${tagsFilter}
        ${searchFilter}
        ${durationFilter}
        ${timeWindowFilter}
    `

    return res.status(200).json({ data: rows, total: count, page, limit })
  } catch (error) {
    console.error(error)
    return res.status(500).send("Error")
  }
}