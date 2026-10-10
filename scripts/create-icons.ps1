Add-Type -AssemblyName System.Drawing
foreach ($size in @(32,180,192,512)) {
 $bitmap=New-Object System.Drawing.Bitmap($size,$size)
 $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
 $graphics.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#294e40'))
 $pen=New-Object System.Drawing.Pen([System.Drawing.Color]::White,($size*4/64))
 $pen.StartCap=[System.Drawing.Drawing2D.LineCap]::Round
 $pen.EndCap=[System.Drawing.Drawing2D.LineCap]::Round
 $graphics.DrawEllipse($pen,($size*15/64),($size*15/64),($size*34/64),($size*34/64))
 $graphics.DrawLine($pen,($size*32/64),($size*21/64),($size*32/64),($size*33/64))
 $graphics.DrawLine($pen,($size*32/64),($size*33/64),($size*40/64),($size*38/64))
 $background=New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#294e40'))
 $accent=New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#b9f483'))
 $graphics.FillEllipse($background,($size*39/64),($size*13/64),($size*12/64),($size*12/64))
 $graphics.FillEllipse($accent,($size*41.5/64),($size*15.5/64),($size*7/64),($size*7/64))
 $name=if($size -eq 32){'favicon.png'}elseif($size -eq 180){'apple-touch-icon.png'}else{"icon-$size.png"}
 $bitmap.Save((Join-Path (Get-Location) "public/$name"),[System.Drawing.Imaging.ImageFormat]::Png)
 $accent.Dispose(); $background.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
