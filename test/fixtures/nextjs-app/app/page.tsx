export default function Home() {
  return (
    <main>
      <h1>Welcome</h1>
      <a href="/about" data-testid="about-link">About Us</a>
      <form role="search" data-testid="search-form">
        <input type="text" name="query" aria-label="Search" />
        <button type="submit" data-testid="search-btn">Search</button>
      </form>
    </main>
  );
}
