// Sam's film credits from TMDB. One home for the key and the fetch, shared by
// /api/tmdb and the homepage (which now renders the credits on the server, so the
// strip needs no client JavaScript). The key was already in source; it moved here
// unchanged.

export const TMDB_API_KEY = "9850560d16d31508eb0478db334923cb"
export const TMDB_PERSON_ID = "2283538"
const BASE_URL = "https://api.themoviedb.org/3/person/"

export interface TmdbBundle {
  person: any
  movie_credits: any
  tv_credits: any
}

async function fetchJson(url: string, revalidate?: number) {
  const response = await fetch(url, revalidate ? { next: { revalidate } } : undefined)
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
  return response.json()
}

export async function fetchTmdbBundle(revalidate?: number): Promise<TmdbBundle> {
  const q = `api_key=${TMDB_API_KEY}`
  const [person, movie_credits, tv_credits] = await Promise.all([
    fetchJson(`${BASE_URL}${TMDB_PERSON_ID}?${q}`, revalidate),
    fetchJson(`${BASE_URL}${TMDB_PERSON_ID}/movie_credits?${q}`, revalidate),
    fetchJson(`${BASE_URL}${TMDB_PERSON_ID}/tv_credits?${q}`, revalidate),
  ])
  return { person, movie_credits, tv_credits }
}

export interface Credit {
  key: string
  title: string
  year?: string
  poster?: string
  jobs: string[]
  href: string
}

// Same order the old homepage used: the most senior job first, then newest.
const JOB_RANK: Record<string, number> = {
  Director: 1,
  Producer: 2,
  "Executive Producer": 2,
  "Co-Producer": 2,
  "Associate Producer": 2,
  "Unit Production Manager": 3,
  "Production Supervisor": 4,
  "Production Accountant": 5,
  "Production Coordinator": 8,
  "Production Assistant": 12,
}

function rank(job: string): number {
  if (JOB_RANK[job]) return JOB_RANK[job]
  const j = job.toLowerCase()
  if (j.includes("director")) return 1
  if (j.includes("producer")) return 2
  return 13
}

export function creditsFrom(bundle: TmdbBundle): Credit[] {
  const all = new Map<string, any>()
  const add = (rows: any[] | undefined, type: "movie" | "tv") => {
    for (const r of rows ?? []) {
      const key = `${type}-${r.id}`
      const prev = all.get(key)
      if (prev) prev.jobs = [...new Set([...prev.jobs, r.job])]
      else
        all.set(key, {
          ...r,
          type,
          title: type === "movie" ? r.title : r.name,
          jobs: [r.job],
          date: type === "movie" ? r.release_date : r.first_air_date,
        })
    }
  }
  add(bundle.movie_credits?.crew, "movie")
  add(bundle.tv_credits?.crew, "tv")

  return Array.from(all.values())
    .map((c) => {
      const jobs = (c.jobs as string[]).filter(Boolean).sort((a, b) => rank(a) - rank(b))
      return { c, jobs, top: Math.min(...jobs.map(rank)) }
    })
    .sort((a, b) => {
      if (a.top !== b.top) return a.top - b.top
      if (a.c.date && b.c.date) return new Date(b.c.date).getTime() - new Date(a.c.date).getTime()
      return 0
    })
    .map(({ c, jobs }) => ({
      key: `${c.type}-${c.id}`,
      title: c.title,
      year: c.date?.split("-")[0] || undefined,
      poster: c.poster_path ? `https://image.tmdb.org/t/p/w300${c.poster_path}` : undefined,
      jobs,
      href: `https://www.themoviedb.org/${c.type}/${c.id}`,
    }))
}
