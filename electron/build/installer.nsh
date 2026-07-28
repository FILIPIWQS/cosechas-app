!macro customUnInstall
  ; Remove o registro de "abrir com o Windows" que o próprio app cria em
  ; tempo de execução (app.setLoginItemSettings) — o NSIS não sabe dessa
  ; chave sozinho, porque ela não foi escrita por ele durante a instalação.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Siembras Etiquetas"
!macroend
