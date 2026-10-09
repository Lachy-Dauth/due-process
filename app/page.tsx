import CourtApp from "./court-app";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <CourtApp
      userName={user?.fullName ?? null}
      signedIn={!!user}
      signInPath={chatGPTSignInPath("/")}
      initialNow={Date.now()}
    />
  );
}
