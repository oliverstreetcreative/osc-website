const BASEROW_URL = process.env.BASEROW_URL || "http://localhost:8585/api"
const BASEROW_TOKEN = process.env.BASEROW_TOKEN || ""

// Table IDs for intake forms
export const INTAKE_TABLES = {
  crew: 799,
  casting: 800,
  locations: 801,
} as const

export type IntakeType = keyof typeof INTAKE_TABLES

export async function createBaserowRow(
  tableId: number,
  data: Record<string, unknown>
): Promise<{ id: number }> {
  const res = await fetch(
    `${BASEROW_URL}/database/rows/table/${tableId}/?user_field_names=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${BASEROW_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Baserow error ${res.status}: ${body}`)
  }

  return res.json()
}
