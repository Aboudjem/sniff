export default function Signup() {
  return (
    <main>
      <h1>Create account</h1>
      <form method="post" action="/api/auth/signup">
        <input name="name" type="text" required aria-label="Full name" />
        <input name="email" type="email" required aria-label="Email" />
        <input name="password" type="password" required aria-label="Password" />
        <button type="submit" data-testid="signup-submit">Create account</button>
      </form>
    </main>
  );
}
