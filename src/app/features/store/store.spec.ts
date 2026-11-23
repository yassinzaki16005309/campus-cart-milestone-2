import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Store } from './store';
import { Auth } from '../../core/services/auth';
import { Product } from '../../core/models/product.model';
import { User } from '../../core/models/user.model';

const API = 'http://localhost:8000/api';

const STUDENT: User = {
  id: 3,
  username: 'student',
  fullName: 'CampusCart Student',
  email: 'student@campuscart.com',
  pictureUrl: '',
  role: 'student',
  preferences: [],
};

// The six products the server seeds (same data as Milestone 1)
const PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Introduction to Programming',
    description: 'Programming textbook.',
    category: 'Books',
    price: 450,
    stock: 15,
    imageUrl: '/images/products/python_book.jfif',
  },
  {
    id: 2,
    name: 'Data Structures and Algorithms',
    description: 'Algorithms textbook.',
    category: 'Books',
    price: 550,
    stock: 12,
    imageUrl: '/images/products/DS_book.png',
  },
  {
    id: 3,
    name: 'Laboratory Coat',
    description: 'White coat.',
    category: 'Lab Equipment',
    price: 350,
    stock: 20,
    imageUrl: '/images/products/lab_coat.webp',
  },
  {
    id: 4,
    name: 'Campus Hoodie',
    description: 'Hoodie.',
    category: 'Merchandise',
    price: 700,
    stock: 10,
    imageUrl: '/images/products/campus_hoodie.webp',
  },
  {
    id: 5,
    name: 'University Notebook',
    description: 'Notebook.',
    category: 'Stationery',
    price: 120,
    stock: 30,
    imageUrl: '/images/products/notebook.jpeg',
  },
  {
    id: 6,
    name: 'Campus Water Bottle',
    description: 'Bottle.',
    category: 'Merchandise',
    price: 180,
    stock: 18,
    imageUrl: '/images/products/bottle.webp',
  },
];

