; Neurotek Studio -- custom NSIS hooks
; Checks for running instance before install and cleans up AppData on uninstall.

!macro customInstall
  ; Kill any running instance before installation
  ExecWait '"taskkill" /F /IM "Neurotek Studio.exe" /T' $0
  Sleep 500
!macroend

!macro customUnInstall
  ; Ask user if they want to keep their project data
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you want to delete your Neurotek Studio project data and settings?$\n$\nClick Yes to remove all data, No to keep it." \
    IDNO keepData

  RMDir /r "$APPDATA\Neurotek Studio"
  RMDir /r "$LOCALAPPDATA\Neurotek Studio"
  DeleteRegKey HKCU "Software\Neurotek Studio"

  keepData:
!macroend
