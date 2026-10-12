import { Logo } from "@/components/office/icons";

export const metadata = { title: "Sign in · Hermes Office" };

const ERRORS: Record<string, string> = {
  wrong: "Wrong password. Try again.",
  locked: "Too many attempts. Wait a few minutes.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(ellipse_at_30%_10%,#eef3ea_0%,#f4f4f2_50%,#f2f3f5_100%)] px-4">
      <form action="/api/login" method="post" className="w-full max-w-[360px] rounded-[22px] bg-white/90 p-7 shadow-[0_20px_50px_rgba(20,22,30,0.08)] backdrop-blur">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-[20px] font-bold tracking-tight text-[#1d1f26]">Hermes Office</h1>
            <p className="text-[12.5px] text-[#7a7e89]">Sign in to your virtual office</p>
          </div>
        </div>
        <input type="hidden" name="next" value={next} />
        <label className="mt-6 block text-[12px] font-semibold tracking-wide text-[#4e525d]" htmlFor="password">
          PASSWORD
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          required
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-xl border border-[#e3e5ea] px-3.5 py-2.5 text-[16px] outline-none focus:border-[#4f7cf5]"
        />
        {error && <p className="mt-2 text-[12.5px] text-[#e04848]">{ERRORS[error] ?? "Could not sign in."}</p>}
        <button className="mt-5 w-full rounded-full bg-[#16171d] py-2.5 text-[14.5px] font-semibold text-white hover:bg-black">Enter the office</button>
      </form>
    </main>
  );
}
