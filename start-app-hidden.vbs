Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\PC\Documents\BrowserProfileManager"
WshShell.Run "cmd /c npm run dev", 0, False
