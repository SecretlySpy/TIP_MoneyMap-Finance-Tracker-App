param(
    [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'MoneyMap_Laboratory_Activity_4.1_Documentation.docx'),
    [switch]$ScreenshotOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Word COM constants used by the report builder.
$wdAlignParagraphLeft = 0
$wdAlignParagraphCenter = 1
$wdAlignParagraphRight = 2
$wdCollapseEnd = 0
$wdPageBreak = 7
$wdSectionBreakNextPage = 2
$wdStyleNormal = -1
$wdStyleHeading1 = -2
$wdStyleHeading2 = -3
$wdStyleHeading3 = -4
$wdFieldPage = 33
$wdFieldNumPages = 26
$wdFormatDocumentDefault = 16
$wdAutoFitWindow = 2
$wdLineStyleSingle = 1

# Resolve stable project and evidence paths before Word is started.
$projectRoot = Split-Path -Parent $PSScriptRoot
$tempRoot = 'C:\Users\Kim Chim\AppData\Local\Temp\MoneyMapLab41'
$figmaImages = @{
    Dashboard = Join-Path $tempRoot 'figma-dashboard.png'
    Entry = Join-Path $tempRoot 'figma-entry.png'
    History = Join-Path $tempRoot 'figma-history.png'
    Budgets = Join-Path $tempRoot 'figma-budgets.png'
}
$appImages = @{
    Dashboard = Join-Path $tempRoot 'app-crops\app-dashboard-crop.png'
    Entry = Join-Path $tempRoot 'app-crops\app-entry-crop.png'
    History = Join-Path $tempRoot 'app-crops\app-history-crop.png'
    Budgets = Join-Path $tempRoot 'app-crops\app-budgets-crop.png'
}
$codeImage = Join-Path $tempRoot 'code-root-navigator.png'

# Render an exact source excerpt in an Android Studio-style editor frame without altering the code text.
function New-CodeScreenshot {
    param(
        [string]$SourcePath,
        [string]$DestinationPath
    )

    $chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
    if (-not (Test-Path -LiteralPath $chromePath)) {
        throw "Chrome is required to render the code screenshot: $chromePath"
    }

    $sourceLines = Get-Content -LiteralPath $SourcePath

    # Locate stable explanatory comments instead of assuming that future edits keep fixed line numbers.
    function Find-SourceLine {
        param([Parameter(Mandatory = $true)][string]$ExactText)

        for ($index = 0; $index -lt $sourceLines.Count; $index++) {
            if ($sourceLines[$index] -eq $ExactText) {
                return $index + 1
            }
        }
        throw "Required source marker not found in ${SourcePath}: $ExactText"
    }

    # Capture the navigator-factory/Home block and the final bottom-tab registrations.
    $firstStart = Find-SourceLine -ExactText '// Give each feature area its own stack so screens can push details or editors'
    $historyComment = Find-SourceLine -ExactText '// Keep transaction review, detail, and edit screens in one history workflow.'
    $firstEnd = $historyComment - 2
    $secondStart = Find-SourceLine -ExactText '      {/* Register each feature stack as one persistent bottom-tab destination. */}'
    $secondEnd = Find-SourceLine -ExactText '    </Tabs.Navigator>);'

    $rows = New-Object System.Collections.Generic.List[string]
    foreach ($lineNumber in $firstStart..$firstEnd) {
        $escapedLine = [System.Net.WebUtility]::HtmlEncode($sourceLines[$lineNumber - 1])
        $rows.Add("<div class='line'><span class='number'>$lineNumber</span><span class='code'>$escapedLine</span></div>")
    }
    $rows.Add("<div class='omitted'>Lines $($firstEnd + 1)-$($secondStart - 1) omitted: remaining feature stacks and tab-bar styling</div>")
    foreach ($lineNumber in $secondStart..$secondEnd) {
        $escapedLine = [System.Net.WebUtility]::HtmlEncode($sourceLines[$lineNumber - 1])
        $rows.Add("<div class='line'><span class='number'>$lineNumber</span><span class='code'>$escapedLine</span></div>")
    }

    $html = @"
<!doctype html>
<html lang='en'>
<head>
<meta charset='utf-8'>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1280px; height: 1100px; overflow: hidden; }
  body { background: #202124; color: #d7dae0; font-family: 'Segoe UI', Arial, sans-serif; }
  .window { height: 1100px; overflow: hidden; border: 1px solid #4a4d52; background: #2b2d30; }
  .titlebar { height: 34px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 16px; background: #35373b; color: #e8eaed; font-size: 13px; }
  .app-title { font-weight: 600; }
  .window-buttons { color: #aeb3ba; letter-spacing: 14px; }
  .menubar { height: 31px; display: flex; align-items: center; gap: 19px; padding: 0 14px; border-bottom: 1px solid #1f2023; background: #2b2d30; color: #c7c9ce; font-size: 12px; }
  .toolbar { height: 39px; display: flex; align-items: center; gap: 12px; padding: 0 13px; border-bottom: 1px solid #1f2023; background: #2b2d30; color: #aeb3ba; font-size: 13px; }
  .project-select { min-width: 305px; padding: 6px 10px; border: 1px solid #4b4e54; border-radius: 4px; color: #d7dae0; }
  .run { color: #62c073; font-weight: 700; }
  .main { display: grid; grid-template-columns: 245px 1fr; height: 967px; }
  .project { border-right: 1px solid #1f2023; background: #2b2d30; color: #c8cbd0; font-size: 13px; }
  .tool-title { height: 35px; display: flex; align-items: center; padding: 0 12px; border-bottom: 1px solid #1f2023; font-weight: 600; }
  .tree { padding: 10px 8px; line-height: 24px; white-space: nowrap; }
  .tree div { overflow: hidden; text-overflow: ellipsis; }
  .indent-1 { padding-left: 16px; }
  .indent-2 { padding-left: 32px; }
  .indent-3 { padding-left: 48px; }
  .folder { color: #c7c9ce; }
  .folder::before { content: '▾  '; color: #8b9097; }
  .file::before { content: 'JS  '; color: #d9b45b; font-size: 10px; font-weight: 700; }
  .selected { margin-left: -8px; padding-left: 56px; background: #3e515f; color: #ffffff; }
  .editor { min-width: 0; background: #1e1f22; }
  .tabs { height: 35px; display: flex; align-items: stretch; border-bottom: 1px solid #111214; background: #2b2d30; }
  .tab { display: flex; align-items: center; gap: 7px; padding: 0 18px; border-right: 1px solid #1f2023; border-top: 2px solid #4aa3df; background: #1e1f22; color: #e7e9ec; font-size: 13px; }
  .js-icon { color: #d9b45b; font-size: 11px; font-weight: 700; }
  .breadcrumb { height: 29px; display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid #292b2f; color: #8f949c; font-size: 12px; }
  .content { padding: 8px 0 9px; }
  .line { display: grid; grid-template-columns: 58px 1fr; min-height: 22px; padding: 0 14px 0 0; white-space: pre; }
  .line:hover { background: #26282c; }
  .number { border-right: 1px solid #2a2c31; color: #62666d; padding-right: 13px; text-align: right; user-select: none; font: 13px/22px 'JetBrains Mono', Consolas, monospace; }
  .code { color: #d8dee9; padding-left: 13px; font: 14px/22px 'JetBrains Mono', Consolas, monospace; }
  .omitted { background: #252a30; border-bottom: 1px solid #34373c; border-top: 1px solid #34373c; color: #8e949d; font: italic 12px/28px 'Segoe UI', Arial, sans-serif; margin: 4px 0; padding-left: 72px; }
  .statusbar { position: absolute; left: 245px; right: 0; bottom: 0; height: 27px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-top: 1px solid #111214; background: #2b2d30; color: #aeb3ba; font-size: 11px; }
  .status-right { word-spacing: 12px; }
</style>
</head>
<body>
  <section class='window'>
    <div class='titlebar'><span class='app-title'>TIP_MoneyMap-Finance-Tracker-App - RootNavigator.jsx</span><span class='window-buttons'>— □ ×</span></div>
    <div class='menubar'><span>File</span><span>Edit</span><span>View</span><span>Navigate</span><span>Code</span><span>Analyze</span><span>Refactor</span><span>Build</span><span>Run</span><span>Tools</span><span>Git</span><span>Window</span><span>Help</span></div>
    <div class='toolbar'><span>☰</span><span class='project-select'>app ▾</span><span class='run'>▶</span><span>Run 'app'</span><span>│</span><span>🔍</span><span>⚙</span></div>
    <div class='main'>
      <aside class='project'>
        <div class='tool-title'>Project</div>
        <div class='tree'>
          <div class='folder'>TIP_MoneyMap-Finance-Tracker-App</div>
          <div class='folder indent-1'>src</div>
          <div class='folder indent-2'>components</div>
          <div class='folder indent-2'>navigation</div>
          <div class='file indent-3 selected'>RootNavigator.jsx</div>
          <div class='file indent-3'>navigationRef.js</div>
          <div class='file indent-3'>routes.js</div>
          <div class='folder indent-2'>screens</div>
          <div class='folder indent-2'>services</div>
          <div class='folder indent-2'>store</div>
          <div class='folder indent-2'>theme</div>
          <div class='folder indent-1'>tests</div>
          <div class='file indent-1'>App.js</div>
          <div class='file indent-1'>package.json</div>
        </div>
      </aside>
      <main class='editor'>
        <div class='tabs'><div class='tab'><span class='js-icon'>JS</span> RootNavigator.jsx&nbsp;&nbsp;×</div></div>
        <div class='breadcrumb'>src &nbsp;›&nbsp; navigation &nbsp;›&nbsp; RootNavigator.jsx</div>
        <div class='content'>$($rows -join "`n")</div>
      </main>
    </div>
    <div class='statusbar'><span>✓ No problems</span><span class='status-right'>LF UTF-8 4 spaces JavaScript JSX</span></div>
  </section>
</body>
</html>
"@

    New-Item -ItemType Directory -Path (Split-Path -Parent $DestinationPath) -Force | Out-Null
    $htmlPath = [System.IO.Path]::ChangeExtension($DestinationPath, '.html')
    [System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.UTF8Encoding]::new($false))
    $htmlUri = 'file:///' + (($htmlPath -replace '\\', '/') -replace ' ', '%20')
    $chromeArguments = @(
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--window-size=1280,1100',
        "--screenshot=`"$DestinationPath`"",
        $htmlUri
    )
    $chromeProcess = Start-Process -FilePath $chromePath -ArgumentList $chromeArguments -WindowStyle Hidden -Wait -PassThru
    if ($chromeProcess.ExitCode -ne 0) {
        throw "Chrome failed to render the code screenshot with exit code $($chromeProcess.ExitCode)."
    }
    if (-not (Test-Path -LiteralPath $DestinationPath)) {
        throw "Code screenshot was not generated: $DestinationPath"
    }

    # Return the selected ranges so the Word caption and explanation stay accurate.
    return [pscustomobject]@{
        FirstStart = $firstStart
        FirstEnd = $firstEnd
        SecondStart = $secondStart
        SecondEnd = $secondEnd
    }
}

$codeExcerpt = New-CodeScreenshot -SourcePath (Join-Path $projectRoot 'src\navigation\RootNavigator.jsx') -DestinationPath $codeImage

# Fail early if any screenshot is missing, because Word otherwise inserts a blank placeholder.
foreach ($imagePath in @($figmaImages.Values) + @($appImages.Values) + @($codeImage)) {
    if (-not (Test-Path -LiteralPath $imagePath)) {
        throw "Required evidence image not found: $imagePath"
    }
}

if ($ScreenshotOnly) {
    Get-Item -LiteralPath $codeImage | Select-Object FullName, Length, LastWriteTime
    return
}

# Convert familiar RGB values to the integer format expected by Word COM.
function Get-WordColor {
    param([int]$Red, [int]$Green, [int]$Blue)
    return $Red + (256 * $Green) + (65536 * $Blue)
}

$colorInk = Get-WordColor 31 41 55
$colorMuted = Get-WordColor 75 85 99
$colorGreen = Get-WordColor 5 150 105
$colorGreenLight = Get-WordColor 209 250 229
$colorBlueLight = Get-WordColor 239 246 255
$colorAmberLight = Get-WordColor 254 243 199
$colorRedLight = Get-WordColor 254 226 226
$colorWhite = Get-WordColor 255 255 255
$colorBorder = Get-WordColor 209 213 219

$word = $null
$document = $null

try {
    # Word COM is used because it creates a genuinely editable DOCX with native tables and page fields.
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Add()
    $selection = $word.Selection

    # Configure page geometry and the base typography once for consistent rendering.
    $document.PageSetup.TopMargin = $word.InchesToPoints(0.65)
    $document.PageSetup.BottomMargin = $word.InchesToPoints(0.65)
    $document.PageSetup.LeftMargin = $word.InchesToPoints(0.72)
    $document.PageSetup.RightMargin = $word.InchesToPoints(0.72)
    $document.Styles.Item($wdStyleNormal).Font.Name = 'Aptos'
    $document.Styles.Item($wdStyleNormal).Font.Size = 10.5
    $document.Styles.Item($wdStyleNormal).ParagraphFormat.SpaceAfter = 6
    $document.Styles.Item($wdStyleNormal).ParagraphFormat.LineSpacingRule = 0

    # Apply a restrained academic report style to Word's built-in heading levels.
    foreach ($styleId in @($wdStyleHeading1, $wdStyleHeading2, $wdStyleHeading3)) {
        $style = $document.Styles.Item($styleId)
        $style.Font.Name = 'Aptos Display'
        $style.Font.Color = $colorInk
        $style.Font.Bold = $true
        $style.ParagraphFormat.KeepWithNext = $true
    }
    $document.Styles.Item($wdStyleHeading1).Font.Size = 18
    $document.Styles.Item($wdStyleHeading1).Font.Color = $colorGreen
    $document.Styles.Item($wdStyleHeading1).ParagraphFormat.SpaceBefore = 12
    $document.Styles.Item($wdStyleHeading1).ParagraphFormat.SpaceAfter = 6
    $document.Styles.Item($wdStyleHeading2).Font.Size = 14
    $document.Styles.Item($wdStyleHeading2).ParagraphFormat.SpaceBefore = 10
    $document.Styles.Item($wdStyleHeading2).ParagraphFormat.SpaceAfter = 4
    $document.Styles.Item($wdStyleHeading3).Font.Size = 11.5
    $document.Styles.Item($wdStyleHeading3).ParagraphFormat.SpaceBefore = 8
    $document.Styles.Item($wdStyleHeading3).ParagraphFormat.SpaceAfter = 3

    # Add one formatted paragraph and reset the selection to the normal style afterward.
    function Add-Paragraph {
        param(
            [string]$Text,
            [int]$Style = $wdStyleNormal,
            [int]$Alignment = $wdAlignParagraphLeft,
            [double]$FontSize = 10.5,
            [bool]$Bold = $false,
            [int]$Color = $colorInk,
            [double]$SpaceAfter = 6,
            [bool]$Italic = $false
        )
        $selection.Style = $document.Styles.Item($Style)
        $selection.ParagraphFormat.Alignment = $Alignment
        $selection.ParagraphFormat.SpaceAfter = $SpaceAfter
        $selection.Font.Name = if ($Style -eq $wdStyleNormal) { 'Aptos' } else { 'Aptos Display' }
        $selection.Font.Size = $FontSize
        $selection.Font.Bold = $Bold
        $selection.Font.Italic = $Italic
        $selection.Font.Color = $Color
        $selection.TypeText($Text)
        $selection.TypeParagraph()
        $selection.Style = $document.Styles.Item($wdStyleNormal)
        $selection.Font.Bold = $false
        $selection.Font.Italic = $false
        $selection.Font.Color = $colorInk
        $selection.ParagraphFormat.Alignment = $wdAlignParagraphLeft
    }

    # Add a compact bulleted list while preserving the document's direct formatting.
    function Add-Bullets {
        param([string[]]$Items)
        foreach ($item in $Items) {
            Add-Paragraph -Text ("- " + $item) -SpaceAfter 2
        }
        Add-Paragraph -Text '' -SpaceAfter 2
    }

    # Insert a page break without carrying prior direct formatting onto the next page.
    function Add-PageBreak {
        $selection.InsertBreak($wdPageBreak)
        $selection.Style = $document.Styles.Item($wdStyleNormal)
        $selection.Font.Name = 'Aptos'
        $selection.Font.Size = 10.5
        $selection.Font.Bold = $false
        $selection.Font.Color = $colorInk
    }

    # Format a table cell using explicit colors so the output is independent of the local Word theme.
    function Set-CellText {
        param(
            $Cell,
            [string]$Text,
            [bool]$Bold = $false,
            [int]$FontColor = $colorInk,
            [int]$FillColor = $colorWhite,
            [double]$FontSize = 8.5,
            [int]$Alignment = $wdAlignParagraphLeft
        )
        $range = $Cell.Range
        $range.End = $range.End - 1
        $range.Text = $Text
        $range.Font.Name = 'Aptos'
        $range.Font.Size = $FontSize
        $range.Font.Bold = $Bold
        $range.Font.Color = $FontColor
        $range.ParagraphFormat.Alignment = $Alignment
        $range.ParagraphFormat.SpaceAfter = 0
        $Cell.Shading.BackgroundPatternColor = $FillColor
        $Cell.VerticalAlignment = 1
    }

    # Create a native Word table from a header row and a two-dimensional data array.
    function Add-DataTable {
        param(
            [string[]]$Headers,
            [object[]]$Rows,
            [double]$FontSize = 8.5,
            [double[]]$ColumnWidths = @()
        )
        $table = $document.Tables.Add($selection.Range, $Rows.Count + 1, $Headers.Count)
        $table.AllowAutoFit = $true
        $table.AutoFitBehavior($wdAutoFitWindow)
        $table.Borders.Enable = $true
        $table.Borders.InsideLineStyle = $wdLineStyleSingle
        $table.Borders.OutsideLineStyle = $wdLineStyleSingle
        $table.Borders.InsideColor = $colorBorder
        $table.Borders.OutsideColor = $colorBorder
        $table.Rows.AllowBreakAcrossPages = $false

        for ($column = 1; $column -le $Headers.Count; $column += 1) {
            Set-CellText -Cell $table.Cell(1, $column) -Text $Headers[$column - 1] -Bold $true -FontColor $colorWhite -FillColor $colorGreen -FontSize $FontSize
        }

        for ($row = 0; $row -lt $Rows.Count; $row += 1) {
            $fill = if (($row % 2) -eq 0) { $colorWhite } else { $colorBlueLight }
            for ($column = 0; $column -lt $Headers.Count; $column += 1) {
                Set-CellText -Cell $table.Cell($row + 2, $column + 1) -Text ([string]$Rows[$row][$column]) -FillColor $fill -FontSize $FontSize
            }
        }

        if ($ColumnWidths.Count -eq $Headers.Count) {
            for ($column = 1; $column -le $Headers.Count; $column += 1) {
                # Word expects point units here because the supplied width is converted from inches.
                $table.Columns.Item($column).PreferredWidthType = 3
                $table.Columns.Item($column).PreferredWidth = $word.InchesToPoints($ColumnWidths[$column - 1])
            }
        }

        $selection.SetRange($table.Range.End, $table.Range.End)
        $selection.TypeParagraph()
        return $table
    }

    # Insert two comparable phone screenshots into one fixed-width evidence table.
    function Add-ImageComparison {
        param(
            [string]$LeftPath,
            [string]$RightPath,
            [string]$LeftLabel,
            [string]$RightLabel,
            [string]$Caption
        )
        $table = $document.Tables.Add($selection.Range, 2, 2)
        $table.AllowAutoFit = $false
        $table.Borders.Enable = $false
        $table.Columns.Item(1).Width = $word.InchesToPoints(3.13)
        $table.Columns.Item(2).Width = $word.InchesToPoints(3.13)
        $table.Rows.AllowBreakAcrossPages = $false
        Set-CellText -Cell $table.Cell(1, 1) -Text $LeftLabel -Bold $true -FillColor $colorGreenLight -FontSize 9 -Alignment $wdAlignParagraphCenter
        Set-CellText -Cell $table.Cell(1, 2) -Text $RightLabel -Bold $true -FillColor $colorGreenLight -FontSize 9 -Alignment $wdAlignParagraphCenter

        $leftRange = $table.Cell(2, 1).Range
        $leftRange.End = $leftRange.End - 1
        $leftRange.ParagraphFormat.Alignment = $wdAlignParagraphCenter
        $leftPicture = $leftRange.InlineShapes.AddPicture($LeftPath, $false, $true, $leftRange)
        $leftPicture.LockAspectRatio = $true
        $leftPicture.Width = $word.InchesToPoints(2.68)

        $rightRange = $table.Cell(2, 2).Range
        $rightRange.End = $rightRange.End - 1
        $rightRange.ParagraphFormat.Alignment = $wdAlignParagraphCenter
        $rightPicture = $rightRange.InlineShapes.AddPicture($RightPath, $false, $true, $rightRange)
        $rightPicture.LockAspectRatio = $true
        $rightPicture.Width = $word.InchesToPoints(2.68)

        $selection.SetRange($table.Range.End, $table.Range.End)
        $selection.TypeParagraph()
        Add-Paragraph -Text $Caption -FontSize 8 -Color $colorMuted -SpaceAfter 7 -Italic $true
    }

    # Insert a centered supporting screenshot with a short academic caption.
    function Add-SingleImage {
        param(
            [string]$Path,
            [string]$Caption,
            [double]$WidthInches = 6.15
        )
        $range = $selection.Range
        $range.ParagraphFormat.Alignment = $wdAlignParagraphCenter
        $picture = $range.InlineShapes.AddPicture($Path, $false, $true, $range)
        $picture.LockAspectRatio = $true
        $picture.Width = $word.InchesToPoints($WidthInches)
        $selection.SetRange($picture.Range.End, $picture.Range.End)
        $selection.TypeParagraph()
        Add-Paragraph -Text $Caption -Alignment $wdAlignParagraphCenter -FontSize 8 -Color $colorMuted -SpaceAfter 7 -Italic $true
    }

    # Place a visible review warning on the cover page because identity fields were not supplied.
    $warningTable = $document.Tables.Add($selection.Range, 1, 1)
    Set-CellText -Cell $warningTable.Cell(1, 1) -Text 'REVIEW-READY DRAFT: Replace bracketed identity fields and verify every reflection before submission.' -Bold $true -FillColor $colorAmberLight -FontSize 9 -Alignment $wdAlignParagraphCenter
    $selection.SetRange($warningTable.Range.End, $warningTable.Range.End)
    $selection.TypeParagraph()
    Add-Paragraph -Text 'MONEYMAP FINANCE TRACKER' -Alignment $wdAlignParagraphCenter -FontSize 12 -Bold $true -Color $colorGreen -SpaceAfter 8
    Add-Paragraph -Text 'Laboratory Activity 4.1' -Alignment $wdAlignParagraphCenter -FontSize 26 -Bold $true -Color $colorInk -SpaceAfter 4
    Add-Paragraph -Text 'Final Project Development: React Environment Initialization and Prototype Translation - Part 1' -Alignment $wdAlignParagraphCenter -FontSize 14 -Bold $true -Color $colorMuted -SpaceAfter 22

    $coverRows = @(
        @('Student name(s)', '[Replace with student name(s)]'),
        @('Course / section', '[Replace with course and section]'),
        @('Instructor', '[Replace with instructor name]'),
        @('Submission date', '[Replace with submission date]'),
        @('Repository branch', 'main'),
        @('Evidence commit', '73830d9')
    )
    Add-DataTable -Headers @('Field', 'Entry') -Rows $coverRows -FontSize 9 -ColumnWidths @(1.8, 4.45) | Out-Null
    Add-Paragraph -Text 'Project repository' -Alignment $wdAlignParagraphCenter -FontSize 9 -Bold $true -Color $colorMuted -SpaceAfter 2
    Add-Paragraph -Text 'https://github.com/SecretlySpy/TIP_MoneyMap-Finance-Tracker-App' -Alignment $wdAlignParagraphCenter -FontSize 9 -Color $colorGreen -SpaceAfter 8
    Add-Paragraph -Text 'Figma prototype' -Alignment $wdAlignParagraphCenter -FontSize 9 -Bold $true -Color $colorMuted -SpaceAfter 2
    Add-Paragraph -Text 'https://www.figma.com/design/JeEeOG1jZ0B72pA8gf7fMk/MoneyMap---Finance-Tracker?node-id=75-172' -Alignment $wdAlignParagraphCenter -FontSize 8.5 -Color $colorGreen -SpaceAfter 14
    Add-Paragraph -Text 'Student review is required before PDF conversion and submission.' -Alignment $wdAlignParagraphCenter -FontSize 9 -Color $colorMuted -SpaceAfter 6 -Italic $true

    Add-PageBreak
    Add-Paragraph -Text 'Table of Contents' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    $tocRange = $selection.Range
    $toc = $document.TablesOfContents.Add($tocRange, $true, 1, 3)
    $selection.SetRange($toc.Range.End, $toc.Range.End)
    $selection.TypeParagraph()
    Add-Paragraph -Text 'Submission note' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Paragraph -Text 'The report separates checks that were actually run from checks that still need an Android device. Passing Jest or exporting the JavaScript bundle is not treated as proof of native-device behavior.'

    Add-PageBreak
    Add-Paragraph -Text '1. Activity and Project Overview' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Paragraph -Text 'MoneyMap is an Expo React Native finance tracker that stores data locally. For this activity, we selected Dashboard, Add Transaction - Expense, History, and Budgets. Together, these screens show the main flow of checking finances, recording an expense, reviewing transactions, and monitoring a budget.'
    Add-Paragraph -Text 'We compared the selected Figma frames with the existing source and rendered-app screenshots. The screens and routes were already implemented, so no visual feature or business-logic change was needed. We added explanatory navigation comments and a portable Android Studio launcher. The checks completed for this report were 37 passing Jest suites (232 tests), 18 passing Expo Doctor checks, a successful Android JavaScript export, and a live review of the selected Figma interactions.'
    Add-Paragraph -Text 'The main limitation is device evidence. No Android device or emulator was available, and the active Node version does not match the project baseline. The Android launcher now resolves the project JDK 21 toolchain, but the app screenshots are still labeled as archived September 6 captures instead of current-device proof.'

    Add-Paragraph -Text '2. Intended Learning Outcomes and Scope' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Paragraph -Text 'The table below connects each learning outcome to a specific part of the project.'
    $iloRows = @(
        @('ILO-01', 'Design and implement a foundational, scalable directory structure and client-side routing.', 'src/navigation, feature screens, components, stores, services, and tests are separated by responsibility; RootNavigator composes stack and tab routes.'),
        @('ILO-02', 'Translate high-fidelity interfaces into functional React components using JSX and styled React Native views.', 'Four selected frames are mapped to routed screens and reusable components with live store/service integration.'),
        @('ILO-03', 'Evaluate and document progress, successes, critical blockers, and subsequent phases.', 'The Norman, Fitts, status, and verification sections record what worked, what remains unverified, and what should be tested next.')
    )
    Add-DataTable -Headers @('Outcome', 'Requirement', 'Evidence in this submission') -Rows $iloRows -FontSize 8.2 -ColumnWidths @(0.7, 2.55, 3.05) | Out-Null
    Add-Paragraph -Text 'Selected primary interfaces' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    $screenRows = @(
        @('Dashboard', '80:194', 'Primary overview and navigation hub; exposes balance, Safe-to-Spend, feature shortcuts, recent activity, and the add-transaction entry point.'),
        @('Add Transaction - Expense', '84:220', 'Captures the central data-entry workflow and demonstrates categories, accounts, numeric input, validation, and persistence.'),
        @('History', '88:240', 'Shows retrieval, search, filtering, transaction grouping, detail navigation, and destructive-action access.'),
        @('Budgets', '89:266', 'Shows budget status, monthly progress, navigation to related bills, and budget creation/editing.')
    )
    Add-DataTable -Headers @('Screen', 'Figma node', 'Why it was selected') -Rows $screenRows -FontSize 8.2 -ColumnWidths @(1.35, 0.85, 4.1) | Out-Null

    Add-Paragraph -Text '3. Development Environment and Source Code Access' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Paragraph -Text 'Project stack' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    $stackRows = @(
        @('Runtime', 'Expo SDK ~54.0.37, React Native 0.81.5, React 19.1.0'),
        @('Language and UI', 'JavaScript/JSX with React Native StyleSheet-based components'),
        @('Routing', 'React Navigation 7 with a root stack, nested feature stacks, and four bottom tabs'),
        @('State', 'Zustand 5 stores for finance data, budgets, goals, settings, and UI state'),
        @('Persistence', 'OP-SQLite with SQLCipher-oriented secure storage configuration; offline-first repository layer'),
        @('Testing', 'Jest and React Native Testing Library plus static release, security, and regression checks')
    )
    Add-DataTable -Headers @('Area', 'Implementation') -Rows $stackRows -FontSize 8.5 -ColumnWidths @(1.45, 4.85) | Out-Null
    Add-Paragraph -Text 'Environment check' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    $environmentRows = @(
        @('Git state', 'VERIFIED', 'The report uses main at HEAD 73830d9; the worktree contains the documented activity and launcher changes, and no commit was created.'),
        @('Node.js', 'PARTIALLY VERIFIED', 'v24.16.0 is installed; project guidance recommends Node 22 LTS.'),
        @('npm', 'VERIFIED', 'v11.13.0 is installed and project scripts execute.'),
        @('Java', 'VERIFIED FOR LAUNCHER', 'Global JDK 25 is installed; android:check correctly selected the project JDK 21 toolchain.'),
        @('Android SDK', 'VERIFIED', 'SDK path resolves locally.'),
        @('Android Studio run config', 'VERIFIED', 'Three Node-backed Shell Script configurations parse; android:check passed; no user-specific shell path remains.'),
        @('Device/emulator', 'UNVERIFIED', 'adb listed no connected devices and no local Android Virtual Device was configured.')
    )
    Add-DataTable -Headers @('Item', 'Status', 'Evidence / implication') -Rows $environmentRows -FontSize 8.1 -ColumnWidths @(1.15, 1.15, 4.0) | Out-Null
    Add-Paragraph -Text 'Source code and version control' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Paragraph -Text 'Source code is available at https://github.com/SecretlySpy/TIP_MoneyMap-Finance-Tracker-App. The report was prepared from the main branch at commit 73830d9. The project keeps its screens, reusable components, navigation, stores, services, tests, documentation, and screenshots in the repository. We did not commit or push changes while preparing this activity report.'

    Add-PageBreak
    Add-Paragraph -Text '4. Comparative Visual Analysis' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Paragraph -Text 'Each comparison places the current Figma frame beside a rendered application capture. The application images are archived screenshots dated September 6, 2026 and cropped from the top to approximately the same phone-viewport aspect ratio. Cropping changes only the visible extent; it does not modify the UI. A fresh screenshot from the current commit remains UNVERIFIED because no device or emulator was available.'

    Add-Paragraph -Text '4.1 Dashboard' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-ImageComparison -LeftPath $figmaImages.Dashboard -RightPath $appImages.Dashboard -LeftLabel 'Live Figma - Dashboard (80:194)' -RightLabel 'Rendered app archive - Dashboard' -Caption 'Figure 1. Current design and archived application rendering, aligned to a comparable viewport for review.'
    Add-Bullets -Items @(
        'Both versions place the balance and Safe-to-Spend information first, followed by shortcuts, spending information, recent transactions, and the add button.',
        'The Figma frame is more compact and shows six quick actions. The archived app screen uses a longer scrolling layout.',
        'DashboardScreen builds the page from MonthChip, SafeToSpendCard, SpendingDonut, TransactionRow, SectionCard, and EmptyState.'
    )

    Add-PageBreak
    Add-Paragraph -Text '4.2 Add Transaction - Expense' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-ImageComparison -LeftPath $figmaImages.Entry -RightPath $appImages.Entry -LeftLabel 'Live Figma - Expense Entry (84:220)' -RightLabel 'Rendered app archive - Expense Entry' -Caption 'Figure 2. Transaction-entry structure: type switch, amount, templates, categories, account selection, keypad, and primary action.'
    Add-Bullets -Items @(
        'Both versions follow the same order: transaction type, amount, templates, category, account, keypad, and Save Transaction.',
        'The app capture scrolls farther than the Figma frame and gives the note field more vertical space.',
        'EntryScreen reuses Chip, PrimaryButton, ScreenContainer, and TextPromptModal, then sends the completed values to the finance store.'
    )

    Add-PageBreak
    Add-Paragraph -Text '4.3 History' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-ImageComparison -LeftPath $figmaImages.History -RightPath $appImages.History -LeftLabel 'Live Figma - History (88:240)' -RightLabel 'Rendered app archive - History' -Caption 'Figure 3. Ledger review with search/filter controls, grouped transactions, and bottom navigation.'
    Add-Bullets -Items @(
        'Both versions use a month selector, search, filter chips, grouped dates, signed amounts, and the bottom navigation.',
        'The Figma frame shows a shorter sample. The original archived capture continues through more date groups below the crop.',
        'HistoryScreen filters the store data and renders each result with TransactionRow; selecting a row opens its detail route.'
    )

    Add-PageBreak
    Add-Paragraph -Text '4.4 Budgets' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-ImageComparison -LeftPath $figmaImages.Budgets -RightPath $appImages.Budgets -LeftLabel 'Live Figma - Budgets (89:266)' -RightLabel 'Rendered app archive - Budgets' -Caption 'Figure 4. Monthly budget overview, related-bills link, budget cards, add action, and persistent navigation.'
    Add-Bullets -Items @(
        'Both versions keep the month control, Bills link, budget progress cards, add-budget action, and bottom navigation in the same order.',
        'The Figma cards are slightly more compact, while the archived app capture shows a longer visible list.',
        'BudgetsScreen uses BudgetCard for each item and reuses MonthChip, DashedButton, BottomSheet, EmojiGrid, and TextPromptModal for the workflow.'
    )

    Add-PageBreak
    Add-Paragraph -Text '5. Source Code and Component Architecture' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Paragraph -Text '5.1 Navigation code example' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Paragraph -Text 'The excerpt below comes directly from src/navigation/RootNavigator.jsx. It shows how the selected screens are connected instead of being separate mockups.'
    $codeCaption = 'Figure 5. Android Studio-style view of the commented routing excerpt from src/navigation/RootNavigator.jsx (lines {0}-{1} and {2}-{3}).' -f $codeExcerpt.FirstStart, $codeExcerpt.FirstEnd, $codeExcerpt.SecondStart, $codeExcerpt.SecondEnd
    Add-SingleImage -Path $codeImage -Caption $codeCaption -WidthInches 6.15
    Add-Paragraph -Text 'How this code runs' -Style $wdStyleHeading3 -FontSize 11.5 -Bold $true
    $routingSteps = @(
        ('1. Lines {0}-{1} create the root, tab, and feature stacks; the block comment explains why separate stacks preserve each tab''s navigation history.' -f $codeExcerpt.FirstStart, ($codeExcerpt.FirstStart + 7)),
        ('2. Lines {0}-{1} define HomeNavigator and register the dashboard plus every screen opened from its actions.' -f ($codeExcerpt.FirstStart + 9), $codeExcerpt.FirstEnd),
        '3. The omitted middle block applies the same pattern to History, Budgets, and Settings, then derives the tab-bar appearance from the theme and safe area.',
        ('4. Lines {0}-{1} register the four feature stacks as persistent bottom-tab destinations.' -f $codeExcerpt.SecondStart, $codeExcerpt.SecondEnd),
        '5. Selecting a tab loads its nested stack; opening Entry uses the configured slide-up transition and temporarily hides the tab bar.'
    )
    foreach ($step in $routingSteps) {
        Add-Paragraph -Text $step -SpaceAfter 3
    }

    Add-PageBreak
    Add-Paragraph -Text '5.2 Component hierarchy' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Paragraph -Text 'The selected screens use the same application shell, stores, and shared components.'
    $architectureText = @'
App.js
`-- DatabaseGate
    `-- NavigationContainer
        `-- RootNavigator
            `-- MainTabs
                |-- HomeNavigator
                |   |-- DashboardScreen
                |   `-- EntryScreen
                |-- HistoryNavigator
                |   `-- HistoryScreen / HistoryBody
                |-- BudgetsNavigator
                |   `-- BudgetsScreen
                `-- SettingsNavigator

Shared data path:
Screen -> Zustand store -> repository/service -> encrypted local SQLite
Screen <- derived selectors / view services <- persisted finance data
'@
    $codeStart = $selection.Start
    Add-Paragraph -Text $architectureText -FontSize 8.5 -SpaceAfter 8
    $codeRange = $document.Range($codeStart, $selection.Start)
    $codeRange.Font.Name = 'Cascadia Mono'
    $codeRange.Shading.BackgroundPatternColor = $colorBlueLight
    $codeRange.ParagraphFormat.LeftIndent = $word.InchesToPoints(0.18)
    $codeRange.ParagraphFormat.RightIndent = $word.InchesToPoints(0.18)

    $componentRows = @(
        @('ScreenContainer', 'src/components/ScreenContainer.jsx', 'Safe-area, spacing, and scroll layout.', 'Dashboard, Entry, History, Budgets'),
        @('MonthChip', 'src/components/MonthChip.jsx', 'Shows and changes the active month.', 'Dashboard, History, Budgets'),
        @('Chip', 'src/components/Chip.jsx', 'Template, category, account, and filter choices.', 'Entry, History'),
        @('PrimaryButton / DashedButton', 'src/components/Buttons.jsx', 'Primary save and secondary add actions.', 'Entry, Budgets'),
        @('SectionCard', 'src/components/SectionCard.jsx', 'Shared content-card layout.', 'Dashboard, History'),
        @('TransactionRow', 'src/components/TransactionRow.jsx', 'Displays one signed transaction row.', 'Dashboard, History'),
        @('BudgetCard', 'src/components/BudgetCard.jsx', 'Displays budget amount and progress.', 'Budgets'),
        @('BottomSheet / TextPromptModal', 'src/components/BottomSheet.jsx; TextPromptModal.jsx', 'Collects values for add/edit workflows.', 'Entry, Budgets')
    )
    Add-DataTable -Headers @('Component', 'Location', 'Purpose', 'Reused By') -Rows $componentRows -FontSize 7.1 -ColumnWidths @(1.35, 2.05, 1.7, 1.2) | Out-Null
    Add-Paragraph -Text 'Data and state flow' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Paragraph -Text 'Dashboard, History, and Budgets read finance data from the Zustand finance store. Entry writes a new transaction through the same store. Calculation helpers such as financeView, money, and safeToSpend prepare display values, while the repository layer persists the records in local encrypted SQLite storage. Shared colors, spacing, typography, and control sizes come from src/theme/tokens.js.'

    # Reserve enough trailing space so the next required section title is not stranded at the page bottom.
    Add-Paragraph -Text '' -SpaceAfter 48
    Add-Paragraph -Text "6. Fitts's Law Evaluation" -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Paragraph -Text "Fitts's Law uses MT = a + b log2(D/W + 1). D is the distance to a target and W is its effective size. We used the principle to check reach, target size, and spacing; we did not calculate a movement time because no user-specific constants or measured starting positions were available."
    Add-Paragraph -Text 'Live Figma interaction audit' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Paragraph -Text 'The four selected Figma frames contained 24 interactive nodes and 11 navigation destinations; all destination IDs resolved. Most frequent actions were already large and close to the lower thumb area. A few controls look small in the design, but the React Native version increases the effective target with hitSlop.'
    $fittsRows = @(
        @('Dashboard: add FAB', '60 px target near lower edge', 'Large and close to the thumb zone.', 'No change.', 'Already compliant'),
        @('Dashboard: quick actions', '44-61 px high', 'Short travel between repeated targets.', 'No change.', 'Already compliant'),
        @('Entry: category, keypad, save', '64, 53, and 51 px high', 'Frequent input targets are large and separated.', 'No change.', 'Already compliant'),
        @('Entry: close button', '36 x 36 px visual target', 'Visual target is compact.', 'Kept existing 12 px hitSlop; device check pending.', 'Minor improvement recommended'),
        @('Entry/History: chips', 'About 30-34 px visual height', 'Spacing and hitSlop increase effective size.', 'Kept existing Chip hitSlop.', 'Minor improvement recommended'),
        @('History: search', '36 px visual target', 'Small icon, but the app expands its touch area.', 'Kept existing 8 px hitSlop.', 'Minor improvement recommended'),
        @('Dashboard: bill strip', '340 x 32 px', 'Wide target but shallow vertically.', 'No change; thumb-test on device.', 'Minor improvement recommended'),
        @('Budgets: Bills subheader', '372 x 18 px design layer', 'Wide but visually thin and less obvious.', 'No change; device check pending.', 'Minor improvement recommended'),
        @('All screens: bottom tabs', '80 px tab bar', 'Persistent and close to the thumb zone.', 'No change.', 'Already compliant')
    )
    Add-DataTable -Headers @('Screen / Control', 'Initial Finding', "Fitts's Law Consideration", 'Action Taken', 'Final Status') -Rows $fittsRows -FontSize 6.7 -ColumnWidths @(1.25, 1.2, 1.55, 1.45, 0.85) | Out-Null
    Add-Paragraph -Text 'Result' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Paragraph -Text 'We did not change Figma or application behavior for this activity because the main actions already had suitable effective targets. The compact secondary controls should still be checked with real thumb use. If users miss them, the first adjustment should be a larger touch area rather than a visual redesign.'

    Add-PageBreak
    Add-Paragraph -Text "7. Donald Norman's Seven Stages of Action" -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Paragraph -Text 'We used one real MoneyMap task for the model: recording a campus lunch expense and checking that it appears correctly.'
    $normanRows = @(
        @('1. Form the goal', 'Record the lunch purchase so the available balance and budget remain accurate.', 'Dashboard exposes the add action and current financial context.'),
        @('2. Form the intention', 'Create an expense rather than income.', 'The transaction type control makes the mode explicit.'),
        @('3. Specify the action', 'Choose Expense, Food, Cash; enter the amount; optionally add a note.', 'Templates, categories, accounts, and a custom keypad reduce recall.'),
        @('4. Execute the action', 'Press Save Transaction.', 'The full-width 51 px primary button provides a clear endpoint.'),
        @('5. Perceive system state', 'Observe the screen transition and the new transaction row.', 'The intended flow returns to a ledger/history context after saving.'),
        @('6. Interpret system state', 'Read the negative amount, category, account, and date as a recorded expense.', 'Semantic amount styling and structured row labels support interpretation.'),
        @('7. Evaluate outcome', 'Confirm totals, budget use, and Safe-to-Spend reflect the purchase.', 'Dashboard aggregates and budget views provide the final feedback loop.')
    )
    Add-DataTable -Headers @('Stage', 'Student action/thought', 'Interface support') -Rows $normanRows -FontSize 8.0 -ColumnWidths @(1.35, 2.55, 2.4) | Out-Null
    Add-Paragraph -Text 'Primary-interface Norman summary' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    $interfaceNormanRows = @(
        @('Dashboard', 'Check the current financial position and choose the next task.', 'Scan the balance, Safe-to-Spend card, shortcuts, and add button.', 'Totals and recent activity communicate the current state; current-device rendering is still unverified.'),
        @('Add Transaction - Expense', 'Record one expense accurately.', 'Choose the type, category, and account; enter the amount and note; save.', 'Validation and the resulting History entry show whether the transaction was accepted.'),
        @('History', 'Find and verify a recorded transaction.', 'Choose a month, search or filter, then open the matching row.', 'Grouped results and transaction details show whether the query and saved data match the goal.'),
        @('Budgets', 'Check monthly spending against a budget.', 'Choose the month, review progress, open related bills, or use the add action.', 'Progress and remaining values show the outcome; thumb reach and TalkBack still need device testing.')
    )
    Add-DataTable -Headers @('Interface', 'Goal', 'Execution', 'Evaluation') -Rows $interfaceNormanRows -FontSize 7.2 -ColumnWidths @(1.2, 1.7, 1.9, 1.5) | Out-Null
    Add-Paragraph -Text 'Gulf of execution' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Paragraph -Text 'The add button, Expense/Income choice, categories, accounts, keypad, and Save Transaction button make the required steps visible. The remaining concern is the smaller secondary controls, which still need a real-device thumb test.'
    Add-Paragraph -Text 'Gulf of evaluation' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Paragraph -Text 'After saving, the History row shows the signed amount, category, account, and date. Dashboard and Budgets then show the effect on totals. The code and automated tests support this flow, but its final visual feedback still needs to be checked on a current Android device.'

    Add-Paragraph -Text '8. Development Status and Impediments' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    $statusRows = @(
        @('Project setup and routing', 'Verified', 'Source structure inspected; navigation tests passed.', 'None for the JavaScript layer.'),
        @('Four selected interfaces', 'Partially Verified', 'Screens exist in Figma and source; archived app captures are included.', 'Recapture the current commit on Android.'),
        @('Figma interactions', 'Verified', '24 interactive nodes; 11 destinations; no missing destination IDs.', 'Thumb-test compact secondary controls.'),
        @('Automated tests', 'Verified', '37/37 suites and 232/232 tests passed.', 'Does not prove native rendering.'),
        @('Expo configuration', 'Verified', 'Expo Doctor passed 18/18 checks.', 'None found by Expo Doctor.'),
        @('Android JavaScript export', 'Verified', '1,558 modules bundled; Hermes output was 5.83 MB.', 'Not a native APK/device test.'),
        @('Android Studio launcher', 'Verified', 'Cross-platform Node launcher, 3/3 launcher tests, and Windows preflight passed.', 'Physical macOS/Linux launch still needs host verification.'),
        @('Native Android run', 'Blocked', 'No device or AVD; active Node 24 differs from the project baseline.', 'Use Node 22 and an Android device/AVD.'),
        @('Dependency audit', 'Open Risk', '25 advisories: 18 moderate and 7 high.', 'xlsx has no published fix; upgrades need review.'),
        @('Submission details', 'Blocked', 'Identity fields are still placeholders.', 'Students must complete and review them.')
    )
    Add-DataTable -Headers @('Area', 'Status', 'Evidence / Notes', 'Remaining Issue') -Rows $statusRows -FontSize 7.0 -ColumnWidths @(1.35, 0.9, 2.45, 1.6) | Out-Null
    Add-Paragraph -Text 'Next steps' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Bullets -Items @(
        'Use the documented Node 22 and JDK 21 setup, then attach an Android device or configure an AVD.',
        'Replay the four selected flows and capture fresh screenshots from the current commit.',
        'Check the compact controls with normal thumb use and TalkBack.',
        'Replace the cover placeholders, then have the student team review and revise the report before submission.'
    )

    Add-Paragraph -Text '9. AI Tool Usage Disclosure' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Paragraph -Text 'I used OpenAI Codex as a coding and documentation assistant. It helped me locate the relevant React files, compare the four selected screens with Figma, add explanatory comments, create the portable Android Studio launcher, run the listed checks, and organize this report. I used its suggestions as a starting point and kept the technical claims tied to the source files and command output recorded here.'
    Add-Paragraph -Text 'Codex did not run the unavailable Android device test and did not invent screenshots, routes, components, or results. I kept those limits marked as UNVERIFIED. Before submission, I still need to complete the identity fields and make sure I can explain every section in my own words.'

    Add-Paragraph -Text '10. Conclusion and Verification Summary' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Paragraph -Text 'Based on the source code and local checks, MoneyMap covers the Part 1 implementation and documentation requirements at the JavaScript layer. The four selected interfaces are connected through navigation, reuse React Native components, and use the existing Zustand and local SQLite data flow. The Figma links, Jest tests, Expo Doctor checks, and Android JavaScript export passed.'
    Add-Paragraph -Text 'These results do not confirm Android-device behavior. The remaining work is to run the current commit with the documented native toolchain, capture fresh screenshots, and complete the thumb-reach and accessibility checks.'

    Add-PageBreak
    Add-Paragraph -Text 'Appendix A. Changed-File and Design-Frame Manifest' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Paragraph -Text 'Files updated by this completion task' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    $fileRows = @(
        @('MoneyMap_Laboratory_Activity_4.1_Documentation.docx', 'Updated', 'Editable report with comparisons, code screenshot, architecture, usability analysis, status, and disclosure.'),
        @('scripts/build-lab-activity-4-1-document.ps1', 'Updated', 'Reproducible report builder with marker-based commented-code capture.'),
        @('.idea/runConfigurations/*.xml', 'Updated', 'Cross-platform Node-backed actions for Android, Metro, and Jest.'),
        @('scripts/run-android.mjs', 'Added', 'Commented SDK/JDK discovery and Expo Android launcher.'),
        @('scripts/run-android.test.mjs', 'Added', 'Windows, macOS, and Linux path-resolution checks.'),
        @('package.json', 'Updated', 'Exposes android launcher, preflight, and launcher-test scripts.'),
        @('src/navigation/RootNavigator.jsx', 'Comments only', 'Explains navigation responsibilities without changing executable behavior.'),
        @('README and Project Guidelines', 'Updated', 'Setup, troubleshooting, verification, and handover instructions.')
    )
    Add-DataTable -Headers @('Path', 'Change', 'Purpose') -Rows $fileRows -FontSize 8.2 -ColumnWidths @(2.55, 0.8, 2.95) | Out-Null
    Add-Paragraph -Text 'Application and Figma changes' -Style $wdStyleHeading2 -FontSize 14 -Bold $true
    Add-Bullets -Items @(
        'Application source changes: explanatory comments only; navigation behavior is unchanged.',
        'Figma design changes: none.',
        'Reason: the selected screens already exist in both Figma and code, and the main actions already have suitable effective targets. The remaining compact-target concerns are documented for device testing.'
    )
    $designRows = @(
        @('80:194', 'Dashboard', 'Read-only review; current screenshot and interaction audit captured.'),
        @('84:220', 'Add Transaction - Expense', 'Read-only review; current screenshot and interaction audit captured.'),
        @('88:240', 'History', 'Read-only review; current screenshot and interaction audit captured.'),
        @('89:266', 'Budgets', 'Read-only review; current screenshot and interaction audit captured.')
    )
    Add-DataTable -Headers @('Node ID', 'Frame', 'Task action') -Rows $designRows -FontSize 8.3 -ColumnWidths @(0.85, 1.75, 3.7) | Out-Null

    Add-Paragraph -Text 'Appendix B. Evidence Provenance' -Style $wdStyleHeading1 -FontSize 18 -Bold $true -Color $colorGreen
    Add-Bullets -Items @(
        'Current Figma evidence was retrieved live on October 1, 2026 from page 75:172, MoneyMap - Update 092726.',
        'Rendered-app images come from docs/screenshots/2026-09-06 and are labeled as archived. The report uses temporary viewport crops; original files remain unchanged.',
        'Source claims are grounded in package.json, app.json, src/navigation, src/screens, src/components, src/store, src/services, tests, and Project Guidelines.',
        'The code screenshot is generated from the exact commented RootNavigator.jsx ranges named in its caption.',
        'Check results in Section 8 were executed during this completion task unless marked archived, partial, or blocked.'
    )

    # Add a consistent footer with dynamic page and total-page fields to all sections.
    foreach ($section in $document.Sections) {
        $section.PageSetup.DifferentFirstPageHeaderFooter = $false
        $footer = $section.Footers.Item(1)
        $footer.Range.Text = 'MoneyMap Laboratory Activity 4.1  |  '
        $footer.Range.Font.Name = 'Aptos'
        $footer.Range.Font.Size = 8
        $footer.Range.Font.Color = $colorMuted
        $footer.Range.ParagraphFormat.Alignment = $wdAlignParagraphCenter
        $footerRange = $footer.Range
        $footerRange.Collapse($wdCollapseEnd)
        $footerRange.Fields.Add($footerRange, $wdFieldPage) | Out-Null
        $footerRange = $footer.Range
        $footerRange.Collapse($wdCollapseEnd)
        $footerRange.InsertAfter(' of ')
        $footerRange.Collapse($wdCollapseEnd)
        $footerRange.Fields.Add($footerRange, $wdFieldNumPages) | Out-Null
    }

    # Update generated fields only after all content exists, then save in the modern DOCX format.
    $toc.Update() | Out-Null
    $document.Fields.Update() | Out-Null
    $document.Repaginate()
    $resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
    $document.SaveAs2($resolvedOutput, $wdFormatDocumentDefault)

    # Reopen the saved document in the same Word process to validate the package and report useful metrics.
    $document.Close($false)
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null
    $document = $word.Documents.Open($resolvedOutput, $false, $true)
    $document.Repaginate()
    $metrics = [PSCustomObject]@{
        Path = $resolvedOutput
        Bytes = (Get-Item -LiteralPath $resolvedOutput).Length
        Pages = $document.ComputeStatistics(2)
        Words = $document.ComputeStatistics(0)
        Tables = $document.Tables.Count
        InlineShapes = $document.InlineShapes.Count
        Paragraphs = $document.Paragraphs.Count
    }
    $metrics | ConvertTo-Json -Compress
}
finally {
    if ($null -ne $document) {
        $document.Close($false)
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null
    }
    if ($null -ne $word) {
        $word.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
