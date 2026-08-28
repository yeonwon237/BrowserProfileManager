$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("C:\Users\PC\Desktop\Browser Profile Manager.lnk")
$Shortcut.TargetPath = "C:\Users\PC\Documents\BrowserProfileManager\start-app.bat"
$Shortcut.WorkingDirectory = "C:\Users\PC\Documents\BrowserProfileManager"
$Shortcut.Description = "Browser Profile Manager"
$Shortcut.Save()
Write-Host "Shortcut created successfully"
