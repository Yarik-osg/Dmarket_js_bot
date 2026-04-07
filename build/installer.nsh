!macro customInit
  nsExec::ExecToStack `taskkill /f /im "${PRODUCT_FILENAME}.exe"`
  Pop $0
  Pop $1
  Sleep 1000
!macroend
