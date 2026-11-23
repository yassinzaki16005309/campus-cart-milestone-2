<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            // A product that has been sold cannot be deleted.
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->unsignedInteger('quantity');
            // Price snapshot taken at checkout.
            $table->decimal('unit_price', 10, 2);

            $table->unique(['order_id', 'product_id'], 'order_items_order_product_unique');
        });

        DB::statement(
            'ALTER TABLE order_items ADD CONSTRAINT order_items_values_valid
             CHECK (quantity >= 1 AND unit_price >= 0)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
