<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\MapsInput;
use App\Http\Requests\ProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Read: admin + student (store page). Write: admin only (route group). */
class ProductController extends Controller
{
    use MapsInput;

    private const MAP = [
        'name' => 'name',
        'description' => 'description',
        'category' => 'category',
        'price' => 'price',
        'stock' => 'stock',
        'imageUrl' => 'image_url',
    ];

    public function index(): AnonymousResourceCollection
    {
        return ProductResource::collection(Product::orderBy('id')->get());
    }

    public function show(Product $product): ProductResource
    {
        return new ProductResource($product);
    }

    public function store(ProductRequest $request): JsonResponse
    {
        $product = Product::create($this->mapInput($request, self::MAP));

        return (new ProductResource($product))
            ->additional(['message' => 'Product created successfully.'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(ProductRequest $request, Product $product): JsonResponse
    {
        $product->update($this->mapInput($request, self::MAP));

        return (new ProductResource($product))
            ->additional(['message' => 'Product updated successfully.'])
            ->response();
    }

    public function destroy(Product $product): JsonResponse
    {
        // A product that appears in an order is part of the sales history.
        if ($product->orderItems()->exists()) {
            throw new ApiException('This product has been sold and cannot be deleted.', 409, 'product_in_use');
        }

        $product->delete();

        return response()->json(['message' => 'Product deleted successfully.']);
    }
}
