import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

export function RoleLayout({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "admin" | "teacher";
  children: ReactNode;
}) {
  return (
    <main className={`page-shell role-shell ${tone}-shell`}>
      <AppHeader title={title} />
      {children}
    </main>
  );
}
