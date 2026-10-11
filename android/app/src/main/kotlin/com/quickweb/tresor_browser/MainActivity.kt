package com.quickweb.tresor_browser

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.DocumentsContract
import android.view.WindowManager
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.ByteArrayInputStream
import java.io.EOFException
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.Executors

/**
 * FlutterFragmentActivity is required for the fingerprint dialog (local_auth).
 * The "tresor/native" channel does the heavy crypto work off the UI thread,
 * see lib/core/native_bridge.dart.
 */
class MainActivity : FlutterFragmentActivity() {
    private val worker = Executors.newFixedThreadPool(3)
    private val main = Handler(Looper.getMainLooper())
    private var folderResult: MethodChannel.Result? = null
    private lateinit var folderPicker: ActivityResultLauncher<Uri?>

    override fun onCreate(savedInstanceState: Bundle?) {
        // Hide the content in "recent apps" right from the start; the user can
        // turn this off in the settings.
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        super.onCreate(savedInstanceState)
        folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
            val result = folderResult
            folderResult = null
            result?.success(uri?.toString())
        }
    }

    override fun onDestroy() {
        worker.shutdown()
        super.onDestroy()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "tresor/native")
            .setMethodCallHandler(::handle)
    }

    private fun handle(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "encryptFile" -> background(result) {
                val target = File(call.arg<String>("target"))
                deleteOnFailure(target) {
                    openSource(call.arg<String>("source")).use { input ->
                        FileOutputStream(target).use { file ->
                            val out = BufferedOutputStream(file, BUFFER)
                            val size = VaultCrypto.encrypt(input, out, call.arg<ByteArray>("key"))
                            out.flush()
                            file.fd.sync()
                            size
                        }
                    }
                }
            }
            "encryptBytes" -> background(result) {
                val target = File(call.arg<String>("target"))
                deleteOnFailure(target) {
                    FileOutputStream(target).use { file ->
                        val out = BufferedOutputStream(file, BUFFER)
                        VaultCrypto.encrypt(ByteArrayInputStream(call.arg<ByteArray>("data")), out, call.arg<ByteArray>("key"))
                        out.flush()
                    }
                }
                null
            }
            "decryptFile" -> background(result) {
                val target = File(call.arg<String>("target"))
                deleteOnFailure(target) {
                    BufferedInputStream(FileInputStream(call.arg<String>("source")), BUFFER).use { input ->
                        FileOutputStream(target).use { file ->
                            val out = BufferedOutputStream(file, BUFFER)
                            VaultCrypto.decrypt(input, out, call.arg<ByteArray>("key"))
                            out.flush()
                        }
                    }
                }
                null
            }
            "decryptToBytes" -> background(result) {
                val source = File(call.arg<String>("source"))
                BufferedInputStream(FileInputStream(source), BUFFER).use { input ->
                    VaultCrypto.decryptToBytes(input, source.length(), call.arg<ByteArray>("key"))
                }
            }
            "setSecure" -> {
                if (call.arg<Boolean>("secure")) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                }
                result.success(null)
            }
            "openFile" -> {
                val file = File(call.arg<String>("path"))
                val mime = call.argument<String>("mime") ?: "*/*"
                try {
                    val uri = FileProvider.getUriForFile(this, "$packageName.vaultfiles", file)
                    val intent = Intent(Intent.ACTION_VIEW)
                        .setDataAndType(uri, mime)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    startActivity(intent)
                    result.success(true)
                } catch (e: ActivityNotFoundException) {
                    result.success(false)
                } catch (e: IllegalArgumentException) {
                    result.error("io", e.message, null)
                }
            }
            "pickExportFolder" -> {
                if (folderResult != null) {
                    result.error("busy", "Ordnerauswahl ist bereits offen", null)
                    return
                }
                folderResult = result
                try {
                    folderPicker.launch(null)
                } catch (e: ActivityNotFoundException) {
                    folderResult = null
                    result.error("unavailable", "Keine Ordnerauswahl auf diesem Gerät", null)
                }
            }
            "exportToFolder" -> background(result) { exportToFolder(call) }
            else -> result.notImplemented()
        }
    }

    /** Decrypts vault files straight into a folder chosen by the user. */
    private fun exportToFolder(call: MethodCall): Int {
        val tree = Uri.parse(call.arg<String>("folder"))
        val key = call.arg<ByteArray>("key")
        val files = call.arg<List<Map<String, String>>>("files")
        val parent = DocumentsContract.buildDocumentUriUsingTree(
            tree,
            DocumentsContract.getTreeDocumentId(tree),
        )
        var exported = 0
        for (file in files) {
            val document = DocumentsContract.createDocument(
                contentResolver,
                parent,
                file["mime"] ?: "application/octet-stream",
                file["name"] ?: "datei",
            ) ?: throw IOException("Datei kann im Ordner nicht angelegt werden")
            try {
                val raw = contentResolver.openOutputStream(document)
                    ?: throw IOException("Datei kann nicht geschrieben werden")
                raw.use {
                    val out = BufferedOutputStream(it, BUFFER)
                    BufferedInputStream(FileInputStream(file["source"]!!), BUFFER).use { input ->
                        VaultCrypto.decrypt(input, out, key)
                    }
                    out.flush()
                }
                exported++
            } catch (e: Exception) {
                try {
                    DocumentsContract.deleteDocument(contentResolver, document)
                } catch (ignored: Exception) {
                }
                throw e
            }
        }
        return exported
    }

    private fun openSource(source: String): InputStream {
        val stream = if (source.startsWith("content://")) {
            contentResolver.openInputStream(Uri.parse(source))
                ?: throw IOException("Datei kann nicht gelesen werden")
        } else {
            FileInputStream(if (source.startsWith("file://")) Uri.parse(source).path!! else source)
        }
        return BufferedInputStream(stream, BUFFER)
    }

    private fun <T> deleteOnFailure(target: File, block: () -> T): T {
        try {
            return block()
        } catch (e: Exception) {
            target.delete()
            throw e
        }
    }

    private fun background(result: MethodChannel.Result, block: () -> Any?) {
        worker.execute {
            try {
                val value = block()
                main.post { result.success(value) }
            } catch (e: VaultCrypto.AuthenticationException) {
                main.post { result.error("auth", e.message, null) }
            } catch (e: VaultCrypto.FormatException) {
                main.post { result.error("format", e.message, null) }
            } catch (e: EOFException) {
                main.post { result.error("format", e.message, null) }
            } catch (e: Throwable) {
                main.post { result.error("io", e.message ?: e.javaClass.simpleName, null) }
            }
        }
    }

    private fun <T> MethodCall.arg(name: String): T =
        argument<T>(name) ?: throw IllegalArgumentException("Argument $name fehlt")

    private companion object {
        const val BUFFER = 1 shl 16
    }
}
