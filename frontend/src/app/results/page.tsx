import { redirect } from "next/navigation";
import { searchUsername, type SearchResponse } from "@/lib/api";
import ResultsContent from "./ResultsContent";

// Async server component — fetches OCR data on the server before rendering.
// The client shell (ResultsContent) receives pre-fetched data as props so
// there is no client-side loading spinner or waterfall.
export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ username?: string }>;
}) {
  const { username = "" } = await searchParams;
  if (!username.trim()) redirect("/");

  let data: SearchResponse = {
    username,
    normalized: "",
    results: [],
    total: 0,
  };

  try {
    data = await searchUsername(username);
  } catch {
    // API not reachable — render empty results (no-matches view).
  }

  return <ResultsContent username={username} initialData={data} />;
}
