import { notFound } from "next/navigation";
import Inbox from "./Inbox";
export const dynamic = "force-dynamic";
export default function Page() {
  if (process.env.NODE_ENV !== "development" || process.env.LOGIN_MAIL_MODE === "live") notFound();
  return <Inbox />;
}
