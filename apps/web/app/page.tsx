import { redirect } from "next/navigation";

export default function Home() {
  // TODO: check auth token / session — for now, redirect to login
  redirect("/login");
}
