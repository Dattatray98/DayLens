package tech.github.dattatray.wellnessvoice

import android.util.Log
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
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
            You are a wellness assistant intent parser.
            Convert the user's request into exactly one JSON object.

            Allowed actions:

            log_food:
            {
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
              "action": "get_steps"
            }

            get_summary:
            {
              "action": "get_summary"
            }

            Rules:
            - Return ONLY valid JSON.
            - Do not use Markdown.
            - Do not add explanations.
            - Do not calculate nutrition values.
            - Do not invent missing values.
            - For multiple foods, include every food in the items array.
            - quantity must be a number.
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
                        params.setSearchOption("max_length", 256.0)

                        Generator(model, params).use { generator ->
                            tokenizer.encode(prompt).use { promptTokens ->
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
}
