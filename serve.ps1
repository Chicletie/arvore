param([int]$Port = 8934)
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/arvore/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$Port/arvore/"
$mime = @{ ".html"="text/html"; ".js"="application/javascript"; ".css"="text/css"; ".json"="application/json"; ".svg"="image/svg+xml"; ".webmanifest"="application/manifest+json" }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $reqPath = $ctx.Request.Url.AbsolutePath -replace '^/arvore/', ''
  if ($reqPath -eq "") { $reqPath = "index.html" }
  $full = Join-Path $root $reqPath
  if (-not (Test-Path $full) -or (Get-Item $full).PSIsContainer) {
    $full = Join-Path $root "404.html"
    $ctx.Response.StatusCode = 404
  }
  $ext = [System.IO.Path]::GetExtension($full)
  $ctx.Response.ContentType = $mime[$ext]
  if (-not $ctx.Response.ContentType) { $ctx.Response.ContentType = "application/octet-stream" }
  $bytes = [System.IO.File]::ReadAllBytes($full)
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.OutputStream.Close()
}
