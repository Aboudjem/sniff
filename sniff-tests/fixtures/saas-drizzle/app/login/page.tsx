export default function Login() {
  return (
    <main>
      <h1>Sign in</h1>
      <form method="post" action="/api/auth/callback/credentials">
        <input name="email" type="email" required aria-label="Email" />
        <input name="password" type="password" required aria-label="Password" />
        <button type="submit" data-testid="login-submit">Sign in</button>
      </form>
    </main>
  );
}
