import AVFoundation
import Foundation
import Photos
import UIKit

/// The camera roll, INSIDE the app.
///
/// Owner, 2026-08-22: "when the user clicks the create a post, i want the users camera roll to open
/// inside the app, not come outside the app into the camera roll, that way, it allows the user to
/// select multiple pictures/videos to post (like it does on instagram)."
///
/// ⚠️ THAT IS A DIFFERENT THING FROM A PICKER, AND THE DISTINCTION IS THE WHOLE REASON THIS FILE
/// EXISTS. `PHPickerViewController` — and the `<input type="file">` sheet the web layer was using —
/// is presented BY THE SYSTEM over the app: it is somebody else's screen, drawn in somebody else's
/// style, and the app never learns anything about the library. What he is describing is what
/// Instagram does: the app enumerates the library itself and draws its own grid, inside its own
/// chrome, with its own multi-select. That needs read access to PhotoKit, which is why the
/// `NSPhotoLibraryUsageDescription` string matters and why this cannot be done from the web layer at
/// all.
///
/// ⚠️ NOTHING IS READ WITHOUT PERMISSION, AND THE PERMISSION IS ASKED FOR ON THE PATH THAT NEEDS IT.
/// A prompt at launch, before the runner has tried to post anything, is a prompt with no context —
/// and from the app's point of view a refusal is permanent. So `authorize` runs when the picker is
/// opened, never before.
///
/// ⚠️ AND LIMITED ACCESS IS A FIRST-CLASS ANSWER, NOT A FAILURE. iOS lets somebody grant a chosen
/// handful of photographs rather than the library; `.limited` returns exactly those, and the web
/// layer offers the system sheet to change the selection. Treating it as a refusal would leave a
/// runner who deliberately chose that state looking at an empty grid.
enum PhotoLibraryService {
    /// One page of the library, newest first.
    struct Item {
        let id: String
        let isVideo: Bool
        let seconds: Double
        let width: Int
        let height: Int
    }

    /// ⚠️ THE FETCH RESULT IS HELD, NOT THE ASSETS. A `PHFetchResult` is lazy — it holds an index, not
    /// tens of thousands of objects — so paging through a large library costs nothing until a page is
    /// actually asked for. Materialising every asset into an array on the first call is how an app
    /// with a ten-year camera roll stalls on open.
    private static var cached: PHFetchResult<PHAsset>?
    private static let queue = DispatchQueue(label: "com.interun.photos", qos: .userInitiated)

    static func status() -> String {
        switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
        case .authorized: return "authorized"
        case .limited: return "limited"
        case .denied: return "denied"
        case .restricted: return "restricted"
        default: return "notDetermined"
        }
    }

    static func authorize(_ done: @escaping (String) -> Void) {
        let cur = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        if cur != .notDetermined { done(status()); return }
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in
            DispatchQueue.main.async { done(status()) }
        }
    }

    /// ⚠️ CLEARED WHENEVER THE LIBRARY CHANGES OR ACCESS IS RE-GRANTED, or the grid keeps showing the
    /// photographs somebody had before they took another one — or, after a `.limited` grant is
    /// widened, keeps showing the smaller set.
    static func invalidate() { queue.sync { cached = nil } }

    private static func result() -> PHFetchResult<PHAsset> {
        if let c = cached { return c }
        let opts = PHFetchOptions()
        opts.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        // Images and videos only — no audio, and nothing the app cannot post.
        opts.predicate = NSPredicate(format: "mediaType == %d OR mediaType == %d",
                                     PHAssetMediaType.image.rawValue,
                                     PHAssetMediaType.video.rawValue)
        let r = PHAsset.fetchAssets(with: opts)
        cached = r
        return r
    }

    static func page(offset: Int, limit: Int) -> (total: Int, items: [Item]) {
        let r = result()
        let total = r.count
        guard total > 0, offset < total, limit > 0 else { return (total, []) }
        let end = min(total, offset + limit)
        var out: [Item] = []
        out.reserveCapacity(end - offset)
        for i in offset..<end {
            let a = r.object(at: i)
            out.append(Item(id: a.localIdentifier,
                            isVideo: a.mediaType == .video,
                            seconds: a.duration,
                            width: a.pixelWidth,
                            height: a.pixelHeight))
        }
        return (total, out)
    }

    private static func asset(_ id: String) -> PHAsset? {
        // ⚠️ BY IDENTIFIER, NOT BY POSITION. The web layer holds identifiers precisely because a new
        // photograph taken while the grid is open shifts every index by one — asking for "item 4"
        // after that returns a different picture from the one the runner tapped.
        PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject
    }

    /// A grid thumbnail. ⚠️ SQUARE AND CENTRE-CROPPED, because the grid is square and letterboxing a
    /// portrait photograph inside a square cell reads as the app having failed to load it.
    static func thumbnail(_ id: String, side: Int, done: @escaping (Data?) -> Void) {
        guard let a = asset(id) else { done(nil); return }
        let opts = PHImageRequestOptions()
        opts.isNetworkAccessAllowed = true          // iCloud originals are the normal case
        opts.deliveryMode = .highQualityFormat
        opts.resizeMode = .exact
        opts.isSynchronous = false
        let px = CGFloat(side)
        PHImageManager.default().requestImage(for: a,
                                             targetSize: CGSize(width: px, height: px),
                                             contentMode: .aspectFill,
                                             options: opts) { img, info in
            // ⚠️ THE DEGRADED PASS IS IGNORED. PhotoKit answers twice for an iCloud asset — a small
            // blurry placeholder first, the real thing after — and replying to the first would put a
            // smeared thumbnail in the grid permanently, because the web layer caches what it is given.
            if let d = info?[PHImageResultIsDegradedKey] as? Bool, d { return }
            guard let img = img, let data = img.jpegData(compressionQuality: 0.8) else { done(nil); return }
            done(data)
        }
    }

    /// The bytes to post. ⚠️ THE ORIGINAL FILE, NOT A RE-RENDER: a photograph goes across as the JPEG
    /// or HEIC it already is and a video as its own file, so nothing is recompressed on the way in.
    static func original(_ id: String, done: @escaping (Data?, String?) -> Void) {
        guard let a = asset(id) else { done(nil, nil); return }
        if a.mediaType == .video {
            let opts = PHVideoRequestOptions()
            opts.isNetworkAccessAllowed = true
            opts.deliveryMode = .highQualityFormat
            opts.version = .current
            PHImageManager.default().requestAVAsset(forVideo: a, options: opts) { av, _, _ in
                guard let urlAsset = av as? AVURLAsset,
                      let data = try? Data(contentsOf: urlAsset.url, options: .mappedIfSafe) else {
                    done(nil, nil); return
                }
                let ext = urlAsset.url.pathExtension.lowercased()
                done(data, ext == "mov" ? "video/quicktime" : "video/mp4")
            }
        } else {
            let opts = PHImageRequestOptions()
            opts.isNetworkAccessAllowed = true
            opts.deliveryMode = .highQualityFormat
            opts.isSynchronous = false
            opts.version = .current
            PHImageManager.default().requestImageDataAndOrientation(for: a, options: opts) { data, uti, _, _ in
                guard let data = data else { done(nil, nil); return }
                let mime = (uti ?? "").contains("heic") ? "image/heic" : "image/jpeg"
                done(data, mime)
            }
        }
    }
}
