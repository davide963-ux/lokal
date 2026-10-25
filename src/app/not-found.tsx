import { ErrorPanel } from "@/components/ui/error-panel";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return <main className="min-h-dvh"><ErrorPanel variant="notfound" /></main>;
}
