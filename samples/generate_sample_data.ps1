param(
    [int]$RowCount = 500000,
    [string]$OutputFile = "samples/sales_500k.csv"
)

Write-Host "Generating $RowCount rows to $OutputFile..."
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$regions = @("North America", "Europe", "Asia-Pacific", "Latin America")
$categories = @("Electronics", "Furniture", "Office Supplies", "Apparel", "Home Appliances")
$reps = @("Alice Johnson", "Bob Smith", "Charlie Brown", "Diana Prince", "Evan Wright", "Fiona Gallagher", "George Clark")
$statuses = @("Completed", "Pending", "Processing", "Shipped")

$sb = [System.Text.StringBuilder]::new(50 * 1024 * 1024)
[void]$sb.AppendLine("TransactionId,Region,Category,SalesRep,Quantity,Revenue,Cost,Status,TransactionDate")

$rand = [System.Random]::new(12345)

for ($i = 1; $i -le $RowCount; $i++) {
    $r = $regions[$rand.Next($regions.Length)]
    $c = $categories[$rand.Next($categories.Length)]
    $rep = $reps[$rand.Next($reps.Length)]
    $st = $statuses[$rand.Next($statuses.Length)]
    $qty = $rand.Next(1, 100)
    $unitPrice = [Math]::Round($rand.NextDouble() * 200 + 15, 2)
    $rev = [Math]::Round($qty * $unitPrice, 2)
    $cost = [Math]::Round($rev * (0.45 + $rand.NextDouble() * 0.25), 2)
    $month = $rand.Next(1, 12).ToString("00")
    $day = $rand.Next(1, 28).ToString("00")
    $date = "2025-$month-$day"

    [void]$sb.AppendLine("$i,$r,$c,$rep,$qty,$rev,$cost,$st,$date")

    if ($i % 100000 -eq 0) {
        Write-Host "Generated $i rows..."
    }
}

[System.IO.File]::WriteAllText($OutputFile, $sb.ToString(), [System.Text.Encoding]::UTF8)
$sw.Stop()
Write-Host "Done! Generated $RowCount rows in $($sw.ElapsedMilliseconds)ms at $OutputFile"
