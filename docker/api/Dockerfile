FROM php:8.4-fpm

RUN apt-get update \
 && apt-get install -y --no-install-recommends git unzip libzip-dev libicu-dev \
 && docker-php-ext-install pdo_mysql bcmath intl zip opcache \
 && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY php.ini /usr/local/etc/php/conf.d/99-opnform.ini

WORKDIR /var/www/html
