package tech.github.dattatray.wellnessvoice

import android.util.Log
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

@CapacitorPlugin(name = "Wellness")
class WellnessPlugin : Plugin() {

    private companion object {
    const val QWEN_GENAI_MODEL_DIRECTORY = "qwen2.5-0.5b-instruct-int4"

    val QWEN_GENAI_MODEL_FILES = listOf(
        "chat_template.jinja",
        "genai_config.json",
        "model.onnx",
        "model.onnx.data",
        "tokenizer_config.json",
        "tokenizer.json"
    )

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


    private fun copyQwenGenAiModelToFilesDir(): File {
        val modelDirectory = File(
            context.filesDir,
            "models/$QWEN_GENAI_MODEL_DIRECTORY"
        )

        if (!modelDirectory.exists() && !modelDirectory.mkdirs()) {
            throw IllegalStateException("Unable to create Qwen GenAI model directory")
        }

        QWEN_GENAI_MODEL_FILES.forEach { fileName ->
            val destination = File(modelDirectory, fileName)

            if (destination.exists()) {
                return@forEach
            }

            val temporaryDestination = File(
                modelDirectory,
                "$fileName.tmp"
            )

            context.assets
                .open("models/$QWEN_GENAI_MODEL_DIRECTORY/$fileName")
                .use { input ->
                    temporaryDestination.outputStream().use(input::copyTo)
                }

            if (!temporaryDestination.renameTo(destination)) {
                throw IllegalStateException(
                    "Unable to copy Qwen GenAI model file: $fileName"
                )
            }
        }

        return modelDirectory
    }

    @PluginMethod
    fun testQwenGenAi(call: PluginCall) {
        val response = JSObject()
        response.put("runtime", "ONNX Runtime GenAI")
        response.put("model", "Qwen2.5-0.5B-Instruct INT4")

        try {
            val modelPath = copyQwenGenAiModelToFilesDir().absolutePath

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
