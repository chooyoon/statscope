Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Admin\Desktop\statscope\x-bot"
WshShell.Run "cmd /c run_bot.bat", 0, False
