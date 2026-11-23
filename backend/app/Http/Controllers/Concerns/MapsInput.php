<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;

trait MapsInput
{
    /**
     * Translate the camelCase keys sent by Angular into snake_case columns,
     * keeping only keys that were actually sent (so PATCH stays partial).
     *
     * @param  array<string, string>  $map  ['camelKey' => 'snake_column']
     * @return array<string, mixed>
     */
    protected function mapInput(Request $request, array $map): array
    {
        $result = [];

        foreach ($map as $key => $column) {
            if ($request->exists($key)) {
                $result[$column] = $request->input($key);
            }
        }

        return $result;
    }
}
