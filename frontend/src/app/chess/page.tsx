import { redirect } from "next/navigation";

// The dedicated Chess.com landing page was folded into the unified search
// form on "/" — this route now just preselects that game for old links.
export default function ChessLandingRedirect() {
  redirect("/?game=chess");
}
