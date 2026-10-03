import { NextResponse } from "next/server"
import { fetchTmdbBundle } from "@/lib/tmdb"

export async function GET() {
  try {
    return NextResponse.json(await fetchTmdbBundle())
  } catch (error) {
    console.error("TMDB API Error:", error)
    return NextResponse.json({ error: "Failed to fetch TMDB data" }, { status: 500 })
  }
}
