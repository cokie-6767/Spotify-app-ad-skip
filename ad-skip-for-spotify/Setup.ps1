[CmdletBinding()]
param([ValidateSet('Install','Remove')][string]$Mode = 'Install', [switch]$NoDownload)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$installRoot = Join-Path $env:LOCALAPPDATA 'AdSkipForSpotify'
$toolRoot = Join-Path $installRoot 'spicetify-2.45.1'
$extensionName = 'ad-skip.js'

function Invoke-Spice {
    param([string[]]$SpiceArgs)
    & $script:spiceExe @SpiceArgs
    if ($LASTEXITCODE -ne 0) { throw "Spicetify failed (exit $LASTEXITCODE): $($SpiceArgs -join ' ')" }
}

try {
    $existingCommand = Get-Command spicetify -CommandType Application -ErrorAction SilentlyContinue
    if ($existingCommand) { $script:spiceExe = $existingCommand.Source }
    else { $script:spiceExe = Join-Path $toolRoot 'spicetify.exe' }
    if (!(Test-Path -LiteralPath $script:spiceExe)) {
        if ($Mode -eq 'Remove' -or $NoDownload) { throw 'Spicetify is not installed.' }
        if (![Environment]::Is64BitOperatingSystem) { throw 'This installer requires 64-bit Windows.' }
        $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
        $expectedHash = if ($arch -eq 'arm64') { '603fc657bbfafc77878ce9ef300d051f553ef1f6a27cf2f5c3b1dff749a6e475' } else { 'bf2bbb299ec1b7607d62e215afcf0cb5c3a6863e26723367e7cc575ef964bfb3' }
        New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
        $archive = Join-Path $installRoot "spicetify-2.45.1-$arch.zip"
        Write-Host 'Downloading official Spicetify 2.45.1...'
        Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/spicetify/cli/releases/download/v2.45.1/spicetify-2.45.1-windows-$arch.zip" -OutFile $archive
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Download integrity check failed. Nothing has been applied to Spotify.' }
        Expand-Archive -LiteralPath $archive -DestinationPath $toolRoot -Force
    }
    $configOutput = & $script:spiceExe -c
    if ($LASTEXITCODE -ne 0) { throw 'Unable to find Spicetify configuration.' }
    $configFile = ($configOutput | Where-Object { $_ -match '\.ini\s*$' } | Select-Object -Last 1).Trim()
    if (!$configFile -or ![IO.Path]::IsPathRooted($configFile)) { throw 'Unexpected Spicetify configuration path.' }
    $configRoot = Split-Path -Parent $configFile
    New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
    if (Test-Path -LiteralPath $configFile) {
        $backupFile = Join-Path $installRoot ('config-before-' + $Mode.ToLowerInvariant() + '-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff') + '.ini')
        Copy-Item -LiteralPath $configFile -Destination $backupFile
    }
    if ($Mode -eq 'Remove') {
        Invoke-Spice -SpiceArgs @('config','extensions',"$extensionName-")
        Invoke-Spice -SpiceArgs @('apply','--no-restart')
        Write-Host 'Ad Skip disabled. Restart Spotify to finish. Other extensions remain configured.'
        exit 0
    }
    $sourceFile = Join-Path $PSScriptRoot $extensionName
    if (!(Test-Path -LiteralPath $sourceFile)) { throw 'Extract the whole ZIP before running Install.cmd.' }
    Write-Host 'Backing up Spotify with Spicetify...'
    if (!(Test-Path -LiteralPath $configFile)) { Invoke-Spice -SpiceArgs @('backup') }
    $configLines = Get-Content -LiteralPath $configFile
    $pathLine = $configLines | Where-Object { $_ -match '^\s*spotify_path\s*=' } | Select-Object -First 1
    $currentSpotifyExe = Join-Path (($pathLine -replace '^\s*spotify_path\s*=\s*','').Trim()) 'Spotify.exe'
    $fileVersion = (Get-Item -LiteralPath $currentSpotifyExe).VersionInfo.FileVersion
    $backupVersionLine = $configLines | Where-Object { $_ -match '^\s*version\s*=' } | Select-Object -Last 1
    $backupVersion = ($backupVersionLine -replace '^\s*version\s*=\s*','').Trim()
    $sameVersion = $fileVersion -and ($backupVersion -eq $fileVersion -or $backupVersion.StartsWith($fileVersion + '.'))
    if ($sameVersion -and (Test-Path -LiteralPath (Join-Path $configRoot 'Backup/xpui.spa'))) {
        Write-Host 'Reusing the existing backup for this Spotify version.'
    } else { Invoke-Spice -SpiceArgs @('backup') }
    $extensionsRoot = Join-Path $configRoot 'Extensions'
    New-Item -ItemType Directory -Force -Path $extensionsRoot | Out-Null
    $destination = Join-Path $extensionsRoot $extensionName
    if (Test-Path -LiteralPath $destination) {
        Copy-Item -LiteralPath $destination -Destination (Join-Path $installRoot ('ad-skip-before-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff') + '.js'))
    }
    Copy-Item -LiteralPath $sourceFile -Destination $destination -Force
    Invoke-Spice -SpiceArgs @('config','extensions',$extensionName)
    Invoke-Spice -SpiceArgs @('apply','--no-restart')
    $spotifyPathLine = Get-Content -LiteralPath $configFile | Where-Object { $_ -match '^\s*spotify_path\s*=' } | Select-Object -First 1
    $spotifyFolder = ($spotifyPathLine -replace '^\s*spotify_path\s*=\s*','').Trim()
    $spotifyExe = Join-Path $spotifyFolder 'Spotify.exe'
    if (!(Test-Path -LiteralPath $spotifyExe -PathType Leaf)) { throw 'Spotify executable was not found for the background launcher.' }
    Set-Content -LiteralPath (Join-Path $installRoot 'spotify-path.txt') -Value $spotifyExe -Encoding UTF8
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Launch.ps1') -Destination (Join-Path $installRoot 'Launch.ps1') -Force
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Programs')) 'Ad Skip for Spotify.lnk'))
    $shortcut.TargetPath = $spotifyExe
    $shortcut.Arguments = '--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows'
    $shortcut.WorkingDirectory = Split-Path -Parent $spotifyExe
    $shortcut.WindowStyle = 1
    $shortcut.IconLocation = "$spotifyExe,0"
    $shortcut.Description = 'Start Spotify with background timer throttling disabled'
    $shortcut.Save()
    Write-Host 'Installed Ad Skip for Spotify. Start it from the Start menu or run Start-Spotify.cmd.'
    Write-Host 'Settings: on/off only. Fixed at 2 seconds. Drag the gear button to move it.'
} catch {
    Write-Host ('Setup failed: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'No success is assumed. Keep this message when requesting help.'
    exit 1
}
