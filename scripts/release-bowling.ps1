param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [int]$BuildNumber = 0,
    [switch]$Deploy,
    [switch]$DeployOnly,
    [switch]$TagOnly,
    [switch]$SkipTag,
    [string]$DevelopBranch = "codex/develop-1.2.0",
    [string]$MainBranch = "main",
    [string]$DeployHost = "",
    [int]$DeployPort = 22,
    [string]$DeployIdentityFile = "",
    [string]$PublicHealthUrl = "https://bowlingmanager.co.kr/api/mobile/v1/health"
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

function Invoke-Checked {
    param(
        [string]$Command,
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')"
    }
}

function Get-GitOutput {
    param([string[]]$Arguments)

    $result = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }

    return ($result -join [Environment]::NewLine).Trim()
}

function Get-OriginMainRelease {
    param(
        [string]$Branch,
        [string]$RequestedVersion,
        [int]$RequestedBuild
    )

    $sha = Get-GitOutput @("rev-parse", "origin/$Branch")
    $shortSha = Get-GitOutput @("rev-parse", "--short", "origin/$Branch")

    $spec = "origin/$Branch" + ":mobile/pubspec.yaml"
    $pubspecLines = & git show $spec
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read mobile/pubspec.yaml from origin/$Branch."
    }

    $pubspec = $pubspecLines -join [Environment]::NewLine
    $match = [regex]::Match(
        $pubspec,
        'version\s*:\s*(\d+\.\d+\.\d+)\+(\d+)'
    )

    if (-not $match.Success) {
        throw "Unable to parse release version from origin/$Branch."
    }

    $foundVersion = $match.Groups[1].Value
    $foundBuild = [int]$match.Groups[2].Value

    if ($foundVersion -ne $RequestedVersion) {
        throw "origin/$Branch is version $foundVersion+$foundBuild, not requested $RequestedVersion."
    }

    if (($RequestedBuild -gt 0) -and ($foundBuild -ne $RequestedBuild)) {
        throw "origin/$Branch build is $foundBuild, not requested $RequestedBuild."
    }

    return [PSCustomObject]@{
        Sha = $sha
        ShortSha = $shortSha
        Version = $foundVersion
        Build = $foundBuild
    }
}

function Invoke-ProductionDeploy {
    param(
        [string]$HostName,
        [int]$Port,
        [string]$IdentityFile,
        [string]$HealthUrl
    )

    if ([string]::IsNullOrWhiteSpace($HostName)) {
        throw "DeployHost is required."
    }

    Assert-Command "ssh"

    $sshArgs = @(
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=accept-new"
    )

    if ($Port -gt 0) {
        $sshArgs += @("-p", "$Port")
    }

    if (-not [string]::IsNullOrWhiteSpace($IdentityFile)) {
        if (-not (Test-Path -LiteralPath $IdentityFile)) {
            throw "Deploy identity file not found: $IdentityFile"
        }

        $sshArgs += @("-i", $IdentityFile)
    }

    $sshArgs += @($HostName, "deploy-release")

    Write-Host "Host : $HostName"
    Write-Host "Port : $Port"

    if (-not [string]::IsNullOrWhiteSpace($IdentityFile)) {
        Write-Host "Key  : $IdentityFile"
    }

    Invoke-Checked "ssh" $sshArgs

    if (-not [string]::IsNullOrWhiteSpace($HealthUrl)) {
        Assert-Command "curl.exe"

        Write-Step "PUBLIC HTTPS HEALTH CHECK"

        $curlArgs = @(
            "--fail",
            "--silent",
            "--show-error",
            "--max-time",
            "15",
            "--user-agent",
            "BowlingManagerReleaseCheck/1.0",
            $HealthUrl
        )

        $healthOutput = & curl.exe @curlArgs

        if ($LASTEXITCODE -ne 0) {
            throw "Public health check failed: $HealthUrl"
        }

        Write-Host "Public health: OK"
        Write-Host ($healthOutput -join [Environment]::NewLine)
    }
}

function Ensure-ReleaseTag {
    param(
        [string]$ReleaseVersion,
        [string]$ReleaseSha
    )

    $tagName = "v$ReleaseVersion"
    $tagRef = "refs/tags/$tagName"

    $directLines = @(& git ls-remote --tags origin $tagRef)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to query remote tag $tagName."
    }
    $direct = ($directLines -join [Environment]::NewLine).Trim()

    if ([string]::IsNullOrWhiteSpace($direct)) {
        Invoke-Checked "git" @(
            "tag",
            "-a",
            $tagName,
            $ReleaseSha,
            "-m",
            "BowlingManager $ReleaseVersion"
        )
        Invoke-Checked "git" @("push", "origin", $tagName)
        Write-Host "Tag pushed: $tagName"
        return
    }

    $peeledRef = $tagRef + "^{}"
    $peeledLines = @(& git ls-remote --tags origin $peeledRef)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to query peeled remote tag $tagName."
    }
    $peeled = ($peeledLines -join [Environment]::NewLine).Trim()

    if (-not [string]::IsNullOrWhiteSpace($peeled)) {
        $tagTarget = ($peeled -split "\s+")[0]
    }
    else {
        $tagTarget = ($direct -split "\s+")[0]
    }

    if ($tagTarget -ne $ReleaseSha) {
        throw "Remote tag '$tagName' already exists on another commit."
    }

    Write-Host "Tag already exists and matches: $tagName"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = (Get-Item -LiteralPath $repoRoot).FullName
