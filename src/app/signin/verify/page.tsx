export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold mb-3">Check your email</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          A sign-in link was sent to your email address. Click the link to
          continue — it expires in 10 minutes.
        </p>
        <p className="mt-6 text-xs text-zinc-600">
          Didn&apos;t get it? Check your spam folder or go back and try again.
        </p>
      </div>
    </main>
  );
}
