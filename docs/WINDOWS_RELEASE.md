# Windows release

YNlogin has two explicit Windows packaging pipelines:

- `npm run build` creates a reproducible unsigned NSIS installer for internal QA while retaining executable icon, version metadata, and ASAR integrity resources.
- `npm run build:signed` is the public-release gate. It refuses to start unless `CSC_LINK` is present and delegates Authenticode signing to electron-builder. Use `CSC_KEY_PASSWORD` when the certificate requires it.

Before publishing, verify the installer with:

```powershell
Get-AuthenticodeSignature .\release\YNlogin-Setup-1.2.0-x64.exe
Get-FileHash .\release\YNlogin-Setup-1.2.0-x64.exe -Algorithm SHA256
```

The public release is acceptable only when `Get-AuthenticodeSignature` reports `Valid`. Keep the certificate and password outside the repository and CI logs.
