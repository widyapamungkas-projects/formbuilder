<#
  opnForm dev helper (Windows PowerShell 5.1 or PowerShell 7).

  First time:   .\dev.ps1 init
  Every day:    .\dev.ps1 up
  Others:       down | logs [service] | ps | artisan <args> | composer <args> | npm <args> | nextcloud | help

  If scripts are blocked:  powershell -ExecutionPolicy Bypass -File .\dev.ps1 init
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet('init', 'up', 'down', 'logs', 'ps', 'artisan', 'composer', 'npm', 'nextcloud', 'help')]
  [string]$Command = 'help',

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Invoke-Native {
  param([string]$File, [string[]]$Arguments)
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit $LASTEXITCODE): $File $($Arguments -join ' ')"
  }
}

function Test-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker not found. Install Docker Desktop first.'
  }
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & docker info *> $null
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  if ($code -ne 0) { throw 'Docker is not running. Start Docker Desktop and retry.' }
}

function New-Secret {
  param([int]$Length = 24)
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  $clean = [Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', ''
  return $clean.Substring(0, $Length)
}

# Write UTF-8 WITHOUT BOM and with LF. A BOM or CRLF in .env breaks docker compose / Laravel.
function Write-EnvFile {
  param([string]$Path, [string]$Text)
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, ($Text -replace "`r`n", "`n"), $enc)
}

function Initialize-EnvFile {
  $envPath = Join-Path $PSScriptRoot '.env'
  if (Test-Path -LiteralPath $envPath) { return }
  $text = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot '.env.example'))
  foreach ($placeholder in @('change_me_db', 'change_me_root', 'change_me_nc')) {
    $text = $text.Replace($placeholder, (New-Secret))
  }
  Write-EnvFile $envPath $text
  Write-Host '==> Created .env with random secrets (git-ignored).'
}

function Set-EnvValue {
  param([string]$Key, [string]$Value)
  $envPath = Join-Path $PSScriptRoot '.env'
  $text = [System.IO.File]::ReadAllText($envPath)
  $text = $text -replace "(?m)^$Key=.*`$", "$Key=$Value"
  Write-EnvFile $envPath $text
}

function Test-EnvHasKey {
  $envPath = Join-Path $PSScriptRoot '.env'
  return ([System.IO.File]::ReadAllText($envPath) -match '(?m)^APP_KEY=base64:')
}

# Commit (never force) and push to develop when an origin remote exists.
function Save-Commit {
  param([string]$Message)
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warning 'git not found - skipping commit.'
    return
  }
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.git'))) {
      & git init -b develop | Out-Null
    }
    & git check-ignore -q .env
    if ($LASTEXITCODE -ne 0) {
      throw '.env is NOT ignored by git. Aborting commit to protect your secrets.'
    }
    & git add -A
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host 'Nothing to commit.'; return }
    & git commit -m $Message
    if ($LASTEXITCODE -ne 0) { Write-Warning 'git commit failed (is user.name/user.email set?).'; return }

    $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    $remotes = @(& git remote)
    if ($remotes -contains 'origin' -and $branch -eq 'develop') {
      & git push -u origin develop
      if ($LASTEXITCODE -ne 0) { Write-Warning 'Push failed. Commit is saved locally; fix access and push later.' }
    }
    else {
      Write-Warning "Push skipped (branch '$branch', remote origin present: $($remotes -contains 'origin')). Commit is local only."
    }
  }
  finally {
    $ErrorActionPreference = $prev
  }
}

function Show-Urls {
  Write-Host ''
  Write-Host 'Frontend : http://localhost:5173'
  Write-Host 'API      : http://localhost:8000'
  Write-Host 'MySQL    : localhost:3307 (from host tools)'
}

function Invoke-Init {
  Test-Docker
  Initialize-EnvFile

  Write-Host '==> Building api image ...'
  Invoke-Native docker @('compose', 'build', 'api')

  $apiDir = Join-Path $PSScriptRoot 'api'
  if (-not (Test-Path -LiteralPath (Join-Path $apiDir 'artisan'))) {
    New-Item -ItemType Directory -Force -Path $apiDir | Out-Null
    Write-Host '==> Creating Laravel project (composer create-project) ...'
    Invoke-Native docker @('run', '--rm', '-v', "${apiDir}:/var/www/html", '-w', '/var/www/html',
      'opnform-api', 'composer', 'create-project', 'laravel/laravel', '.', '--no-interaction')
  }

  if (-not (Test-EnvHasKey)) {
    Write-Host '==> Generating APP_KEY ...'
    $out = & docker run --rm -v "${apiDir}:/var/www/html" -w /var/www/html opnform-api php artisan key:generate --show --no-ansi
    if ($LASTEXITCODE -ne 0) { throw 'key:generate failed.' }
    $key = ($out | Select-Object -Last 1).ToString().Trim()
    if ($key -notmatch '^base64:') { throw "Unexpected APP_KEY output: $key" }
    Set-EnvValue 'APP_KEY' $key
  }

  # Config comes from the root .env via docker compose; a second api\.env would only drift.
  $apiEnv = Join-Path $apiDir '.env'
  if (Test-Path -LiteralPath $apiEnv) { Remove-Item -LiteralPath $apiEnv -Force }

  $feDir = Join-Path $PSScriptRoot 'frontend'
  if (-not (Test-Path -LiteralPath (Join-Path $feDir 'package-lock.json'))) {
    Write-Host '==> Resolving frontend dependencies (lockfile only) ...'
    Invoke-Native docker @('run', '--rm', '-v', "${feDir}:/app", '-w', '/app', 'node:22-alpine', 'sh', '-c',
      'npm install --package-lock-only react react-dom && npm install --package-lock-only -D vite @vitejs/plugin-react typescript @types/react @types/react-dom')
  }

  Write-Host '==> Starting stack ...'
  Invoke-Native docker @('compose', 'up', '-d', '--build')

  Write-Host '==> Running migrations ...'
  Invoke-Native docker @('compose', 'exec', '-T', 'api', 'php', 'artisan', 'migrate', '--force')

  Save-Commit 'feat(api): scaffold Laravel app and frontend dependencies'
  Show-Urls
}

switch ($Command) {
  'init' { Invoke-Init }
  'up' {
    Test-Docker
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.env'))) { throw 'No .env yet. Run: .\dev.ps1 init' }
    Invoke-Native docker @('compose', 'up', '-d', '--build')
    Show-Urls
  }
  'down' { Test-Docker; Invoke-Native docker @('compose', '--profile', 'nextcloud', 'down') }
  'logs' { Test-Docker; & docker compose logs -f --tail=100 @Rest }
  'ps' { Test-Docker; Invoke-Native docker @('compose', '--profile', 'nextcloud', 'ps') }
  'artisan' { Test-Docker; & docker compose exec api php artisan @Rest }
  'composer' { Test-Docker; & docker compose exec api composer @Rest }
  'npm' { Test-Docker; & docker compose exec frontend npm @Rest }
  'nextcloud' {
    Test-Docker
    Invoke-Native docker @('compose', '--profile', 'nextcloud', 'up', '-d', 'nextcloud')
    Write-Host 'Nextcloud: http://localhost:8080  (admin user/password: see NEXTCLOUD_* in .env)'
    Write-Host 'From the api container, WebDAV host is http://nextcloud (assumption - verify in phase 4).'
  }
  default { Get-Help -Detailed $PSCommandPath }
}
