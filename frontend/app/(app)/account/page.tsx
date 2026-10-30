import LogoutButton from "@/components/LogoutButton";

export default function AccountPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-8 text-white">
      <header>
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="mt-2 text-sm text-white/60">
          Manage your profile and preferences.
        </p>
      </header>

      <section
        aria-labelledby="account-actions-title"
        className="rounded-2xl border border-white/10 bg-white/5 p-6"
      >
        <h2
          id="account-actions-title"
          className="text-xl font-semibold"
        >
          Account actions
        </h2>

        <LogoutButton
          className="mt-5 rounded-lg bg-white/10 px-4 py-3 text-sm
                     font-medium hover:bg-white/20"
        />
      </section>
    </section>
  );
}