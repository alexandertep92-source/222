import CryptoKit
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "TresorNativePlugin") {
      TresorNativePlugin.register(with: registrar)
    }
  }
}

enum VaultCryptoError: Error {
  case authentication
  case format(String)
  case io(String)
}

/// Streaming AES-256-GCM in the vault file format ("TRV1"), identical to
/// lib/core/vault_format.dart and VaultCrypto.java.
enum VaultCrypto {
  static let headerLength = 16
  static let tagLength = 16
  static let prefixLength = 7
  static let defaultChunkSize = 1 << 20
  static let magic: [UInt8] = [0x54, 0x52, 0x56, 0x31]

  static func nonce(_ prefix: [UInt8], _ index: UInt32, _ last: Bool) throws -> AES.GCM.Nonce {
    var bytes = prefix
    bytes.append(last ? 1 : 0)
    bytes.append(UInt8(truncatingIfNeeded: index >> 24))
    bytes.append(UInt8(truncatingIfNeeded: index >> 16))
    bytes.append(UInt8(truncatingIfNeeded: index >> 8))
    bytes.append(UInt8(truncatingIfNeeded: index))
    return try AES.GCM.Nonce(data: bytes)
  }

  /// Reads until `count` bytes are read or the file ends.
  static func readFully(_ handle: FileHandle, _ count: Int) throws -> Data {
    var data = Data()
    while data.count < count {
      guard let chunk = try handle.read(upToCount: count - data.count), !chunk.isEmpty else {
        break
      }
      data.append(chunk)
    }
    return data
  }

  /// Returns the number of plaintext bytes.
  static func encrypt(
    read: (Int) throws -> Data,
    write: (Data) throws -> Void,
    key: SymmetricKey,
    chunkSize: Int = defaultChunkSize
  ) throws -> Int {
    var prefix = [UInt8](repeating: 0, count: prefixLength)
    guard SecRandomCopyBytes(kSecRandomDefault, prefixLength, &prefix) == errSecSuccess else {
      throw VaultCryptoError.io("Zufallszahlen nicht verfügbar")
    }
    var header = Data(magic)
    header.append(contentsOf: [
      UInt8(truncatingIfNeeded: chunkSize >> 24),
      UInt8(truncatingIfNeeded: chunkSize >> 16),
      UInt8(truncatingIfNeeded: chunkSize >> 8),
      UInt8(truncatingIfNeeded: chunkSize),
    ])
    header.append(contentsOf: prefix)
    header.append(0)
    try write(header)

    var current = try read(chunkSize)
    var index: UInt32 = 0
    var total = 0
    while true {
      // Look ahead one chunk to know whether this one is the last.
      let next = current.count == chunkSize ? try read(chunkSize) : Data()
      let last = next.isEmpty
      let sealed = try AES.GCM.seal(current, using: key, nonce: nonce(prefix, index, last))
      try write(sealed.ciphertext)
      try write(sealed.tag)
      total += current.count
      if last { break }
      current = next
      index += 1
    }
    return total
  }

  static func decrypt(
    read: (Int) throws -> Data,
    write: (Data) throws -> Void,
    key: SymmetricKey
  ) throws {
    let header = [UInt8](try read(headerLength))
    guard header.count == headerLength, Array(header[0..<4]) == magic else {
      throw VaultCryptoError.format("Unbekanntes Dateiformat")
    }
    let chunkSize =
      Int(header[4]) << 24 | Int(header[5]) << 16 | Int(header[6]) << 8 | Int(header[7])
    guard chunkSize >= 1 << 10, chunkSize <= 1 << 24 else {
      throw VaultCryptoError.format("Ungültige Blockgröße")
    }
    let prefix = Array(header[8..<(8 + prefixLength)])
    let sealedSize = chunkSize + tagLength

    var current = try read(sealedSize)
    var index: UInt32 = 0
    while true {
      guard current.count >= tagLength else {
        throw VaultCryptoError.format("Datei ist beschädigt")
      }
      let next = current.count == sealedSize ? try read(sealedSize) : Data()
      let last = next.isEmpty
      let box = try AES.GCM.SealedBox(
        nonce: nonce(prefix, index, last),
        ciphertext: current.prefix(current.count - tagLength),
        tag: current.suffix(tagLength)
      )
      let clear: Data
      do {
        clear = try AES.GCM.open(box, using: key)
      } catch {
        throw VaultCryptoError.authentication
      }
      try write(clear)
      if last { break }
      current = next
      index += 1
    }
  }
}

/// Native side of the "tresor/native" channel (see lib/core/native_bridge.dart).
class TresorNativePlugin: NSObject, FlutterPlugin, UIDocumentInteractionControllerDelegate {
  private let queue = DispatchQueue(
    label: "tresor.crypto", qos: .userInitiated, attributes: .concurrent)
  private var documentController: UIDocumentInteractionController?

