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
  if (!username.trim()) redirect("/?game=valorant");

  let data: SearchResponse = {
    username,
    normalized: "",
    results: [],
    total: 0,
  };
  let apiError: string | null = null;

  try {
    data = await searchUsername(username);
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Failed to reach backend";
  }

  if (apiError) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-red-500 font-bold text-lg">Something went wrong. Please try again.</p>
      </main>
    );
  }

  return <ResultsContent username={username} initialData={data} />;
}
