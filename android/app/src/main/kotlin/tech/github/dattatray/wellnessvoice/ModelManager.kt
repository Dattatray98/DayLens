package tech.github.dattatray.wellnessvoice

import android.content.Context
import android.os.Build
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.zip.ZipInputStream

class ModelManager(
    private val context: Context
) {

    companion object {
        private const val MODEL_DIRECTORY = "qwen2.5-0.5b-instruct-int4"

        private const val MODEL_URL =
            "https://huggingface.co/jojewardattatray98/wellness-voice-qwen2.5-0.5b/resolve/main/qwen2.5-0.5b-instruct-int4.zip"

        private const val EXPECTED_SHA256 =
            "2f513244f34f656989a5ae54cd09f00abf9a4cc0295760a8d0c928638a5bf155"

        private val REQUIRED_FILES = listOf(
            "chat_template.jinja",
            "genai_config.json",
            "model.onnx",
            "model.onnx.data",
            "tokenizer_config.json",
            "tokenizer.json"
        )
    }

    private val modelsRoot: File
        get() = File(context.filesDir, "models")

    private val modelDirectory: File
        get() = File(modelsRoot, MODEL_DIRECTORY)

    private val archiveFile: File
        get() = File(modelsRoot, "$MODEL_DIRECTORY.zip")

    private val partialArchiveFile: File
        get() = File(modelsRoot, "$MODEL_DIRECTORY.zip.part")

    fun ensureQwenModel(
        progressListener: ((status: String, progress: Double, downloaded: Long, total: Long, error: String?) -> Unit)? = null
    ): File {
        if (isModelValid()) {
            return modelDirectory
        }

        progressListener?.invoke("preparing", 0.0, 0L, 0L, null)

        if (!modelsRoot.exists() && !modelsRoot.mkdirs()) {
            throw IllegalStateException(
                "Unable to create model storage directory"
            )
        }

        if (partialArchiveFile.exists()) {
            partialArchiveFile.delete()
        }

        if (archiveFile.exists()) {
            archiveFile.delete()
        }

        if (modelDirectory.exists()) {
            modelDirectory.deleteRecursively()
        }

        downloadModel(progressListener)

        progressListener?.invoke("verifying", 100.0, archiveFile.length(), archiveFile.length(), null)

        verifySha256(
            archiveFile,
            EXPECTED_SHA256
        )

        extractModel()

        if (!isModelValid()) {
            modelDirectory.deleteRecursively()
            throw IllegalStateException(
                "Downloaded model is missing required files"
            )
        }

        if (!archiveFile.delete()) {
            archiveFile.deleteOnExit()
        }

        return modelDirectory
    }

    fun isModelValid(): Boolean {
        if (!modelDirectory.isDirectory) {
            return false
        }

        return REQUIRED_FILES.all { fileName ->
            val file = File(modelDirectory, fileName)
            file.isFile && file.length() > 0
        }
    }

    private fun downloadModel(
        progressListener: ((status: String, progress: Double, downloaded: Long, total: Long, error: String?) -> Unit)?
    ) {
        var currentUrl = URL(MODEL_URL)
        var connection: HttpURLConnection
        var redirects = 0
        val maxRedirects = 5

        while (true) {
            connection = (currentUrl.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 30_000
                readTimeout = 60_000
                instanceFollowRedirects = true
                setRequestProperty("Accept", "application/octet-stream")
            }

            val responseCode = connection.responseCode
            if (responseCode in 300..399) {
                val location = connection.getHeaderField("Location")
                connection.disconnect()
                if (!location.isNullOrEmpty() && redirects < maxRedirects) {
                    currentUrl = if (location.startsWith("http://") || location.startsWith("https://")) {
                        URL(location)
                    } else {
                        URL(currentUrl, location)
                    }
                    redirects++
                    continue
                }
            }
            break
        }

        try {
            val responseCode = connection.responseCode

            if (responseCode !in 200..299) {
                throw IllegalStateException(
                    "Model download failed with HTTP $responseCode"
                )
            }

            val serverTotalBytes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                connection.contentLengthLong
            } else {
                connection.contentLength.toLong()
            }
            // Fall back to known 333MB size (~349,175,808 bytes) if Content-Length is missing or chunked
            val totalBytes = if (serverTotalBytes > 0) serverTotalBytes else 349_175_808L

            connection.inputStream.use { input ->
                FileOutputStream(partialArchiveFile).use { output ->
                    val buffer = ByteArray(64 * 1024)
                    var downloadedBytes = 0L
                    var lastEmitTime = 0L

                    // Initial download progress notification
                    progressListener?.invoke("downloading", 0.0, 0L, totalBytes, null)

                    while (true) {
                        val bytesRead = input.read(buffer)

                        if (bytesRead == -1) {
                            break
                        }

                        output.write(buffer, 0, bytesRead)
                        downloadedBytes += bytesRead

                        val now = System.currentTimeMillis()
                        if (now - lastEmitTime > 150) {
                            lastEmitTime = now
                            val progressPercent = (downloadedBytes.toDouble() / totalBytes * 100.0).coerceIn(0.0, 100.0)
                            progressListener?.invoke(
                                "downloading",
                                progressPercent,
                                downloadedBytes,
                                totalBytes,
                                null
                            )
                        }
                    }

                    // Ensure 100% download emit at completion
                    progressListener?.invoke(
                        "downloading",
                        100.0,
                        downloadedBytes,
                        totalBytes,
                        null
                    )

                    output.fd.sync()
                }
            }

            if (!partialArchiveFile.renameTo(archiveFile)) {
                throw IllegalStateException(
                    "Unable to finalize downloaded model archive"
                )
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun verifySha256(
        file: File,
        expectedHash: String
    ) {
        val digest = MessageDigest.getInstance("SHA-256")

        FileInputStream(file).use { input ->
            val buffer = ByteArray(1024 * 1024)

            while (true) {
                val bytesRead = input.read(buffer)

                if (bytesRead == -1) {
                    break
                }

                digest.update(buffer, 0, bytesRead)
            }
        }

        val actualHash = digest
            .digest()
            .joinToString("") { byte ->
                "%02x".format(byte)
            }

        if (!actualHash.equals(expectedHash, ignoreCase = true)) {
            throw IllegalStateException(
                "Model SHA-256 verification failed"
            )
        }
    }

    private fun extractModel() {
        if (!modelDirectory.exists() && !modelDirectory.mkdirs()) {
            throw IllegalStateException(
                "Unable to create model extraction directory"
            )
        }

        ZipInputStream(
            archiveFile.inputStream().buffered()
        ).use { zipInputStream ->

            while (true) {
                val entry = zipInputStream.nextEntry
                    ?: break

                val entryName = entry.name
                    .removePrefix("$MODEL_DIRECTORY/")
                    .trimStart('/')

                if (entryName.isEmpty()) {
                    zipInputStream.closeEntry()
                    continue
                }

                if (
                    entryName.contains("..") ||
                    entryName.startsWith("/")
                ) {
                    throw IllegalStateException(
                        "Unsafe model archive entry: ${entry.name}"
                    )
                }

                val outputFile = File(
                    modelDirectory,
                    entryName
                )

                val canonicalRoot =
                    modelDirectory.canonicalFile

                val canonicalOutput =
                    outputFile.canonicalFile

                if (
                    !canonicalOutput.path.startsWith(
                        canonicalRoot.path + File.separator
                    )
                ) {
                    throw IllegalStateException(
                        "Unsafe model archive path: ${entry.name}"
                    )
                }

                if (entry.isDirectory) {
                    if (
                        !outputFile.exists() &&
                        !outputFile.mkdirs()
                    ) {
                        throw IllegalStateException(
                            "Unable to create model directory: ${entry.name}"
                        )
                    }
                } else {
                    outputFile.parentFile?.mkdirs()

                    FileOutputStream(outputFile).use { output ->
                        zipInputStream.copyTo(output)
                    }
                }

                zipInputStream.closeEntry()
            }
        }
    }
}