describe('Store', () => {
  let component: Store;
  let fixture: ComponentFixture<Store>;
  let auth: Auth;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Store],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
    auth.setCurrentUser(STUDENT);

    fixture = TestBed.createComponent(Store);
    component = fixture.componentInstance;

    // The page loads the catalogue from the API when it opens
    http.expectOne(`${API}/products`).flush({ data: PRODUCTS });
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // PRODUCT CATALOGUE
  it('should load the products from the API', () => {
    expect(component.products().length).toBe(6);
  });

  // SHOPPING CART
  it('should add a product to the cart', () => {
    const product = component.products()[0];

    component.addToCart(product);

    expect(component.cart().length).toBe(1);
    expect(component.cartCount()).toBe(1);
  });

  it('should increase quantity when adding the same product again', () => {
    const product = component.products()[0];

    component.addToCart(product);
    component.addToCart(product);

    expect(component.cart()[0].quantity).toBe(2);
    expect(component.cartCount()).toBe(2);
  });

  it('should calculate the cart total correctly', () => {
    const product = component.products()[0];

    component.addToCart(product);
    component.addToCart(product);

    expect(component.cartTotal()).toBe(product.price * 2);
  });

  it('should reject products that are out of stock', () => {
    const product = { ...component.products()[0], stock: 0 };

    component.addToCart(product);

    expect(component.cart()).toEqual([]);
    expect(component.errorMessage()).toBe('This product is out of stock.');
  });

  it('should prevent adding more than the available stock', () => {
    const product = { ...component.products()[0], stock: 1 };

    component.addToCart(product);
    component.addToCart(product);

    expect(component.cart()[0].quantity).toBe(1);
    expect(component.errorMessage()).toBe('You cannot add more than the available stock.');
  });

  it('should increase and decrease cart quantity', () => {
    const product = component.products()[0];

    component.addToCart(product);
    component.increaseQuantity(product.id);

    expect(component.cart()[0].quantity).toBe(2);

    component.decreaseQuantity(product.id);

    expect(component.cart()[0].quantity).toBe(1);
  });

  it('should remove an item when its quantity reaches zero', () => {
    const product = component.products()[0];

    component.addToCart(product);
    component.decreaseQuantity(product.id);

    expect(component.cart()).toEqual([]);
    expect(component.cartCount()).toBe(0);
  });

  it('should remove a product from the cart', () => {
    const product = component.products()[0];

    component.addToCart(product);
    component.removeFromCart(product.id);

    expect(component.cart()).toEqual([]);
  });

  // CHECKOUT VALIDATION (no request is sent in these cases: http.verify() proves it)
  it('should reject checkout when the cart is empty', () => {
    component.checkout();

    expect(component.errorMessage()).toBe('Your cart is empty.');
  });

  it('should reject checkout when the user is not logged in', () => {
    auth.setCurrentUser(null);

    component.addToCart(component.products()[0]);
    component.checkout();

    expect(component.errorMessage()).toBe('Please log in before checking out.');
    expect(component.cart().length).toBe(1);
  });

  it('should reject checkout when stock is no longer available', () => {
    const product = component.products()[0];

    component.addToCart(product);

    component.products.update((products) =>
      products.map((p) => (p.id === product.id ? { ...p, stock: 0 } : p)),
    );

    component.checkout();

    expect(component.errorMessage()).toContain('Not enough stock available');
    expect(component.cart().length).toBe(1);
  });

  // PAY NOW CHECKOUT
  it('should send only ids, quantities and the payment option when paying immediately', () => {
    const product = component.products()[0];

    component.addToCart(product);
    component.addToCart(product);
    component.checkoutOption = 'pay-now';
    component.checkout();

    const request = http.expectOne(`${API}/checkout`);
    expect(request.request.method).toBe('POST');
    // No prices, no total, no income record: the server computes and records them.
    expect(request.request.body).toEqual({
      items: [{ productId: product.id, quantity: 2 }],
      paymentOption: 'pay-now',
    });

    request.flush({ message: 'Payment successful! Your purchase total is EGP 900.' });
    http.expectOne(`${API}/products`).flush({ data: PRODUCTS });

    expect(component.successMessage()).toBe('Payment successful! Your purchase total is EGP 900.');
  });

  // ADD TO INVOICE CHECKOUT
  it('should ask the server to create an unpaid invoice when adding the purchase to student fees', () => {
    const product = component.products()[0];

    component.addToCart(product);
    component.checkoutOption = 'add-to-invoice';
    component.checkout();

    const request = http.expectOne(`${API}/checkout`);
    expect(request.request.body.paymentOption).toBe('add-to-invoice');

    request.flush({
      message: 'Your purchase has been added to your student fees as an unpaid invoice.',
    });
    http.expectOne(`${API}/products`).flush({ data: PRODUCTS });

    expect(component.successMessage()).toBe(
      'Your purchase has been added to your student fees as an unpaid invoice.',
    );
  });

  // SUCCESSFUL CHECKOUT
  it('should clear the cart and show the new stock after checkout', () => {
    const product = component.products()[0];

    component.addToCart(product);
    component.checkout();

    http
      .expectOne(`${API}/checkout`)
      .flush({ message: 'Payment successful! Your purchase total is EGP 450.' });

    // the server lowered the stock; the page reloads the catalogue
    http.expectOne(`${API}/products`).flush({
      data: PRODUCTS.map((p) => (p.id === product.id ? { ...p, stock: p.stock - 1 } : p)),
    });

    const updatedProduct = component.products().find((p) => p.id === product.id);
    expect(updatedProduct?.stock).toBe(product.stock - 1);
    expect(component.cart()).toEqual([]);
  });

  // SERVER-SIDE CHECKOUT FAILURE
  it('should keep the cart and show the server message when the server refuses the checkout', () => {
    const product = component.products()[0];

    component.addToCart(product);
    component.checkout();

    http
      .expectOne(`${API}/checkout`)
      .flush(
        {
          message: 'Not enough stock available for Introduction to Programming.',
          code: 'insufficient_stock',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    http.expectOne(`${API}/products`).flush({ data: PRODUCTS });

    expect(component.errorMessage()).toBe(
      'Not enough stock available for Introduction to Programming.',
    );
    expect(component.successMessage()).toBe('');
    expect(component.cart().length).toBe(1);
  });
});
