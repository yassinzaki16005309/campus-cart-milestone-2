import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Product } from '../../core/models/product.model';
import { apiErrorMessage } from '../../core/services/api-error';
import { CheckoutOption, ProductApi } from '../../core/services/product-api';
import { Auth } from '../../core/services/auth';
import { FormsModule } from '@angular/forms';

interface CartItem {
  product: Product;
  quantity: number;
}

@Component({
  selector: 'app-store',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './store.html',
  styleUrl: './store.css',
})
export class Store {
  private api = inject(ProductApi);
  private auth = inject(Auth);

  // Product catalogue, loaded from the Laravel API
  products = signal<Product[]>([]);

  // Shopping cart (stays in the browser until checkout, as in Milestone 1)
  cart = signal<CartItem[]>([]);

  // Checkout option
  checkoutOption: CheckoutOption = 'pay-now';

  errorMessage = signal('');
  successMessage = signal('');

  // Number of products in the cart
  cartCount = computed(() => this.cart().reduce((total, item) => total + item.quantity, 0));

  // Total price of the cart (display only: the server recomputes the real total)
  cartTotal = computed(() =>
    this.cart().reduce((total, item) => total + item.product.price * item.quantity, 0),
  );

  constructor() {
    this.loadProducts();
  }

  private loadProducts(): void {
    this.api.list().subscribe({
      next: (products) => this.products.set(products),
      error: (error) => this.errorMessage.set(apiErrorMessage(error)),
    });
  }

  // Add product to cart
  addToCart(product: Product): void {
    if (product.stock <= 0) {
      this.errorMessage.set('This product is out of stock.');
      return;
    }

    const existingItem = this.cart().find((item) => item.product.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        this.errorMessage.set('You cannot add more than the available stock.');
        return;
      }

      this.cart.update((items) =>
        items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      );
    } else {
      this.cart.update((items) => [...items, { product, quantity: 1 }]);
    }

    this.errorMessage.set('');
    this.successMessage.set(`${product.name} added to cart.`);
  }

  // Increase product quantity
  increaseQuantity(productId: number): void {
    const product = this.products().find((p) => p.id === productId);
    const item = this.cart().find((i) => i.product.id === productId);

    if (!product || !item || item.quantity >= product.stock) {
      return;
    }

    this.cart.update((items) =>
      items.map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity + 1 } : i)),
    );
  }

  // Decrease product quantity
  decreaseQuantity(productId: number): void {
    this.cart.update((items) =>
      items
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  // Remove product from cart
  removeFromCart(productId: number): void {
    this.cart.update((items) => items.filter((item) => item.product.id !== productId));
  }

  // Complete checkout.
  // The server checks the stock, computes the total from its own prices, lowers the
  // stock and records either the Bookstore income or an unpaid invoice - all in one
  // database transaction.
  checkout(): void {
    const items = this.cart();

    if (items.length === 0) {
      this.errorMessage.set('Your cart is empty.');
      return;
    }

    // Quick check against the stock currently shown (the server re-checks it)
    for (const item of items) {
      const product = this.products().find((p) => p.id === item.product.id);

      if (!product || product.stock < item.quantity) {
        this.errorMessage.set(`Not enough stock available for ${item.product.name}.`);
        return;
      }
    }

    if (!this.auth.currentUser()) {
      this.errorMessage.set('Please log in before checking out.');
      return;
    }

    this.api
      .checkout(
        items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        this.checkoutOption,
      )
      .subscribe({
        next: (result) => {
          this.successMessage.set(result.message);
          this.cart.set([]);
          this.errorMessage.set('');
          this.loadProducts(); // show the new stock
        },
        error: (error) => {
          this.successMessage.set('');
          this.errorMessage.set(apiErrorMessage(error));
          this.loadProducts(); // another buyer may have changed the stock
        },
      });
  }
}
