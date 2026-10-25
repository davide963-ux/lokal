import { requireEmployeePage } from "@/lib/authz";

export const metadata = { title: "Home" };

export default async function EmployeeHome() {
  const user = await requireEmployeePage();
  return <h1 className="text-3xl font-semibold">Welcome, {user.name.split(" ")[0]}</h1>;
}
