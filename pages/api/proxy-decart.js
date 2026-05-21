const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10) // 1 hour
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '60', 10) // 60 requests per window

// In-memory store (per serverless instance). Not durable — use Redis for production.
const ipStore = new Map()

function getIp(req){
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
}

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'})

  const key = process.env.DECART_API_KEY
  if(!key) return res.status(500).json({error:'Missing DECART_API_KEY on server'})

  // Optional simple token check (use REQUIRE_APP_TOKEN=true and set APP_TOKEN in env to enable)
  const requireToken = process.env.REQUIRE_APP_TOKEN === 'true'
  if(requireToken){
    const provided = req.headers['x-app-token'] || ''
    if(!process.env.APP_TOKEN || provided !== process.env.APP_TOKEN){
      return res.status(401).json({error:'Unauthorized - invalid app token'})
    }
  }

  // Rate limiting by IP
  const ip = getIp(req)
  const now = Date.now()
  const entry = ipStore.get(ip) || {count:0, windowStart: now}
  if(now - entry.windowStart > RATE_LIMIT_WINDOW_MS){
    entry.count = 0
    entry.windowStart = now
  }
  entry.count += 1
  ipStore.set(ip, entry)
  if(entry.count > RATE_LIMIT_MAX){
    return res.status(429).json({error:'Rate limit exceeded'})
  }

  // Forward the request body to Decart's API.
  const decartUrl = process.env.DECART_API_URL || 'https://api.decart.ai/v1/transform'

  try{
    const decartRes = await fetch(decartUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(req.body)
    })

    const data = await decartRes.json()
    return res.status(decartRes.status).json(data)
  }catch(err){
    console.error('proxy error', err)
    return res.status(500).json({error: err.message})
  }
}