Set-Location -LiteralPath $repoRoot

if ($TagOnly) {
    Write-Step "TAG-ONLY RESUME"

    Assert-Command "git"
    Invoke-Checked "git" @("fetch", "origin", "--prune")

    $release = Get-OriginMainRelease -Branch $MainBranch -RequestedVersion $Version -RequestedBuild $BuildNumber

    Write-Host "Main    : $($release.ShortSha)"
    Write-Host "Version : $($release.Version)+$($release.Build)"

    Ensure-ReleaseTag -ReleaseVersion $Version -ReleaseSha $release.Sha

    Write-Step "TAG-ONLY COMPLETE"
    Write-Host "Version : $($release.Version)+$($release.Build)"
    Write-Host "Commit  : $($release.ShortSha)"
    exit 0
}

if ($DeployOnly) {
    Write-Step "DEPLOY-ONLY RESUME"

    Assert-Command "git"
    Invoke-Checked "git" @("fetch", "origin", "--prune")

    $release = Get-OriginMainRelease -Branch $MainBranch -RequestedVersion $Version -RequestedBuild $BuildNumber

    Write-Host "Main    : $($release.ShortSha)"
    Write-Host "Version : $($release.Version)+$($release.Build)"

    Invoke-ProductionDeploy -HostName $DeployHost -Port $DeployPort -IdentityFile $DeployIdentityFile -HealthUrl $PublicHealthUrl

    if (-not $SkipTag) {
        Write-Step "RELEASE TAG"
        Ensure-ReleaseTag -ReleaseVersion $Version -ReleaseSha $release.Sha
    }

    Write-Step "DEPLOY-ONLY COMPLETE"
    Write-Host "Version : $($release.Version)+$($release.Build)"
    Write-Host "Commit  : $($release.ShortSha)"
    exit 0
}

Write-Step "1. RELEASE ENVIRONMENT CHECK"

Assert-Command "git"
Assert-Command "node"
Assert-Command "npm.cmd"
Assert-Command "flutter"

$nodeVersion = (node -v).Trim()
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")

if ($nodeMajor -ne 20) {
    throw "Node 20.x is required. Current: $nodeVersion"
}

Write-Host "Node    : $nodeVersion"
Write-Host "npm     : $((npm.cmd -v).Trim())"
Write-Host "Flutter : $((flutter --version | Select-Object -First 1).Trim())"
Write-Host "Repo    : $repoRoot"

Write-Step "2. DEVELOP BRANCH CHECK"

$currentBranch = Get-GitOutput @("branch", "--show-current")
if ($currentBranch -ne $DevelopBranch) {
    throw "Run this script from '$DevelopBranch'. Current: '$currentBranch'"
}

$initialStatus = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) {
    throw "Unable to read git status."
}

if ($initialStatus.Count -gt 0) {
    Write-Host ($initialStatus -join [Environment]::NewLine)
    throw "Working tree must be clean before release automation starts."
}

Invoke-Checked "git" @("fetch", "origin", "--prune")

$remoteDevelop = "origin/$DevelopBranch"
$remoteMain = "origin/$MainBranch"

Invoke-Checked "git" @("rev-parse", "--verify", $remoteDevelop)
Invoke-Checked "git" @("rev-parse", "--verify", $remoteMain)

$remoteAhead = [int](Get-GitOutput @("rev-list", "--count", "HEAD..$remoteDevelop"))
if ($remoteAhead -gt 0) {
    throw "Remote develop has commits not present locally. Run git pull --ff-only first."
}

Write-Host "Develop : $DevelopBranch"
Write-Host "Main    : $MainBranch"
Write-Host "HEAD    : $(Get-GitOutput @('rev-parse', '--short', 'HEAD'))"

Write-Step "3. SYNC MAIN INTO DEVELOP"

& git merge-base --is-ancestor $remoteMain HEAD
if ($LASTEXITCODE -eq 0) {
    Write-Host "origin/$MainBranch is already included."
}
else {
    Write-Host "Merging origin/$MainBranch into $DevelopBranch..."

    & git merge --no-edit $remoteMain
    if ($LASTEXITCODE -ne 0) {
        & git merge --abort 2>$null
        throw "Automatic main to develop merge failed. Resolve it manually."
    }
}

Write-Step "4. VERSION BUMP"

$pubspecPath = Join-Path $repoRoot "mobile\pubspec.yaml"
if (-not (Test-Path -LiteralPath $pubspecPath)) {
    throw "mobile/pubspec.yaml not found."
}

$pubspec = [System.IO.File]::ReadAllText($pubspecPath)
$versionMatch = [regex]::Match(
    $pubspec,
    '(?m)^version:[ \t]*(\d+\.\d+\.\d+)\+(\d+)[ \t]*$'
)

