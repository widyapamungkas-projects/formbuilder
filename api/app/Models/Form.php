<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Form extends Model
{
    protected $fillable = ['name', 'description', 'status', 'storage_type'];

    // Holds storage credentials later (e.g. Nextcloud app password): never serialized.
    protected $hidden = ['storage_config'];

    protected function casts(): array
    {
        return [
            'storage_config' => 'encrypted:array',
            'definition' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
