export default function Checkout() {
  return (
    <main>
      <h1>Checkout</h1>
      <form action="/api/orders" method="post">
        <input name="email" type="email" required aria-label="Email" />
        <input name="fullName" type="text" required aria-label="Full name" />
        <input name="address" type="text" required aria-label="Address" />
        <input name="city" type="text" required aria-label="City" />
        <input name="zip" type="text" required aria-label="ZIP" />
        <input name="cardNumber" type="text" required aria-label="Card number" />
        <input name="cvv" type="text" required aria-label="CVV" />
        <input name="expiry" type="text" required aria-label="Expiry" />
        <button type="submit" data-testid="place-order">Place order</button>
      </form>
    </main>
  );
}