if (-not $versionMatch.Success) {
    throw "Unable to parse Flutter version."
}

$currentVersion = $versionMatch.Groups[1].Value
$currentBuild = [int]$versionMatch.Groups[2].Value

if ($BuildNumber -le 0) {
    $BuildNumber = $currentBuild + 1
}

if ($BuildNumber -le $currentBuild) {
    throw "BuildNumber must be greater than current build number $currentBuild."
}

$newVersionLine = "version: $Version+$BuildNumber"
$updatedPubspec = [regex]::Replace(
    $pubspec,
    '(?m)^version:[ \t]*\d+\.\d+\.\d+\+\d+[ \t]*$',
    $newVersionLine,
    1
)

[System.IO.File]::WriteAllText(
    $pubspecPath,
    $updatedPubspec,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Current : $currentVersion+$currentBuild"
Write-Host "Release : $Version+$BuildNumber"

Write-Step "5. NODE TEST AND BUILD"

Set-Location -LiteralPath $repoRoot
Invoke-Checked "npm.cmd" @("ci")

$nodeTests = @(
    Get-ChildItem (Join-Path $repoRoot "tests") -Filter "*.test.cjs" -File |
    Sort-Object FullName |
    ForEach-Object { $_.FullName }
)

if ($nodeTests.Count -eq 0) {
    throw "No tests/*.test.cjs files found."
}

Write-Host "Node test files: $($nodeTests.Count)"

& node --test @nodeTests
if ($LASTEXITCODE -ne 0) {
    throw "Node tests failed."
}

Invoke-Checked "npm.cmd" @("run", "build")

Write-Step "6. FLUTTER RELEASE GATE"

$mobileDir = Join-Path $repoRoot "mobile"
Set-Location -LiteralPath $mobileDir

Invoke-Checked "flutter" @("pub", "get")
Invoke-Checked "flutter" @("analyze")
Invoke-Checked "flutter" @("test")

Set-Location -LiteralPath $repoRoot

Write-Step "7. CHANGE SAFETY CHECK"

Invoke-Checked "git" @("diff", "--check")

$dirty = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect release changes."
}

$unexpected = @()

foreach ($line in $dirty) {
    if ($line.Length -lt 4) {
        $unexpected += $line
        continue
    }

    $path = $line.Substring(3).Trim()

    if ($path -ne "mobile/pubspec.yaml") {
        $unexpected += $line
    }
}

if ($unexpected.Count -gt 0) {
    Write-Host "Unexpected changes:"
    Write-Host ($unexpected -join [Environment]::NewLine)
    throw "Only mobile/pubspec.yaml may change during automated release."
}

Write-Step "8. VERSION COMMIT"

Invoke-Checked "git" @("add", "--", "mobile/pubspec.yaml")

$staged = Get-GitOutput @("diff", "--cached", "--name-only")
if ([string]::IsNullOrWhiteSpace($staged)) {
    throw "Nothing staged for release commit."
}

$commitMessage = "chore: bump mobile version to $Version+$BuildNumber"
Invoke-Checked "git" @("commit", "-m", $commitMessage)

$releaseSha = Get-GitOutput @("rev-parse", "HEAD")
$releaseShortSha = Get-GitOutput @("rev-parse", "--short", "HEAD")

Write-Host "Release commit: $releaseShortSha"

Write-Step "9. PUSH DEVELOP"

Invoke-Checked "git" @("push", "origin", "HEAD:$DevelopBranch")
Invoke-Checked "git" @("fetch", "origin", "--prune")

& git merge-base --is-ancestor "origin/$MainBranch" HEAD
if ($LASTEXITCODE -ne 0) {
    throw "origin/$MainBranch is not an ancestor of this release. Main update refused."
}

Write-Step "10. FAST-FORWARD MAIN"

Invoke-Checked "git" @("push", "origin", "HEAD:$MainBranch")
Write-Host "origin/$MainBranch -> $releaseShortSha"

if ($Deploy) {
    Write-Step "11. PRODUCTION DEPLOY"

    Invoke-ProductionDeploy -HostName $DeployHost -Port $DeployPort -IdentityFile $DeployIdentityFile -HealthUrl $PublicHealthUrl

    if (-not $SkipTag) {
        Write-Step "12. RELEASE TAG"
        Ensure-ReleaseTag -ReleaseVersion $Version -ReleaseSha $releaseSha
    }
}
else {
    Write-Step "11. PRODUCTION DEPLOY SKIPPED"
    Write-Host "main was updated but production deployment was not requested."
    Write-Host "Use -DeployOnly with the correct DeployHost and DeployPort to resume deployment."
}

Write-Step "RELEASE AUTOMATION COMPLETE"

Write-Host "Version : $Version+$BuildNumber"
Write-Host "Commit  : $releaseShortSha"
Write-Host "Develop : $DevelopBranch"
Write-Host "Main    : $MainBranch"
Write-Host "Deploy  : $Deploy"
