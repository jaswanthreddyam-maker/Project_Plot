Set-StrictMode -Version Latest
$ErrorActionPreference = "SilentlyContinue"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

# Protect the current script process tree so dev:clean doesn't kill itself.
$protectedPids = @{}
$cursorPid = $PID
while ($cursorPid -and -not $protectedPids.ContainsKey($cursorPid)) {
    $protectedPids[$cursorPid] = $true
    $cursorProc = Get-CimInstance Win32_Process -Filter "ProcessId = $cursorPid"
    if ($null -eq $cursorProc) { break }
    $cursorPid = [int]$cursorProc.ParentProcessId
}

# Kill stale node/python dev processes.
$staleProcesses = Get-CimInstance Win32_Process | Where-Object {
    if (-not $_.CommandLine) { return $false }
    $cmd = $_.CommandLine

    $isNodeDev =
        $_.Name -ieq "node.exe" -and (
            $cmd -like "*node_modules*next*start-server.js*" -or
            $cmd -like "*next*dist*bin*next* dev*" -or
            $cmd -like "*concurrently*dist*bin*concurrently.js*--kill-others*"
        )

    $isPythonDev =
        $_.Name -ieq "python.exe" -and (
            $cmd -like "*-m uvicorn backend.main:app*" -or
            $cmd -like "*-m celery -A backend.worker.celery_app worker*" -or
            ($cmd -like "*from billiard.spawn import spawn_main*" -and $cmd -like "*plot*.venv*Scripts*python.exe*")
        )

    ($isNodeDev -or $isPythonDev) -and -not $protectedPids.ContainsKey($_.ProcessId)
}

foreach ($proc in $staleProcesses) {
    Stop-Process -Id $proc.ProcessId -Force
}

# Force-clear any remaining node/python listeners on the dev ports.
$devPortPids = netstat -ano -p tcp |
    Select-String -Pattern ":3000|:8000" |
    ForEach-Object { ($_ -split "\s+")[-1] } |
    Where-Object { $_ -match "^\d+$" } |
    Sort-Object -Unique

foreach ($pid in $devPortPids) {
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc -and ($proc.ProcessName -eq "node" -or $proc.ProcessName -eq "python")) {
        Stop-Process -Id $pid -Force
    }
}

# Remove stale Next.js lock files that can block startup.
$lockPaths = @(
    (Join-Path $repoRoot ".next\dev\lock"),
    (Join-Path $repoRoot "frontend\.next\dev\lock")
)

foreach ($lockPath in $lockPaths) {
    if (Test-Path $lockPath) {
        Remove-Item $lockPath -Force
    }
}

Write-Output "dev-clean complete"
