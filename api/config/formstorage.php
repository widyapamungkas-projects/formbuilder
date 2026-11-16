<?php

return [
    // All server-side: users never provide a server or credentials.
    'nextcloud_url' => env('NEXTCLOUD_URL'),
    'nextcloud_username' => env('NEXTCLOUD_USERNAME'),
    'nextcloud_password' => env('NEXTCLOUD_APP_PASSWORD'),
    'nextcloud_base_folder' => env('NEXTCLOUD_BASE_FOLDER', '/Forms'),
];
