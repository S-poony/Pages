
$url = "https://content.lojkine.art/api/flipbook"
$body = Get-Content -Raw "test/test-api.json"

Write-Host "Starting rate limit test (5 requests should succeed, 6th should fail)..."
Write-Host "URL: $url"

for ($i = 1; $i -le 6; $i++) {
    Write-Host "`nRequest #$i..." -NoNewline
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json" -Headers @{ "X-API-Key" = "dummy" }
        Write-Host " SUCCESS" -ForegroundColor Green
        Write-Host "URL: $($response.url)"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host " FAILED (Status: $statusCode)" -ForegroundColor Red
        Write-Host "Error: $($errorBody.error)"
        
        if ($statusCode -eq 429) {
            Write-Host "Rate limit successfully triggered!" -ForegroundColor Cyan
        }
    }
}
