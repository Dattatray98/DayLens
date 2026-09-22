package tech.github.dattatray.wellnessvoice

import android.util.Log
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import ai.onnxruntime.genai.Generator
import ai.onnxruntime.genai.GeneratorParams
import ai.onnxruntime.genai.Model
import ai.onnxruntime.genai.Tokenizer
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.nio.FloatBuffer
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@CapacitorPlugin(name = "Wellness")
class WellnessPlugin : Plugin() {

    private lateinit var modelManager: ModelManager
    private val modelExecutor = Executors.newSingleThreadExecutor()
    private val isPreparingModel = AtomicBoolean(false)
    private val mainHandler = Handler(Looper.getMainLooper())
    private var speechRecognizer: SpeechRecognizer? = null
    private val isSpeechListening = AtomicBoolean(false)

    override fun load() {
        super.load()
        modelManager = ModelManager(context)
    }

    @PluginMethod
    fun prepareQwenModel(call: PluginCall) {
        if (modelManager.isModelValid()) {
            val payload = JSObject().apply {
                put("status", "ready")
                put("progress", 100.0)
                put("downloadedBytes", 0)
                put("totalBytes", 0)
            }
            notifyListeners("modelSetupProgress", payload)
            call.resolve(payload)
            return
        }

        if (!isPreparingModel.compareAndSet(false, true)) {
            val payload = JSObject().apply {
                put("status", "preparing")
                put("message", "Model preparation already in progress")
            }
            call.resolve(payload)
            return
        }

        emitModelSetupProgress("preparing", 0.0, 0L, 0L, null)
        val startedResponse = JSObject().apply {
            put("started", true)
            put("status", "preparing")
        }
        call.resolve(startedResponse)

        modelExecutor.execute {
            try {
                modelManager.ensureQwenModel { status, progress, downloadedBytes, totalBytes, error ->
                    emitModelSetupProgress(status, progress, downloadedBytes, totalBytes, error)
                }
                emitModelSetupProgress("ready", 100.0, 0L, 0L, null)
            } catch (error: Exception) {
                Log.e("WellnessPlugin", "Qwen model preparation failed", error)
                emitModelSetupProgress(
                    "error",
                    0.0,
                    0L,
                    0L,
                    error.message ?: "Model download or extraction failed"
                )
            } finally {
                isPreparingModel.set(false)
            }
        }
    }

    private fun emitModelSetupProgress(
        status: String,
        progress: Double,
        downloadedBytes: Long,
        totalBytes: Long,
        error: String?
    ) {
        val payload = JSObject().apply {
            put("status", status)
            put("progress", progress)
            put("downloadedBytes", downloadedBytes)
            put("totalBytes", totalBytes)
            if (error != null) {
                put("error", error)
            }
        }
        notifyListeners("modelSetupProgress", payload)
    }

    private companion object {
        const val GENAI_MODEL_ASSET_DIRECTORY = "models/tiny-random-gpt2-fp32"
        const val GENAI_MODEL_DIRECTORY = "tiny-random-gpt2-fp32"
        val GENAI_MODEL_FILES = listOf(
            "genai_config.json",
            "past.onnx",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json"
        )
    }

    private fun copyGenAiModelToFilesDir(): File {
        val modelDirectory = File(context.filesDir, "models/$GENAI_MODEL_DIRECTORY")

        if (!modelDirectory.exists() && !modelDirectory.mkdirs()) {
            throw IllegalStateException("Unable to create GenAI model directory")
        }

        GENAI_MODEL_FILES.forEach { fileName ->
            val destination = File(modelDirectory, fileName)
            if (destination.exists()) {
                return@forEach
            }

            val temporaryDestination = File(modelDirectory, "$fileName.tmp")
            context.assets.open("$GENAI_MODEL_ASSET_DIRECTORY/$fileName").use { input ->
                temporaryDestination.outputStream().use(input::copyTo)
            }

            if (!temporaryDestination.renameTo(destination)) {
                throw IllegalStateException("Unable to copy GenAI model file: $fileName")
            }
        }

        return modelDirectory
    }


    @PluginMethod
    fun getSteps(call: PluginCall) {
        try {
            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.ACTIVITY_RECOGNITION
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.ACTIVITY_RECOGNITION),
                    7001
                )

                val response = JSObject()
                response.put("success", false)
                response.put("permissionRequired", true)
                response.put("message", "Activity recognition permission required")

