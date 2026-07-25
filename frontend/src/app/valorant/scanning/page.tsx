import { redirect } from "next/navigation";
import ScanningContent from "./ScanningContent";

// Server component — reads searchParams on the server so the client shell
// never needs useSearchParams (eliminates the Suspense boundary requirement).
export default async function ScanningPage({
  searchParams,
}: {
  searchParams: Promise<{ username?: string }>;
}) {
  const { username = "" } = await searchParams;
  if (!username.trim()) redirect("/");

  return <ScanningContent username={username} />;
}
