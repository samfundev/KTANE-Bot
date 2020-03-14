net stop "ktanediscordbot.exe"
git pull upstream master --rebase
call npm install
net start "ktanediscordbot.exe"