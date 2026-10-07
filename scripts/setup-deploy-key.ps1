param(
    [string]$DeployHost = "user@119.214.25.118",
    [int]$DeployPort = 51222,
    [string]$KeyPath = "",
    [string]$PublicHealthUrl = "https://www.bowlingmanager.co.kr/api/mobile/v1/health"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
    param([string]$Message)

    Write-Host ""
    Write-Host "============================================================"
    Write-Host $Message
    Write-Host "============================================================"
}

function Assert-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

Assert-Command "ssh.exe"
Assert-Command "ssh-keygen.exe"
Assert-Command "cmd.exe"
Assert-Command "curl.exe"

if ([string]::IsNullOrWhiteSpace($KeyPath)) {
    $KeyPath = Join-Path $HOME ".ssh\bowlingmanager_deploy_ed25519"
}

$sshDir = Split-Path -Parent $KeyPath
New-Item -ItemType Directory -Force -Path $sshDir | Out-Null

Write-Step "1. CREATE DEPLOY KEY"

$keyExists = Test-Path -LiteralPath $KeyPath
$pubExists = Test-Path -LiteralPath ($KeyPath + ".pub")

if ($keyExists -xor $pubExists) {
    throw "Only one half of the SSH key pair exists. Remove or repair it before continuing."
}

if (-not $keyExists) {
    $sshKeygen = (Get-Command ssh-keygen.exe).Source
    $batchPath = Join-Path $env:TEMP ("bowlingmanager-keygen-" + [Guid]::NewGuid().ToString("N") + ".cmd")

    $batch = '@echo off' + [Environment]::NewLine +
        '"' + $sshKeygen + '" -q -t ed25519 -a 100 -f "' + $KeyPath + '" -C "bowlingmanager-deploy" -N ""' +
        [Environment]::NewLine

    [System.IO.File]::WriteAllText(
        $batchPath,
        $batch,
        [System.Text.Encoding]::ASCII
    )

    try {
        & cmd.exe /d /c $batchPath
        if ($LASTEXITCODE -ne 0) {
            throw "ssh-keygen failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Remove-Item -LiteralPath $batchPath -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path -LiteralPath $KeyPath)) {
    throw "Private key was not created: $KeyPath"
}

if (-not (Test-Path -LiteralPath ($KeyPath + ".pub"))) {
    throw "Public key was not created: $KeyPath.pub"
}

$pub = (Get-Content -LiteralPath ($KeyPath + ".pub") -Raw).Trim()

if (-not $pub.StartsWith("ssh-ed25519 ")) {
    throw "Unexpected public key format."
}

Write-Host "Private key: $KeyPath"
Write-Host "Public key : $KeyPath.pub"

Write-Step "2. INSTALL RESTRICTED KEY ON SERVER"

$wrapper = @'
#!/usr/bin/env bash
set -Eeuo pipefail

case "${SSH_ORIGINAL_COMMAND:-}" in
  deploy-check)
    exec /bin/bash -lc '/home/user/deploy-bowling.sh --check'
    ;;
  deploy-release)
    exec /bin/bash -lc '/home/user/deploy-bowling.sh --check && /home/user/deploy-bowling.sh'
    ;;
  *)
    echo "Only deploy-check or deploy-release is allowed." >&2
    exit 126
    ;;
esac
'@

$keyLine = 'command="/home/user/.local/bin/bowling-deploy-command",restrict ' + $pub

$utf8 = New-Object System.Text.UTF8Encoding($false)
$wrapperB64 = [Convert]::ToBase64String($utf8.GetBytes($wrapper))
$keyLineB64 = [Convert]::ToBase64String($utf8.GetBytes($keyLine))

$remoteSetup = @'
set -Eeuo pipefail

mkdir -p /home/user/.local/bin
mkdir -p /home/user/.ssh
chmod 700 /home/user/.ssh

printf '%s' '__WRAPPER__' | base64 -d > /home/user/.local/bin/bowling-deploy-command
chmod 700 /home/user/.local/bin/bowling-deploy-command

touch /home/user/.ssh/authorized_keys
chmod 600 /home/user/.ssh/authorized_keys

tmp="$(mktemp)"

grep -v -E 'bowlingmanager-deploy|^command="/home/user/\.local/bin/bowling-deploy-command",restrict[[:space:]]*$' \
  /home/user/.ssh/authorized_keys > "$tmp" || true

printf '%s' '__KEYLINE__' | base64 -d >> "$tmp"
printf '\n' >> "$tmp"

mv "$tmp" /home/user/.ssh/authorized_keys
chmod 600 /home/user/.ssh/authorized_keys

echo "BowlingManager restricted deploy key installed."
'@

$remoteSetup = $remoteSetup.Replace("__WRAPPER__", $wrapperB64)
$remoteSetup = $remoteSetup.Replace("__KEYLINE__", $keyLineB64)

$remoteSetup | & ssh.exe -p "$DeployPort" $DeployHost "bash -s"
if ($LASTEXITCODE -ne 0) {
    throw "Remote deploy-key installation failed."
}

Write-Step "3. SAVE LOCAL DEPLOY SETTINGS"

$env:BOWLING_DEPLOY_HOST = $DeployHost
$env:BOWLING_DEPLOY_PORT = "$DeployPort"
$env:BOWLING_DEPLOY_KEY = $KeyPath
$env:BOWLING_PUBLIC_HEALTH_URL = $PublicHealthUrl

[Environment]::SetEnvironmentVariable("BOWLING_DEPLOY_HOST", $env:BOWLING_DEPLOY_HOST, "User")
[Environment]::SetEnvironmentVariable("BOWLING_DEPLOY_PORT", $env:BOWLING_DEPLOY_PORT, "User")
[Environment]::SetEnvironmentVariable("BOWLING_DEPLOY_KEY", $env:BOWLING_DEPLOY_KEY, "User")
[Environment]::SetEnvironmentVariable("BOWLING_PUBLIC_HEALTH_URL", $env:BOWLING_PUBLIC_HEALTH_URL, "User")

Write-Host "Host       : $DeployHost"
Write-Host "Port       : $DeployPort"
Write-Host "Identity   : $KeyPath"
Write-Host "Health URL : $PublicHealthUrl"

Write-Step "4. PASSWORDLESS DEPLOY CHECK"

$sshArgs = @(
    "-i",
    $KeyPath,
    "-p",
    "$DeployPort",
    "-o",
    "BatchMode=yes",
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    $DeployHost,
    "deploy-check"
)

& ssh.exe @sshArgs
if ($LASTEXITCODE -ne 0) {
    throw "Passwordless deploy-check failed."
}

Write-Step "5. PUBLIC HTTPS HEALTH CHECK"

$curlArgs = @(
    "--fail",
    "--silent",
    "--show-error",
    "--max-time",
    "15",
    "--user-agent",
    "BowlingManagerReleaseCheck/1.0",
    $PublicHealthUrl
)

$healthOutput = & curl.exe @curlArgs
if ($LASTEXITCODE -ne 0) {
    throw "Public health check failed: $PublicHealthUrl"
}

Write-Host "Public health: OK"
Write-Host ($healthOutput -join [Environment]::NewLine)

Write-Step "SETUP COMPLETE"

Write-Host "Future release command:"
Write-Host ".\scripts\release-bowling.ps1 -Version 1.2.1 -Deploy"
