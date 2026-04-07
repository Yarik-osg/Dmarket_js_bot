!macro customInit
  nsExec::ExecToStack `taskkill /f /im "${PRODUCT_FILENAME}.exe"`
  Pop $0
  Pop $1
  Sleep 3000

  ; Retry in case child processes are still running
  nsExec::ExecToStack `taskkill /f /im "${PRODUCT_FILENAME}.exe"`
  Pop $0
  Pop $1
  Sleep 2000
!macroend
