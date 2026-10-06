$ErrorActionPreference = 'Stop'
$androidRoot = $PSScriptRoot
$keystorePath = Join-Path $androidRoot 'budgetflow-release.jks'
$propertiesPath = Join-Path $androidRoot 'keystore.properties'
$keyAlias = 'budgetflow-release'

$jdkRoot = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { Join-Path $env:USERPROFILE '.bubblewrap\jdk\jdk-17.0.11+9' }
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:USERPROFILE '.bubblewrap\android_sdk' }
if (-not (Test-Path -LiteralPath (Join-Path $jdkRoot 'bin\java.exe'))) {
    throw "Java 17 was not found at $jdkRoot. Set JAVA_HOME to a Java 17 installation."
}
if (-not (Test-Path -LiteralPath (Join-Path $sdkRoot 'platforms\android-35\android.jar'))) {
    throw "Android SDK platform 35 was not found at $sdkRoot. Set ANDROID_HOME to an installed Android SDK."
}

$env:JAVA_HOME = $jdkRoot
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$gradleHome = if ($env:BUDGETFLOW_GRADLE_HOME) {
    [System.IO.Path]::GetFullPath($env:BUDGETFLOW_GRADLE_HOME)
} else {
    Join-Path $env:TEMP 'budgetflow-gradle-home'
}
$env:GRADLE_USER_HOME = $gradleHome
$env:PATH = "$(Join-Path $jdkRoot 'bin');$(Join-Path $sdkRoot 'platform-tools');$env:PATH"

$cachedDistribution = Join-Path $env:USERPROFILE '.gradle\wrapper\dists\gradle-8.11.1-bin'
$projectDistributions = Join-Path $env:GRADLE_USER_HOME 'wrapper\dists'
if ((Test-Path -LiteralPath $cachedDistribution) -and -not (Test-Path -LiteralPath (Join-Path $projectDistributions 'gradle-8.11.1-bin'))) {
    New-Item -ItemType Directory -Path $projectDistributions -Force | Out-Null
    Copy-Item -LiteralPath $cachedDistribution -Destination $projectDistributions -Recurse
}

if (-not (Test-Path -LiteralPath $keystorePath)) {
    $randomBytes = [byte[]]::new(24)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
    $password = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', 'A').Replace('/', 'B')
    $keytool = Join-Path $jdkRoot 'bin\keytool.exe'
    & $keytool -genkeypair -v -keystore $keystorePath -storepass $password -keypass $password -alias $keyAlias -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=BudgetFlow Release' | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not create the release signing key.'
    }
    @(
        'storeFile=budgetflow-release.jks'
        "storePassword=$password"
        "keyAlias=$keyAlias"
        "keyPassword=$password"
    ) | Set-Content -LiteralPath $propertiesPath -Encoding ASCII
    [Array]::Clear($randomBytes, 0, $randomBytes.Length)
    $password = $null
}
if (-not (Test-Path -LiteralPath $propertiesPath)) {
    throw 'The signing properties file is missing. Restore it from backup; creating a new one would prevent updating an already installed APK.'
}

Push-Location $androidRoot
try {
    & .\gradlew.bat assembleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Gradle failed to build the APK.' }
} finally {
    Pop-Location
}

$apkPath = Join-Path $androidRoot 'app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $apkPath)) { throw 'Gradle completed but the expected APK was not created.' }
Write-Output "APK: $apkPath"
