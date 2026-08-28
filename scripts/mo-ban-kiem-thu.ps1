$ErrorActionPreference = 'Stop'

$projectDirectory = Split-Path -Parent $PSScriptRoot

# Khởi chạy máy chủ giao diện và ứng dụng Electron từ mã nguồn mới nhất.
# Cửa sổ lệnh được ẩn để người dùng chỉ nhìn thấy ứng dụng YNlogin.
Start-Process `
  -FilePath 'npm.cmd' `
  -ArgumentList @('run', 'dev') `
  -WorkingDirectory $projectDirectory `
  -WindowStyle Hidden

