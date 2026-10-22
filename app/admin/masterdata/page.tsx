import DashboardApp from "../../../components/dashboard-app";
import MasterdataClient from "./masterdata-client";

export const metadata = { title: "ข้อมูลหลัก · รหัสไปรษณีย์ | ใจดี" };

export default function AdminMasterdataPage() {
  return <DashboardApp><MasterdataClient /></DashboardApp>;
}
