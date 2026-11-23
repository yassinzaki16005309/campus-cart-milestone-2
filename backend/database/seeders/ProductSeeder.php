<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * The six Milestone 1 store products.
 *
 * Matched by name and only created when missing: re-running the seeder never
 * resets a price or the current stock (stock changes with every sale).
 */
class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $products = [
            ['Introduction to Programming', 'Programming textbook for computer science students.', 'Books', 450, 15, '/images/products/python_book.jfif'],
            ['Data Structures and Algorithms', 'Essential textbook covering algorithms and data structures.', 'Books', 550, 12, '/images/products/DS_book.png'],
            ['Laboratory Coat', 'White laboratory coat for university laboratory sessions.', 'Lab Equipment', 350, 20, '/images/products/lab_coat.webp'],
            ['Campus Hoodie', 'Comfortable hoodie with CampusCart university branding.', 'Merchandise', 700, 10, '/images/products/campus_hoodie.webp'],
            ['University Notebook', 'Notebook for lectures and university notes.', 'Stationery', 120, 30, '/images/products/notebook.jpeg'],
            ['Campus Water Bottle', 'Reusable university-branded water bottle.', 'Merchandise', 180, 18, '/images/products/bottle.webp'],
        ];

        foreach ($products as [$name, $description, $category, $price, $stock, $image]) {
            Product::firstOrCreate(
                ['name' => $name],
                [
                    'description' => $description,
                    'category' => $category,
                    'price' => $price,
                    'stock' => $stock,
                    'image_url' => $image,
                ]
            );
        }
    }
}
