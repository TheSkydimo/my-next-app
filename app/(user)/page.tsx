import UserHomePage from "./_pages/UserHomePage";

export default function Home() {
  // Homepage handles both states:
  // - Logged in: welcome + quick actions
  // - Not logged in: inline sign-in UI (AuthEmailCodePage)
  return <UserHomePage />;
}
