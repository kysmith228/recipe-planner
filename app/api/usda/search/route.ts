import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const apiKey = process.env.USDA_API_KEY;
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing USDA_API_KEY" },
      { status: 500 }
    );
  }

  if (!query) {
    return NextResponse.json(
      { error: "Missing query" },
      { status: 400 }
    );
  }

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "5");

  const response = await fetch(url.toString());

  if (!response.ok) {
    return NextResponse.json(
      { error: "USDA request failed" },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json(data);
}