                call.resolve(response)
                return
            }

            val sensorManager =
                context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

            val stepSensor =
                sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

            if (stepSensor == null) {
                val response = JSObject()
                response.put("success", false)
                response.put("message", "Step counter sensor is not available")
                call.resolve(response)
                return
            }

            val handler = Handler(Looper.getMainLooper())

            val listener = object : SensorEventListener {
                override fun onSensorChanged(event: SensorEvent) {
                    sensorManager.unregisterListener(this)
                    handler.removeCallbacksAndMessages(null)

                    val steps = event.values[0].toLong()

                    val response = JSObject()
                    response.put("success", true)
                    response.put("steps", steps)
                    response.put("sensor", "TYPE_STEP_COUNTER")

                    Log.i(
                        "WellnessPlugin",
                        "Step count: $steps"
                    )

                    call.resolve(response)
                }

                override fun onAccuracyChanged(
                    sensor: Sensor?,
                    accuracy: Int
                ) {
                }
            }

            sensorManager.registerListener(
                listener,
                stepSensor,
                SensorManager.SENSOR_DELAY_NORMAL
            )

            handler.postDelayed({
                sensorManager.unregisterListener(listener)

                val response = JSObject()
                response.put("success", false)
                response.put("message", "Timed out waiting for step sensor")

                call.resolve(response)
            }, 2000)

        } catch (error: Exception) {
            Log.e(
                "WellnessPlugin",
                "Step sensor failed",
                error
            )

            call.reject(
                "Step sensor failed",
                error
            )
        }
    }

    @PluginMethod
    fun test(call: PluginCall) {
        val result = JSObject()
        result.put("message", "Hello from Wellness Voice Android")
        result.put("platform", "Android")
        result.put("native", true)
        call.resolve(result)
    }

    @PluginMethod
    fun testOnnxInference(call: PluginCall) {
        try {
            val environment = OrtEnvironment.getEnvironment()

            val modelBytes = context.assets.open("mul.onnx").use { it.readBytes() }

            val session = environment.createSession(modelBytes, OrtSession.SessionOptions())

            session.use {
                val inputShape = longArrayOf(2, 3)
                val numElements = 6

                val xValues = FloatBuffer.allocate(numElements)
                xValues.put(FloatArray(numElements) { 3.0f })
                xValues.rewind()

                val yValues = FloatBuffer.allocate(numElements)
                yValues.put(FloatArray(numElements) { 5.0f })
                yValues.rewind()

                val xTensor = OnnxTensor.createTensor(environment, xValues, inputShape)
                val yTensor = OnnxTensor.createTensor(environment, yValues, inputShape)

                xTensor.use {
                    yTensor.use {
                        val outputs = session.run(
                            mapOf(
                                "x" to xTensor,
                                "y" to yTensor
                            )
                        )

                        outputs.use {
                            val outputValues = outputs[0].value as Array<FloatArray>
                            val result = outputValues[0][0].toDouble()

                            val response = JSObject()
                            response.put("success", true)
                            response.put("operation", "multiply")
                            response.put("x", 3.0)
                            response.put("y", 5.0)
                            response.put("result", result)

                            call.resolve(response)
                        }
                    }
                }
            }
        } catch (error: Exception) {
            call.reject("ONNX inference failed", error)
        }
    }

    @PluginMethod
    fun testOnnx(call: PluginCall) {
        try {
            val environment = OrtEnvironment.getEnvironment()

            val result = JSObject()
            result.put("initialized", true)
            result.put("runtime", "ONNX Runtime")
            result.put("version", "1.30.0")

            call.resolve(result)
        } catch (error: Exception) {
            call.reject("ONNX Runtime initialization failed", error)
        }
    }

    @PluginMethod
    fun testGenAi(call: PluginCall) {
        val response = JSObject()
        response.put("runtime", "ONNX Runtime GenAI")

        try {
            val modelPath = copyGenAiModelToFilesDir().absolutePath
            val output = Model(modelPath).use { model ->
                Tokenizer(model).use { tokenizer ->
                    GeneratorParams(model).use { params ->
                        params.setSearchOption("max_length", 8.0)

                        Generator(model, params).use { generator ->
                            tokenizer.encode("Hello").use { promptTokens ->
                                generator.appendTokens(promptTokens.getSequence(0))
                            }

                            while (!generator.isDone()) {
                                generator.generateNextToken()
                            }

                            tokenizer.decode(generator.getSequence(0))
                        }
                    }
                }
            }

            response.put("success", true)
            response.put("output", output)
            Log.i("WellnessPlugin", "GenAI Test: success: true output: $output")
        } catch (error: Exception) {
            response.put("success", false)
            response.put("output", error.message ?: error.javaClass.simpleName)
            Log.e("WellnessPlugin", "GenAI Test: success: false", error)
        }

        call.resolve(response)
    }


    @PluginMethod
    fun testStructuredIntent(call: PluginCall) {
        val response = JSObject()
        response.put("runtime", "ONNX Runtime GenAI")
        response.put("model", "Qwen2.5-0.5B-Instruct INT4")

        try {
            val input = call.getString("input")
                ?: throw IllegalArgumentException("Missing input")

            val prompt = """
            <|im_start|>system
            You are Wellness Voice, a friendly and knowledgeable personal AI assistant.

            Your primary role is to help the user with wellness tasks, but you must also
            understand normal human conversation and answer naturally.

            You have two response modes.

            MODE 1: ACTION

            Use this mode only when the user wants the application to perform one of the
            supported wellness actions.

            Supported actions:

            log_food:
            {
              "type": "action",
              "action": "log_food",
              "items": [
                {
                  "food": "<food name>",
                  "quantity": <number>,
                  "unit": "<unit>"
                }
              ]
            }

            get_steps:
            {
              "type": "action",
              "action": "get_steps"
            }

            get_summary:
            {
              "type": "action",
              "action": "get_summary"
            }

            MODE 2: CONVERSATION

            Use this mode when the user is greeting you, chatting casually, asking a
            general question, or asking something that does not require one of the
            supported wellness tools.

            {
              "type": "conversation",
              "response": "<natural response to the user>"
            }

            CONVERSATION BEHAVIOR:
            - Be friendly, natural and conversational.
            - Respond directly to what the user said.
            - Simple messages such as "Hi", "Hello", "Good morning", or "How are you?"
              should receive natural conversational responses.
            - Answer general educational questions when you can.
            - Do not pretend to be a doctor, lawyer, or other licensed professional.
            - For medical topics, provide general educational information rather than
              diagnosis or personal medical treatment.
            - Do not force wellness topics into unrelated conversations.
            - Do not mention JSON, tools, intent parsing, schemas, or internal processing.

            ACTION RULES:
            - Return an action only when the user clearly wants a supported wellness action.
            - Never invent missing values.
            - Do not calculate nutrition values.
            - For multiple foods, include every food in the items array.
            - quantity must be a number.

            OUTPUT RULES:
            - Return ONLY one valid JSON object.
            - Do not use Markdown outside the JSON string.
            - Do not add explanations outside the JSON object.
            <|im_end|>
            <|im_start|>user
            $input
            <|im_end|>
            <|im_start|>assistant
        """.trimIndent()

            val modelPath = modelManager.ensureQwenModel().absolutePath

            val output = Model(modelPath).use { model ->
                Tokenizer(model).use { tokenizer ->
                    GeneratorParams(model).use { params ->
                        params.setSearchOption("max_length", 2048.0)

                        Generator(model, params).use { generator ->
                            tokenizer.encode(prompt).use { promptTokens ->
                                generator.appendTokenSequences(promptTokens)
                            }

                            while (!generator.isDone()) {
                                generator.generateNextToken()
                            }

                            val fullOutput = tokenizer.decode(generator.getSequence(0))

                            fullOutput
                                .substringAfterLast("assistant", fullOutput)
                                .replace("<|im_end|>", "")
                                .trim()
                        }
                    }
                }
            }

            response.put("success", true)
            response.put("output", output)

            Log.i(
                "WellnessPlugin",
                "Structured Intent Test: success: true output: $output"
            )

        } catch (error: Exception) {
            response.put("success", false)
            response.put(
                "output",
                error.message ?: error.javaClass.simpleName
            )

            Log.e(
                "WellnessPlugin",
                "Structured Intent Test: success: false",
                error
            )
        }

        call.resolve(response)
    }

    @PluginMethod
    fun testQwenGenAi(call: PluginCall) {
        val response = JSObject()
        response.put("runtime", "ONNX Runtime GenAI")
        response.put("model", "Qwen2.5-0.5B-Instruct INT4")

        try {
            val modelPath = modelManager.ensureQwenModel().absolutePath

            val output = Model(modelPath).use { model ->
                Tokenizer(model).use { tokenizer ->
                    GeneratorParams(model).use { params ->
                        params.setSearchOption("max_length", 64.0)

                        Generator(model, params).use { generator ->
                            tokenizer.encode(
                                "Hello, introduce yourself in one sentence."
                            ).use { promptTokens ->
                                generator.appendTokenSequences(promptTokens)
                            }

                            while (!generator.isDone()) {
                                generator.generateNextToken()
                            }

                            tokenizer.decode(generator.getSequence(0))
                        }
                    }
                }
            }

            response.put("success", true)
            response.put("output", output)

            Log.i(
                "WellnessPlugin",
                "Qwen GenAI Test: success: true output: $output"
            )
        } catch (error: Exception) {
            response.put("success", false)
            response.put(
                "output",
                error.message ?: error.javaClass.simpleName
            )

            Log.e(
                "WellnessPlugin",
                "Qwen GenAI Test: success: false",
                error
            )
        }

        call.resolve(response)
    }

    @PluginMethod
    fun getSpeechAvailability(call: PluginCall) {
        val response = JSObject()
        val isAvailable = SpeechRecognizer.isRecognitionAvailable(context)
        var onDeviceAvailable = false

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                onDeviceAvailable = SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
            } catch (e: Exception) {
                Log.w("WellnessPlugin", "Error checking on-device recognition availability: ${e.message}")
            }
        }

        response.put("available", isAvailable)
        response.put("onDeviceAvailable", onDeviceAvailable)
        call.resolve(response)
    }

    @PluginMethod
    fun startListening(call: PluginCall) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                7002
            )
            val response = JSObject().apply {
                put("success", false)
                put("permissionRequired", true)
                put("message", "Microphone permission required")
            }
            notifyListeners("speechError", JSObject().apply {
                put("error", "Microphone permission required")
                put("code", 9)
            })
            call.resolve(response)
            return
        }

        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            val response = JSObject().apply {
                put("success", false)
                put("message", "Speech recognition is not available on this device")
            }
            notifyListeners("speechError", JSObject().apply {
                put("error", "Speech recognition not available on device")
                put("code", 2)
            })
            call.resolve(response)
            return
        }

        mainHandler.post {
            try {
                cleanupSpeechRecognizer()

                var usedOnDevice = false
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    try {
                        if (SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
                            speechRecognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
                            usedOnDevice = true
                        }
                    } catch (e: Exception) {
                        Log.w("WellnessPlugin", "createOnDeviceSpeechRecognizer failed, falling back: ${e.message}")
                    }
                }

                if (speechRecognizer == null) {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
                }

                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        isSpeechListening.set(true)
                        notifyListeners("speechState", JSObject().apply { put("state", "listening") })
                    }

                    override fun onBeginningOfSpeech() {
                        notifyListeners("speechState", JSObject().apply { put("state", "listening") })
                    }

                    override fun onRmsChanged(rmsdB: Float) {}

                    override fun onBufferReceived(buffer: ByteArray?) {}

                    override fun onEndOfSpeech() {
                        notifyListeners("speechState", JSObject().apply { put("state", "processing") })
                    }

                    override fun onError(error: Int) {
                        isSpeechListening.set(false)
                        val errorMsg = when (error) {
                            SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                            SpeechRecognizer.ERROR_CLIENT -> "Client side error"
                            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
                            SpeechRecognizer.ERROR_NETWORK -> "Network error"
                            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                            SpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized"
                            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognition service busy"
                            SpeechRecognizer.ERROR_SERVER -> "Server error"
                            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected"
                            SpeechRecognizer.ERROR_SERVER_DISCONNECTED -> "Offline speech recognition disconnected or language pack unavailable"
                            else -> "Speech recognition error ($error)"
                        }

                        notifyListeners("speechError", JSObject().apply {
                            put("error", errorMsg)
                            put("code", error)
                        })

                        notifyListeners("speechState", JSObject().apply {
                            put("state", "idle")
                        })
                    }

                    override fun onResults(results: Bundle?) {
                        isSpeechListening.set(false)
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val recognizedText = matches?.firstOrNull() ?: ""

                        notifyListeners("speechResult", JSObject().apply {
                            put("text", recognizedText)
                        })

                        notifyListeners("speechState", JSObject().apply {
                            put("state", "idle")
                        })
                    }

                    override fun onPartialResults(partialResults: Bundle?) {
                        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val partialText = matches?.firstOrNull() ?: ""
                        if (partialText.isNotEmpty()) {
                            notifyListeners("speechPartial", JSObject().apply {
                                put("text", partialText)
                            })
                        }
                    }

                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                }

                speechRecognizer?.startListening(intent)

                val response = JSObject().apply {
                    put("success", true)
                    put("onDevice", usedOnDevice)
                }
                call.resolve(response)
            } catch (e: Exception) {
                isSpeechListening.set(false)
                Log.e("WellnessPlugin", "Failed to start speech recognition", e)
                val response = JSObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Failed to start speech recognition")
                }
                call.resolve(response)
            }
        }
    }

    @PluginMethod
    fun stopListening(call: PluginCall) {
        mainHandler.post {
            try {
                speechRecognizer?.stopListening()
                isSpeechListening.set(false)
                notifyListeners("speechState", JSObject().apply { put("state", "idle") })
                val response = JSObject().apply { put("success", true) }
                call.resolve(response)
            } catch (e: Exception) {
                val response = JSObject().apply {
                    put("success", false)
                    put("error", e.message ?: "Failed to stop speech recognition")
                }
                call.resolve(response)
            }
        }
    }

    private fun cleanupSpeechRecognizer() {
        try {
            speechRecognizer?.cancel()
            speechRecognizer?.destroy()
        } catch (e: Exception) {
            Log.w("WellnessPlugin", "Error cleaning up speech recognizer", e)
        } finally {
            speechRecognizer = null
            isSpeechListening.set(false)
        }
    }

    override fun handleOnDestroy() {
        mainHandler.post {
            cleanupSpeechRecognizer()
        }
        super.handleOnDestroy()
    }
}
