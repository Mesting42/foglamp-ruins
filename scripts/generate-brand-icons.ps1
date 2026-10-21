Add-Type -AssemblyName System.Drawing

$source = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class FoglampIconRenderer
{
    private static GraphicsPath RoundedRect(float x, float y, float width, float height, float radius)
    {
        var path = new GraphicsPath();
        float d = radius * 2;
        path.AddArc(x, y, d, d, 180, 90);
        path.AddArc(x + width - d, y, d, d, 270, 90);
        path.AddArc(x + width - d, y + height - d, d, d, 0, 90);
        path.AddArc(x, y + height - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    public static void Save(string path, int size)
    {
        using (var bitmap = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bitmap))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.ScaleTransform(size / 512f, size / 512f);

            using (var tile = RoundedRect(14, 14, 484, 484, 126))
            using (var tileFill = new LinearGradientBrush(new Point(64, 40), new Point(448, 474), ColorTranslator.FromHtml("#183B43"), ColorTranslator.FromHtml("#081A24")))
            using (var tileLine = new Pen(ColorTranslator.FromHtml("#E9BD6B"), 7))
            {
                g.FillPath(tileFill, tile);
                g.DrawPath(tileLine, tile);
            }

            using (var ring = new Pen(Color.FromArgb(52, 145, 198, 185), 3)) g.DrawEllipse(ring, 64, 64, 384, 384);
            using (var ring = new Pen(Color.FromArgb(84, 145, 198, 185), 3)) g.DrawEllipse(ring, 94, 94, 324, 324);

            using (var rays = new Pen(Color.FromArgb(180, 244, 203, 120), 8))
            {
                rays.StartCap = LineCap.Round; rays.EndCap = LineCap.Round;
                g.DrawLine(rays, 256, 52, 256, 79); g.DrawLine(rays, 256, 433, 256, 460);
                g.DrawLine(rays, 52, 256, 79, 256); g.DrawLine(rays, 433, 256, 460, 256);
                g.DrawLine(rays, 112, 112, 131, 131); g.DrawLine(rays, 381, 381, 400, 400);
                g.DrawLine(rays, 400, 112, 381, 131); g.DrawLine(rays, 131, 381, 112, 400);
            }

            using (var fog = new Pen(Color.FromArgb(190, 168, 213, 199), 7))
            {
                fog.StartCap = LineCap.Round; fog.EndCap = LineCap.Round;
                g.DrawBezier(fog, 95, 273, 115, 252, 147, 252, 167, 273);
                g.DrawBezier(fog, 345, 273, 365, 252, 397, 252, 417, 273);
            }

            using (var glow = new SolidBrush(Color.FromArgb(43, 255, 201, 104))) g.FillEllipse(glow, 169, 166, 174, 222);

            using (var brass = new LinearGradientBrush(new Point(167, 156), new Point(348, 382), ColorTranslator.FromHtml("#FFE39A"), ColorTranslator.FromHtml("#A96F37")))
            using (var body = new SolidBrush(ColorTranslator.FromHtml("#102C35")))
            using (var glassLine = new Pen(Color.FromArgb(150, 162, 208, 189), 5))
            using (var brassLine = new Pen(brass, 12))
            {
                g.DrawArc(brassLine, 228, 98, 56, 76, 180, 180);
                PointF[] cap = { new PointF(213,162), new PointF(299,162), new PointF(299,189), new PointF(213,189) };
                g.FillPolygon(Brushes.DarkSlateGray, cap); g.DrawPolygon(brassLine, cap);
                PointF[] caseShape = { new PointF(166,196), new PointF(196,167), new PointF(316,167), new PointF(346,196), new PointF(323,232), new PointF(323,351), new PointF(189,351), new PointF(189,232) };
                g.FillPolygon(body, caseShape); g.DrawPolygon(brassLine, caseShape);
                using (var glass = new SolidBrush(ColorTranslator.FromHtml("#0B232C"))) g.FillRectangle(glass, 205, 239, 102, 112);
                g.DrawRectangle(glassLine, 205, 239, 102, 112);
                PointF[] baseShape = { new PointF(181,379), new PointF(331,379), new PointF(314,403), new PointF(198,403) };
                g.FillPolygon(Brushes.DarkSlateGray, baseShape); g.DrawPolygon(brassLine, baseShape);
                using (var foot = new Pen(ColorTranslator.FromHtml("#E9BD6B"), 8)) { foot.StartCap = LineCap.Round; foot.EndCap = LineCap.Round; g.DrawLine(foot, 213, 412, 299, 412); }
            }

            using (var flame = new GraphicsPath())
            using (var flameFill = new LinearGradientBrush(new Point(256, 247), new Point(256, 359), ColorTranslator.FromHtml("#FFF4C9"), ColorTranslator.FromHtml("#EF9C49")))
            {
                flame.AddBezier(222, 324, 214, 294, 239, 268, 256, 247);
                flame.AddBezier(256, 247, 289, 282, 300, 310, 290, 342);
                flame.AddBezier(290, 342, 281, 366, 234, 368, 222, 324);
                g.FillPath(flameFill, flame);
            }

            using (var inner = new SolidBrush(Color.FromArgb(245, 255, 246, 214)))
            using (var innerPath = new GraphicsPath())
            {
                innerPath.AddBezier(245, 324, 242, 308, 250, 296, 256, 289);
                innerPath.AddBezier(256, 289, 266, 302, 270, 314, 268, 328);
                innerPath.AddBezier(268, 328, 267, 342, 247, 342, 245, 324);
                g.FillPath(inner, innerPath);
            }

            bitmap.Save(path, ImageFormat.Png);
        }
    }
}
'@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing
$directory = Join-Path $PSScriptRoot '..\public\assets\brand'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
[FoglampIconRenderer]::Save((Join-Path $directory 'app-icon-180.png'), 180)
[FoglampIconRenderer]::Save((Join-Path $directory 'app-icon-192.png'), 192)
[FoglampIconRenderer]::Save((Join-Path $directory 'app-icon-512.png'), 512)
