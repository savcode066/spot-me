import { redirect } from "next/navigation";

// The dedicated Dota 2 landing page was folded into the unified search
// form on "/" — this route now just preselects that game for old links.
export default function Dota2LandingRedirect() {
  redirect("/?game=dota2");
}
