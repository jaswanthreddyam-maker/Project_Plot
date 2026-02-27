/**
 * ════════════════════════════════════════════════════════════════
 * Root Page — Redirect to workspace
 * ════════════════════════════════════════════════════════════════
 */

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/workspace");
}