  static func register(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(
      name: "tresor/native", binaryMessenger: registrar.messenger())
    registrar.addMethodCallDelegate(TresorNativePlugin(), channel: channel)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "encryptFile":
      background(result) {
        let key = try Self.key(args)
        let source = try Self.url(args["source"])
        let target = try Self.string(args["target"])
        let scoped = source.startAccessingSecurityScopedResource()
        defer { if scoped { source.stopAccessingSecurityScopedResource() } }
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }
        return try Self.writing(to: target) { output in
          let size = try VaultCrypto.encrypt(
            read: { try VaultCrypto.readFully(input, $0) },
            write: { try output.write(contentsOf: $0) },
            key: key)
          try output.synchronize()
          return size
        }
      }
    case "encryptBytes":
      background(result) {
        let key = try Self.key(args)
        guard let data = (args["data"] as? FlutterStandardTypedData)?.data else {
          throw VaultCryptoError.io("Argument data fehlt")
        }
        let target = try Self.string(args["target"])
        var offset = 0
        return try Self.writing(to: target) { output in
          _ = try VaultCrypto.encrypt(
            read: { count in
              let end = min(offset + count, data.count)
              defer { offset = end }
              return data.subdata(in: offset..<end)
            },
            write: { try output.write(contentsOf: $0) },
            key: key)
          return nil
        }
      }
    case "decryptFile":
      background(result) {
        let key = try Self.key(args)
        let input = try FileHandle(forReadingFrom: try Self.url(args["source"]))
        defer { try? input.close() }
        return try Self.writing(to: try Self.string(args["target"])) { output in
          try VaultCrypto.decrypt(
            read: { try VaultCrypto.readFully(input, $0) },
            write: { try output.write(contentsOf: $0) },
            key: key)
          return nil
        }
      }
    case "decryptToBytes":
      background(result) {
        let key = try Self.key(args)
        let input = try FileHandle(forReadingFrom: try Self.url(args["source"]))
        defer { try? input.close() }
        var out = Data()
        try VaultCrypto.decrypt(
          read: { try VaultCrypto.readFully(input, $0) },
          write: { out.append($0) },
          key: key)
        return FlutterStandardTypedData(bytes: out)
      }
    case "setSecure":
      // The app switcher snapshot is covered on the Flutter side.
      result(nil)
    case "openFile":
      guard let path = args["path"] as? String else {
        result(FlutterError(code: "io", message: "Argument path fehlt", details: nil))
        return
      }
      let controller = UIDocumentInteractionController(url: URL(fileURLWithPath: path))
      controller.delegate = self
      documentController = controller
      if controller.presentPreview(animated: true) {
        result(true)
      } else if let view = Self.topViewController()?.view {
        result(controller.presentOptionsMenu(from: view.bounds, in: view, animated: true))
      } else {
        result(false)
      }
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  func documentInteractionControllerViewControllerForPreview(
    _ controller: UIDocumentInteractionController
  ) -> UIViewController {
    return Self.topViewController() ?? UIViewController()
  }

  func documentInteractionControllerDidEndPreview(_ controller: UIDocumentInteractionController) {
    documentController = nil
  }

  private func background(_ result: @escaping FlutterResult, _ work: @escaping () throws -> Any?) {
    queue.async {
      let response: Any?
      do {
        response = try work()
      } catch VaultCryptoError.authentication {
        response = FlutterError(code: "auth", message: "Falscher Schlüssel", details: nil)
      } catch VaultCryptoError.format(let message) {
        response = FlutterError(code: "format", message: message, details: nil)
      } catch VaultCryptoError.io(let message) {
        response = FlutterError(code: "io", message: message, details: nil)
      } catch {
        response = FlutterError(code: "io", message: error.localizedDescription, details: nil)
      }
      DispatchQueue.main.async { result(response) }
    }
  }

  /// Creates [path] and runs [body] with a handle to it; removes the file if
  /// [body] fails.
  private static func writing(to path: String, _ body: (FileHandle) throws -> Any?) throws -> Any? {
    guard FileManager.default.createFile(atPath: path, contents: nil) else {
      throw VaultCryptoError.io("Datei kann nicht angelegt werden")
    }
    do {
      let output = try FileHandle(forWritingTo: URL(fileURLWithPath: path))
      defer { try? output.close() }
      return try body(output)
    } catch {
      try? FileManager.default.removeItem(atPath: path)
      throw error
    }
  }

  private static func key(_ args: [String: Any]) throws -> SymmetricKey {
    guard let data = (args["key"] as? FlutterStandardTypedData)?.data, data.count == 32 else {
      throw VaultCryptoError.io("Ungültiger Schlüssel")
    }
    return SymmetricKey(data: data)
  }

  private static func string(_ value: Any?) throws -> String {
    guard let text = value as? String else { throw VaultCryptoError.io("Argument fehlt") }
    return text
  }

  private static func url(_ value: Any?) throws -> URL {
    let text = try string(value)
    if text.hasPrefix("file://"), let url = URL(string: text) { return url }
    return URL(fileURLWithPath: text)
  }

  private static func topViewController() -> UIViewController? {
    let window = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
    var top = window?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }
}
