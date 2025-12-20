// 管理端已改为邮箱验证码登录，不再支持密码找回/重置
export async function POST() {
  return new Response("管理员已改为邮箱验证码登录，不再提供密码重置功能", {
    status: 410,
  });
}

