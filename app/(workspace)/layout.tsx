import type { ReactNode } from "react";
import DashboardApp from "../../components/dashboard-app";

// Keep the workspace shell mounted so menu navigation preserves the current session state.
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <>
    <DashboardApp />
    {children}
  </>;
}
