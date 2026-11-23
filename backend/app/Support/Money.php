<?php

namespace App\Support;

/**
 * Money is stored as DECIMAL(x,2). Totals are computed in integer cents
 * so floating-point rounding can never make an order, invoice and
 * transaction disagree.
 */
final class Money
{
    public static function toCents(string|int|float $amount): int
    {
        return (int) round(((float) $amount) * 100);
    }

    public static function fromCents(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}
