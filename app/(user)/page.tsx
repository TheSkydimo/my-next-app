import { redirect } from "next/navigation";

export default function Home() {
  // No standalone homepage: go straight to order management.
  redirect("/orders");
}
