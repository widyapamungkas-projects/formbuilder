<?php

namespace App\Http\Controllers;

use App\Services\NextcloudStorage;

class StorageController extends Controller
{
    public function options(NextcloudStorage $nextcloud)
    {
        $enabled = $nextcloud->enabled();

        return [
            'nextcloud' => [
                'enabled' => $enabled,
                'base_folder' => $enabled ? $nextcloud->baseFolder() : null,
            ],
        ];
    }
}
