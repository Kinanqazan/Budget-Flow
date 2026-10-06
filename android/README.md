# BudgetFlow Android APK

This project builds a signed Android APK that asks for the BudgetFlow server address when opened, then loads the existing web app inside Android System WebView. The server address is remembered on the device and can be changed from the app's top bar. The APK does not contain the API or database.

## Build

Run in PowerShell:

```powershell
.\android\build-apk.ps1
```

The script builds the APK without asking for a server address. The first time you open BudgetFlow on the phone, enter its HTTPS address (for example, `https://budget.example.com`) and sign in normally.

APK output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## Private or self-signed certificates

The APK trusts Android's system certificate authorities and user-installed certificates. Install the certificate authority that signed the server certificate in Android's security settings before connecting. TLS verification remains enabled: the certificate must be valid for the hostname in the address. The app blocks plain HTTP and mixed-content requests.

Android must have a working WebView provider. The APK does not launch the Chrome browser app, but it uses Android's WebView system component rather than bundling a browser engine.

## Signing key

The first build creates `android/budgetflow-release.jks` and `android/keystore.properties`. Keep secure backups of both files: later builds need this same signing key to update an existing installation. These files are ignored by Git and must not be shared or committed.
