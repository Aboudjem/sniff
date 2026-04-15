export default function Dashboard({ params }: { params: { id: string } }) {
  return (
    <main>
      <h1>Dashboard {params.id}</h1>
      <form data-testid="settings-form">
        <input type="text" name="displayName" id="display-name" aria-label="Display name" />
        <select name="theme" data-testid="theme-select">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <textarea name="bio" aria-label="Biography" />
        <button type="submit" data-testid="save-btn">Save</button>
      </form>
    </main>
  );
}
