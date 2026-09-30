import { redirect } from "next/navigation";

export default function AccountRedirect(): never {
  redirect("/profile");
}
