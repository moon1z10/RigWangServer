del dist\* /Q
CALL npm run build
@REM pkg --targets node10-win-x64 --compress GZip server.js

ren dist\RigWangServer-win.exe RigWangServer.exe
ren dist\RigWangServer-linux RigWangServer-linux-x64

"C:\Program Files\Bandizip\Bandizip.exe" c "C:\Users\Alex\Documents\Develop\Rig Wang\Server\dist\RigWangServer_Win64.zip" "C:\Users\Alex\Documents\Develop\Rig Wang\Server\dist\RigWangServer.exe" "C:\Users\Alex\Documents\Develop\Rig Wang\Server\config\" "C:\Users\Alex\Documents\Develop\Rig Wang\Server\blacklist.txt" "C:\Users\Alex\Documents\Develop\Rig Wang\Server\run.bat"
"C:\Program Files\Bandizip\Bandizip.exe" c "C:\Users\Alex\Documents\Develop\Rig Wang\Server\dist\RigWangServer_Linux64.zip" "C:\Users\Alex\Documents\Develop\Rig Wang\Server\dist\RigWangServer-linux-x64" "C:\Users\Alex\Documents\Develop\Rig Wang\Server\config\" "C:\Users\Alex\Documents\Develop\Rig Wang\Server\blacklist.txt"

pause