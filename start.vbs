Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\PC\Documents\BrowserProfileManager"
WshShell.Run "cmd /c ""C:\Users\PC\Documents\BrowserProfileManager\start.bat""", 0, False