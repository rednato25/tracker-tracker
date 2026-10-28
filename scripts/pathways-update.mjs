// scripts/pathways-update.mjs
//
// Vendor trackerpathways at a pinned commit. Rendering never fetches this data.
// Run: pnpm pathways:update [commit]

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DATA_PATH = resolve(ROOT, "src/data/pathways/trackers.json")
const META_PATH = resolve(ROOT, "src/data/pathways/metadata.json")
const REPO = "handokota/trackerpathways"

function assertRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
}

export function validatePathwaysData(data) {
  assertRecord(data, "trackerpathways dataset")
  assertRecord(data.trackerInfo, "trackerInfo")
  assertRecord(data.unlockInviteClass, "unlockInviteClass")
  assertRecord(data.routeInfo, "routeInfo")

  for (const [destination, sources] of Object.entries(data.routeInfo)) {
    if (!destination.trim()) throw new Error("routeInfo has an empty destination")
    assertRecord(sources, `routeInfo.${destination}`)
    for (const [source, route] of Object.entries(sources)) {
      if (!source.trim()) throw new Error(`routeInfo.${destination} has an empty source`)
      assertRecord(route, `routeInfo.${destination}.${source}`)
      if (
        route.days !== null &&
        (!Number.isSafeInteger(route.days) || route.days < 0)
      ) {
        throw new Error(`routeInfo.${destination}.${source}.days must be a non-negative integer or null`)
      }
      if (typeof route.reqs !== "string") {
        throw new Error(`routeInfo.${destination}.${source}.reqs must be text`)
      }
      if (typeof route.active !== "string") {
        throw new Error(`routeInfo.${destination}.${source}.active must be text`)
      }
      if (typeof route.updated !== "string") {
        throw new Error(`routeInfo.${destination}.${source}.updated must be text`)
      }
    }
  }

  for (const [tracker, gate] of Object.entries(data.unlockInviteClass)) {
    if (!Array.isArray(gate) || gate.length !== 2) {
      throw new Error(`unlockInviteClass.${tracker} must be [days, text]`)
    }
    if (gate[0] !== null && (!Number.isSafeInteger(gate[0]) || gate[0] < 0)) {
      throw new Error(`unlockInviteClass.${tracker} days must be a non-negative integer or null`)
    }
    if (typeof gate[1] !== "string") {
      throw new Error(`unlockInviteClass.${tracker} text must be a string`)
    }
  }

  return data
}

function trackerNames(data) {
  const names = new Set(Object.keys(data.trackerInfo))
  for (const [destination, sources] of Object.entries(data.routeInfo)) {
    names.add(destination)
    for (const source of Object.keys(sources)) names.add(source)
  }
  return names
}

function routePairs(data) {
  const pairs = new Set()
  for (const [destination, sources] of Object.entries(data.routeInfo)) {
    for (const source of Object.keys(sources)) pairs.add(`${source} -> ${destination}`)
  }
  return pairs
}

function difference(current, next) {
  return [...next].filter((value) => !current.has(value))
}

async function resolveCommit(ref = "main") {
  if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase()
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${encodeURIComponent(ref)}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "tracker-tracker-pathways-update" },
  })
  if (!res.ok) throw new Error(`Could not resolve ${ref} (HTTP ${res.status})`)
  const body = await res.json()
  if (typeof body.sha !== "string" || !/^[0-9a-f]{40}$/i.test(body.sha)) {
    throw new Error(`Upstream ${ref} response has no commit sha`)
  }
  return body.sha.toLowerCase()
}

async function main() {
  const commit = await resolveCommit(process.argv[2] ?? "main")
  const url = `https://raw.githubusercontent.com/${REPO}/${commit}/src/data/trackers.json`
  const res = await fetch(url, { headers: { "User-Agent": "tracker-tracker-pathways-update" } })
  if (!res.ok) throw new Error(`Could not fetch ${url} (HTTP ${res.status})`)
  const raw = Buffer.from(await res.arrayBuffer())
  const data = validatePathwaysData(JSON.parse(raw.toString("utf8")))

  let previous = null
  try {
    previous = validatePathwaysData(JSON.parse(await readFile(DATA_PATH, "utf8")))
  } catch {
    previous = null
  }

  const oldTrackers = previous ? trackerNames(previous) : new Set()
  const oldRoutes = previous ? routePairs(previous) : new Set()
  const trackers = trackerNames(data)
  const routes = routePairs(data)

  await mkdir(dirname(DATA_PATH), { recursive: true })
  await writeFile(DATA_PATH, raw)
  await writeFile(
    META_PATH,
    `${JSON.stringify(
      {
        source: "trackerpathways",
        repo: `https://github.com/${REPO}`,
        commit,
        fetchedAt: new Date().toISOString(),
        license: "MIT",
        copyright: "Copyright (c) 2025 Handoko Tejo Atmoko",
        sourceFile: "src/data/trackers.json",
        licenseUrl: `https://github.com/${REPO}/blob/${commit}/LICENSE`,
        attribution: "Route data derived from trackerpathways (MIT), vendored unchanged from the pinned commit.",
      },
      null,
      2
    )}\n`
  )

  console.log(`Vendored ${REPO}@${commit}`)
  console.log(`Trackers: +${difference(oldTrackers, trackers).length} / -${difference(trackers, oldTrackers).length}`)
  for (const name of difference(oldTrackers, trackers)) console.log(`  + ${name}`)
  for (const name of difference(trackers, oldTrackers)) console.log(`  - ${name}`)
  console.log(`Routes: +${difference(oldRoutes, routes).length} / -${difference(routes, oldRoutes).length}`)
  for (const pair of difference(oldRoutes, routes)) console.log(`  + ${pair}`)
  for (const pair of difference(routes, oldRoutes)) console.log(`  - ${pair}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === "--validate-file") {
    const file = process.argv[3]
    if (!file) {
      console.error("--validate-file needs a path")
      process.exitCode = 1
    } else {
      readFile(file, "utf8")
        .then((body) => {
          validatePathwaysData(JSON.parse(body))
          console.log(`Valid trackerpathways shape: ${file}`)
        })
        .catch((err) => {
          console.error(err instanceof Error ? err.message : err)
          process.exitCode = 1
        })
    }
  } else {
    main().catch((err) => {
      console.error(err instanceof Error ? err.message : err)
      process.exitCode = 1
    })
  }
}
