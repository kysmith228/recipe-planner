import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Visit this recipe URL and extract the recipe details: ${url}

Return ONLY a JSON object with these exact fields (no markdown, no explanation):
{
  "name": "Recipe Name",
  "category": "Dinner",
  "tags": "tag1, tag2",
  "notes": "Brief cooking instructions or notes",
  "servings": 4,
  "ingredients": ["1 lb chicken breast", "2 cups rice", "1 tsp salt"]
}

Category must be one of: Breakfast, Lunch, Dinner, Snack, Side, Dressing, Dessert.
Ingredients must be plain strings like "1 lb chicken breast" — quantity, unit, then item.
If you cannot access the URL, return {"error": "Could not fetch URL"}.`,
        },
      ],
    });

    const text = message.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
