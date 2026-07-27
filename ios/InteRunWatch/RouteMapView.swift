import SwiftUI

/// The shape of the run, drawn from the GPS trace.
///
/// No map tiles: they need a network the watch may not have mid-run, and the recognisable thing at
/// the end of a run is the shape of your own route, not the streets underneath it.
struct RouteMapView: View {
    let points: [[Double]]   // [latitude, longitude], in order
    var tint: Color = .accentColor

    var body: some View {
        GeometryReader { geo in
            let path = trace(in: geo.size)
            ZStack {
                path.stroke(tint.opacity(0.35), style: .init(lineWidth: 5, lineCap: .round, lineJoin: .round))
                path.stroke(tint, style: .init(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
        }
        .accessibilityHidden(true)
    }

    private func trace(in size: CGSize) -> Path {
        var p = Path()
        let pts = points.filter { $0.count >= 2 }
        guard pts.count > 1 else { return p }

        let lats = pts.map { $0[0] }, lons = pts.map { $0[1] }
        guard let minLat = lats.min(), let maxLat = lats.max(),
              let minLon = lons.min(), let maxLon = lons.max() else { return p }

        // A degree of longitude is shorter than a degree of latitude by cos(latitude); without this
        // correction every route comes out stretched sideways.
        let midLat = (minLat + maxLat) / 2
        let lonScale = cos(midLat * .pi / 180)
        let spanX = max((maxLon - minLon) * lonScale, 1e-7)
        let spanY = max(maxLat - minLat, 1e-7)

        // One scale for both axes, so the shape is the real shape.
        let inset: CGFloat = 6
        let usable = CGSize(width: max(size.width - inset * 2, 1), height: max(size.height - inset * 2, 1))
        let scale = min(usable.width / spanX, usable.height / spanY)
        let drawn = CGSize(width: spanX * scale, height: spanY * scale)
        let originX = inset + (usable.width - drawn.width) / 2
        let originY = inset + (usable.height - drawn.height) / 2

        func project(_ pt: [Double]) -> CGPoint {
            let x = originX + ((pt[1] - minLon) * lonScale) * scale
            // Screen y grows downward; latitude grows north, so flip it.
            let y = originY + drawn.height - ((pt[0] - minLat) * scale)
            return CGPoint(x: x, y: y)
        }

        p.move(to: project(pts[0]))
        for pt in pts.dropFirst() { p.addLine(to: project(pt)) }
        return p
    }
}
