@echo off
cd /d "C:\Users\Admin\Desktop\statscope\x-bot"
python x_bot.py auto >> logs\bot_%date:~0,4%%date:~5,2%%date:~8,2%.log 2>&1
