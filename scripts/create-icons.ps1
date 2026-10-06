Add-Type -AssemblyName System.Drawing
foreach ($size in @(192,512)) {
 $bitmap=New-Object System.Drawing.Bitmap($size,$size)
 $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
 $graphics.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#294e40'))
 $pen=New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#eef4e9'),($size*0.055))
 $pen.StartCap=[System.Drawing.Drawing2D.LineCap]::Round
 $pen.EndCap=[System.Drawing.Drawing2D.LineCap]::Round
 $graphics.DrawEllipse($pen,($size*.24),($size*.24),($size*.52),($size*.52))
 $graphics.DrawLine($pen,($size*.5),($size*.35),($size*.5),($size*.51))
 $graphics.DrawLine($pen,($size*.5),($size*.51),($size*.62),($size*.58))
 $bitmap.Save((Join-Path (Get-Location) "public/icon-$size.png"),[System.Drawing.Imaging.ImageFormat]::Png)
 $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
