import WebKit

/// Replaces `navigator.geolocation` with one backed by the native `CLLocationManager`.
///
/// Injected at document start, before any app code runs, so `web/app.ts` never knows the difference
/// — it keeps calling `watchPosition`/`clearWatch` exactly as it does in a browser. The shim removes
/// itself from the equation entirely when the native handler is absent (i.e. on the web), so there
/// is one code path to reason about and nothing to special-case in the UI.
enum GeolocationShim {
    static var userScript: WKUserScript {
        WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    private static let source = """
    (function () {
      var mh = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.interunGeo;
      if (!mh) return;   // running on the web: leave the real geolocation alone

      var watches = {}, pendingOnce = [], nextId = 1, last = null;

      function post(action) { try { mh.postMessage({ action: action }); } catch (e) {} }

      function toPosition(f) {
        return {
          coords: {
            latitude: f.lat, longitude: f.lon, accuracy: f.acc,
            altitude: f.alt, altitudeAccuracy: f.altAcc,
            heading: f.heading, speed: f.speed
          },
          timestamp: f.t
        };
      }

      window.__interunGeo = {
        // Native hands over an ordered batch, which may be a backlog collected while the web view
        // was suspended in someone's pocket. Replaying in order keeps the distance total correct.
        deliver: function (fixes) {
          for (var i = 0; i < fixes.length; i++) {
            var pos = toPosition(fixes[i]);
            last = pos;
            var once = pendingOnce.splice(0);
            for (var j = 0; j < once.length; j++) {
              if (once[j].success) { try { once[j].success(pos); } catch (e) {} }
            }
            var ids = Object.keys(watches);
            for (var k = 0; k < ids.length; k++) {
              var w = watches[ids[k]];
              if (w && w.success) { try { w.success(pos); } catch (e) {} }
            }
          }
        },
        fail: function (code, message) {
          var err = { code: code, message: message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
          var once = pendingOnce.splice(0);
          for (var j = 0; j < once.length; j++) {
            if (once[j].error) { try { once[j].error(err); } catch (e) {} }
          }
          var ids = Object.keys(watches);
          for (var k = 0; k < ids.length; k++) {
            var w = watches[ids[k]];
            if (w && w.error) { try { w.error(err); } catch (e) {} }
          }
        }
      };

      var geo = {
        getCurrentPosition: function (success, error) {
          pendingOnce.push({ success: success, error: error });
          post('once');
        },
        watchPosition: function (success, error) {
          var id = nextId++;
          watches[id] = { success: success, error: error };
          post('watch');
          // A watcher that starts after a fix has already arrived should not wait for the next one.
          if (last) {
            setTimeout(function () {
              if (watches[id] && watches[id].success) { try { watches[id].success(last); } catch (e) {} }
            }, 0);
          }
          return id;
        },
        clearWatch: function (id) {
          delete watches[id];
          if (!Object.keys(watches).length) post('stopWatch');
        }
      };

      try {
        Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
      } catch (e) {
        try { navigator.geolocation = geo; } catch (e2) {}
      }
    })();
    """
}
