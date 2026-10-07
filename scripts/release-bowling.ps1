param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [int]$BuildNumber = 0,
    [switch]$Deploy,
    [switch]$SkipTag,
    [string]$DevelopBranch = "codex/develop-1.2.0",
    [string]$MainBranch = "main",
    [string]$DeployHost = "user@vm-share"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Step([string]$Message) {
    Write-Host ""
    Write-Host "============================================================"
    Write-Host $Message
    Write-Host "============================================================"
}

function Need([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

function Run([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')"
    }
}

function GitOut([string[]]$Arguments) {
    $result = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }
    return ($result -join [Environment]::NewLine).Trim()
}

Step "1. RELEASE ENVIRONMENT CHECK"

Need "git"
Need "node"
Need "npm.cmd"
Need "flutter"

$nodeVersion = (node -v).Trim()
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")

if ($nodeMajor -ne 20) {
    throw "Node 20.x is required. Current: $nodeVersion"
}

Write-Host "Node    : $nodeVersion"
Write-Host "npm     : $((npm.cmd -v).Trim())"
Write-Host "Flutter : $((flutter --version | Select-Object -First 1).Trim())"

$repoRoot = GitOut @("rev-parse", "--show-toplevel")
Set-Location $repoRoot

Write-Host "Repo    : $repoRoot"

Step "2. DEVELOP BRANCH CHECK"

$currentBranch = GitOut @("branch", "--show-current")
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

Run "git" @("fetch", "origin", "--prune")

$remoteDevelop = "origin/$DevelopBranch"
$remoteMain = "origin/$MainBranch"

Run "git" @("rev-parse", "--verify", $remoteDevelop)
Run "git" @("rev-parse", "--verify", $remoteMain)

$remoteAhead = [int](GitOut @("rev-list", "--count", "HEAD..$remoteDevelop"))
if ($remoteAhead -gt 0) {
    throw "Remote develop has commits not present locally. Run git pull --ff-only first."
}

Write-Host "Develop : $DevelopBranch"
Write-Host "Main    : $MainBranch"
Write-Host "HEAD    : $(GitOut @('rev-parse', '--short', 'HEAD'))"

Step "3. SYNC MAIN INTO DEVELOP"

& git merge-base --is-ancestor $remoteMain HEAD
if ($LASTEXITCODE -eq 0) {
    Write-Host "origin/$MainBranch is already included."
}
else {
    Write-Host "Merging origin/$MainBranch into $DevelopBranch..."
    & git merge --no-edit $remoteMain
    if ($LASTEXITCODE -ne 0) {
        & git merge --abort 2>$null
        throw "Automatic main -> develop merge failed. Resolve it manually."
    }
}

Step "4. VERSION BUMP"

$pubspecPath = Join-Path $repoRoot "mobile\pubspec.yaml"
if (-not (Test-Path $pubspecPath)) {
    throw "mobile/pubspec.yaml not found."
}

$pubspec = [System.IO.File]::ReadAllText($pubspecPath)
$versionMatch = [regex]::Match($pubspec, '(?m)^version:\s*(\d+\.\d+\.\d+)\+(\d+)\s*$')

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
$updated = [regex]::Replace(
    $pubspec,
    '(?m)^version:\s*\d+\.\d+\.\d+\+\d+\s*$',
    $newVersionLine,
    1
)

[System.IO.File]::WriteAllText(
    $pubspecPath,
    $updated,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Current : $currentVersion+$currentBuild"
Write-Host "Release : $Version+$BuildNumber"

Step "5. NODE TEST AND BUILD"

Set-Location $repoRoot
Run "npm.cmd" @("ci")

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

Run "npm.cmd" @("run", "build")

Step "6. FLUTTER RELEASE GATE"

$mobileDir = Join-Path $repoRoot "mobile"
Set-Location $mobileDir

Run "flutter" @("pub", "get")
Run "flutter" @("analyze")
Run "flutter" @("test")

Set-Location $repoRoot

Step "7. CHANGE SAFETY CHECK"

Run "git" @("diff", "--check")

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

Step "8. VERSION COMMIT"

Run "git" @("add", "--", "mobile/pubspec.yaml")
$staged = GitOut @("diff", "--cached", "--name-only")

if ([string]::IsNullOrWhiteSpace($staged)) {
    throw "Nothing staged for release commit."
}

$commitMessage = "chore: bump mobile version to $Version+$BuildNumber"
Run "git" @("commit", "-m", $commitMessage)

$releaseSha = GitOut @("rev-parse", "HEAD")
$releaseShortSha = GitOut @("rev-parse", "--short", "HEAD")

Write-Host "Release commit: $releaseShortSha"

Step "9. PUSH DEVELOP"

Run "git" @("push", "origin", "HEAD:$DevelopBranch")
Run "git" @("fetch", "origin", "--prune")

& git merge-base --is-ancestor "origin/$MainBranch" HEAD
if ($LASTEXITCODE -ne 0) {
    throw "origin/$MainBranch is not an ancestor of this release. Main update refused."
}

Step "10. FAST-FORWARD MAIN"

Run "git" @("push", "origin", "HEAD:$MainBranch")
Write-Host "origin/$MainBranch -> $releaseShortSha"

if ($Deploy) {
    Step "11. PRODUCTION DEPLOY"

    Need "ssh"
    Write-Host "Host: $DeployHost"

    Run "ssh" @(
        $DeployHost,
        "~/deploy-bowling.sh --check && ~/deploy-bowling.sh"
    )

    if (-not $SkipTag) {
        Step "12. RELEASE TAG"

        $tagName = "v$Version"
        $remoteTag = (& git ls-remote --tags origin "refs/tags/$tagName").Trim()

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to check remote tag $tagName."
        }

        if (-not [string]::IsNullOrWhiteSpace($remoteTag)) {
            throw "Remote tag '$tagName' already exists."
        }

        Run "git" @("tag", "-a", $tagName, $releaseSha, "-m", "BowlingManager $Version")
        Run "git" @("push", "origin", $tagName)

        Write-Host "Tag: $tagName"
    }
}
else {
    Step "11. PRODUCTION DEPLOY SKIPPED"
    Write-Host "main was updated but SSH deployment was not requested."
    Write-Host "Run production deployment separately:"
    Write-Host "ssh $DeployHost '~/deploy-bowling.sh --check && ~/deploy-bowling.sh'"
}

Step "RELEASE AUTOMATION COMPLETE"

Write-Host "Version : $Version+$BuildNumber"
Write-Host "Commit  : $releaseShortSha"
Write-Host "Develop : $DevelopBranch"
Write-Host "Main    : $MainBranch"
Write-Host "Deploy  : $Deploy"
