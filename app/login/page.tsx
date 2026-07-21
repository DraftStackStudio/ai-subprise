import LoginClient, { type AuthMode } from "./LoginClient";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { mode } = await searchParams;
  const initialMode: AuthMode = mode === "signup" ? "signup" : "login";

  return <LoginClient initialMode={initialMode} />;
}
