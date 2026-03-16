import { NextResponse } from "next/server"

const API_KEY = "9850560d16d31508eb0478db334923cb"
const PERSON_ID = "2283538"
const BASE_URL = "https://api.themoviedb.org/3/person/"

async function fetchData(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

export async function GET() {
  try {
    const personUrl = `${BASE_URL}${PERSON_ID}?api_key=${API_KEY}`
    const movieCreditsUrl = `${BASE_URL}${PERSON_ID}/movie_credits?api_key=${API_KEY}`
    const tvCreditsUrl = `${BASE_URL}${PERSON_ID}/tv_credits?api_key=${API_KEY}`

    const [personData, movieCreditsData, tvCreditsData] = await Promise.all([
      fetchData(personUrl),
      fetchData(movieCreditsUrl),
      fetchData(tvCreditsUrl),
    ])

    const data = {
      person: personData,
      movie_credits: movieCreditsData,
      tv_credits: tvCreditsData,
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("TMDB API Error:", error)
    return NextResponse.json({ error: "Failed to fetch TMDB data" }, { status: 500 })
  }
}
