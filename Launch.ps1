[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$installRoot = Join-Path $env:LOCALAPPDATA 'AdSkipForSpotify'
$pathFile = Join-Path $installRoot 'spotify-path.txt'
$spotifyExe = if (Test-Path -LiteralPath $pathFile) { (Get-Content -LiteralPath $pathFile -Raw).Trim() } else { Join-Path $env:APPDATA 'Spotify/Spotify.exe' }
if (!(Test-Path -LiteralPath $spotifyExe -PathType Leaf) -or [IO.Path]::GetFileName($spotifyExe) -ne 'Spotify.exe') {
    throw 'Spotify was not found. Run Install.cmd first.'
}
$flags = @('--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows')
$running = @(Get-CimInstance Win32_Process -Filter "Name='Spotify.exe'" | Where-Object { $_.ExecutablePath -eq $spotifyExe })
$main = $running | Where-Object { $_.CommandLine -notmatch '--type=' } | Select-Object -First 1
$configured = $null -ne $main
foreach ($flag in $flags) { if (!$main -or !$main.CommandLine.Contains($flag)) { $configured = $false } }
if ($running.Count -gt 0 -and !$configured) {
    Write-Host 'Restarting Spotify to enable background playback automation...'
    $running | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
    $running | ForEach-Object { Wait-Process -Id $_.ProcessId -Timeout 10 -ErrorAction SilentlyContinue }
}
Start-Process -FilePath $spotifyExe -ArgumentList $flags -WindowStyle Normal
