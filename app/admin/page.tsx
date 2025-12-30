import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  // 管理端不再提供“首页”：统一默认进入个人信息页
  redirect("/admin/profile");
}


