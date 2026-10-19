import { Logo } from "@/components/office/icons";

export const metadata = { title: "Sign in · Arklyn Office" };

const ERRORS: Record<string, string> = {
  wrong: "Wrong password. Try again.",
  locked: "Too many attempts. Wait a few minutes.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <main className="grid min-h-[100dvh] place-items-center office-shell px-4">
      <form action="/api/login" method="post" className="w-full max-w-[360px] rounded-[22px] bg-surface/90 p-7 shadow-[0_20px_50px_rgba(20,22,30,0.08)] backdrop-blur">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-[20px] font-bold tracking-tight text-ink">Arklyn Office</h1>
            <p className="text-[12.5px] text-muted">Sign in to your virtual office</p>
          </div>
        </div>
        <input type="hidden" name="next" value={next} />
        <label className="mt-6 block text-[12px] font-semibold tracking-wide text-muted" htmlFor="password">
          PASSWORD
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5 text-[16px] outline-none focus:border-accent-line"
        />
        {error && <p className="mt-2 text-[12.5px] text-danger">{ERRORS[error] ?? "Could not sign in."}</p>}
        <button className="mt-5 w-full rounded-full bg-action py-2.5 text-[14.5px] font-semibold text-white hover:bg-action-hover">Enter the office</button>
      </form>
    </main>
  );
}
